const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { imprimirItens } = require('../services/impressao');
const { exigirPapel } = require('../middleware/auth');
const eventos = require('../services/eventos');
const { registrar } = require('../services/auditoria');

// GET /api/pedidos/comanda/:comandaId - itens de uma comanda
router.get('/comanda/:comandaId', (req, res) => {
  const { comandaId } = req.params;
  const itens = db
    .prepare(
      `SELECT ip.*, pr.nome AS produto_nome
       FROM itens_pedido ip
       JOIN pedidos p ON p.id = ip.pedido_id
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE p.comanda_id = ?
       ORDER BY ip.criado_em DESC`
    )
    .all(comandaId);
  res.json(itens);
});

// POST /api/pedidos - cria um pedido com itens e envia para as impressoras corretas
// body: { comanda_id, itens: [{ produto_id, quantidade, observacao }] }
router.post('/', exigirPapel('admin', 'garcom', 'caixa'), (req, res) => {
  const { comanda_id, itens } = req.body;
  if (!comanda_id || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'comanda_id e itens são obrigatórios' });
  }

  const comanda = db.prepare(`SELECT * FROM comandas WHERE id = ? AND status = 'aberta'`).get(comanda_id);
  if (!comanda) return res.status(400).json({ erro: 'Comanda não encontrada ou não está aberta' });

  for (const item of itens) {
    const quantidade = item.quantidade ?? 1;
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ erro: 'quantidade deve ser um número inteiro maior que zero' });
    }
  }

  const criarPedido = db.prepare('INSERT INTO pedidos (comanda_id) VALUES (?)');
  const buscarProduto = db.prepare('SELECT * FROM produtos WHERE id = ?');
  const inserirItem = db.prepare(
    `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, setor, observacao)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const criarPedidoCompleto = db.transaction(() => {
    const pedidoId = criarPedido.run(comanda_id).lastInsertRowid;
    const itensCriados = [];

    for (const item of itens) {
      const produto = buscarProduto.get(item.produto_id);
      if (!produto) continue;

      const quantidade = item.quantidade ?? 1;
      const info = inserirItem.run(
        pedidoId,
        produto.id,
        quantidade,
        produto.preco,
        produto.setor_impressao,
        item.observacao || null
      );

      itensCriados.push({
        id: info.lastInsertRowid,
        produto_nome: produto.nome,
        quantidade,
        setor: produto.setor_impressao,
      });
    }

    return { pedidoId, itensCriados };
  });

  const { pedidoId, itensCriados } = criarPedidoCompleto();

  // Agrupa por setor e dispara impressão em paralelo (cozinha / bar)
  const porSetor = itensCriados.reduce((acc, item) => {
    acc[item.setor] = acc[item.setor] || [];
    acc[item.setor].push(item);
    return acc;
  }, {});

  const mesa = db.prepare('SELECT numero FROM mesas WHERE id = ?').get(comanda.mesa_id);

  Object.entries(porSetor).forEach(([setor, itensDoSetor]) => {
    imprimirItens(setor, comanda, itensDoSetor, req.usuario.nome).catch((err) => {
      console.error(`Falha ao imprimir no setor ${setor}:`, err.message);
      eventos.emitir('impressao_falhou', { setor, mesa_numero: mesa?.numero ?? comanda.mesa_id });
    });
  });

  eventos.emitir('pedido_criado', { comanda_id, itens: itensCriados });

  registrar({
    usuario: req.usuario,
    acao: 'pedido_criado',
    entidade: 'pedido',
    entidadeId: pedidoId,
    detalhes: { comanda_id, itens: itensCriados.map((i) => ({ produto: i.produto_nome, quantidade: i.quantidade })) },
  });

  res.status(201).json({ pedido_id: pedidoId, itens: itensCriados });
});

// PATCH /api/pedidos/itens/:id/status - usado pelo KDS (pendente -> preparando -> pronto)
router.patch('/itens/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validos = ['pendente', 'preparando', 'pronto', 'entregue'];
  if (!validos.includes(status)) {
    return res.status(400).json({ erro: 'status inválido' });
  }

  const item = db.prepare('SELECT * FROM itens_pedido WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

  if (['cozinha', 'bar'].includes(req.usuario.papel) && item.setor !== req.usuario.papel) {
    return res.status(403).json({ erro: 'Você só pode atualizar itens do seu setor' });
  }

  db.prepare(`UPDATE itens_pedido SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`).run(
    status,
    id
  );

  eventos.emitir('item_atualizado', { id: item.id, status, setor: item.setor });

  registrar({
    usuario: req.usuario,
    acao: 'item_status_atualizado',
    entidade: 'item_pedido',
    entidadeId: item.id,
    detalhes: { statusAnterior: item.status, statusNovo: status },
  });

  res.json({ ok: true });
});

// DELETE /api/pedidos/itens/:id - remove um item já enviado (exclusivo do caixa/admin).
router.delete('/itens/:id', exigirPapel('admin', 'caixa'), (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM itens_pedido WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

  db.prepare('DELETE FROM itens_pedido WHERE id = ?').run(id);

  eventos.emitir('item_removido', { id: item.id, setor: item.setor });

  registrar({
    usuario: req.usuario,
    acao: 'item_removido',
    entidade: 'item_pedido',
    entidadeId: item.id,
    detalhes: { produto_id: item.produto_id, quantidade: item.quantidade },
  });

  res.json({ ok: true });
});

// GET /api/pedidos/kds/:setor - fila do KDS por setor (cozinha ou bar)
router.get('/kds/:setor', (req, res) => {
  const { setor } = req.params;
  const itens = db
    .prepare(
      `SELECT ip.*, pr.nome AS produto_nome, m.numero AS mesa_numero
       FROM itens_pedido ip
       JOIN pedidos p ON p.id = ip.pedido_id
       JOIN comandas c ON c.id = p.comanda_id
       JOIN mesas m ON m.id = c.mesa_id
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE ip.setor = ? AND ip.status IN ('pendente','preparando','pronto')
       ORDER BY ip.criado_em ASC`
    )
    .all(setor);
  res.json(itens);
});

module.exports = router;
