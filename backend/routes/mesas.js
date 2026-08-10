const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { imprimirConta } = require('../services/impressao');
const { exigirPapel } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');
const eventos = require('../services/eventos');

// GET /api/mesas - mapa de mesas com status, cliente e tempo aberto
router.get('/', (req, res) => {
  const mesas = db.prepare('SELECT * FROM mesas ORDER BY numero').all();

  const comandaAbertaStmt = db.prepare(
    `SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta' ORDER BY id DESC LIMIT 1`
  );
  const reservaStmt = db.prepare(
    `SELECT * FROM reservas WHERE mesa_id = ? AND status = 'confirmada' ORDER BY horario LIMIT 1`
  );
  const totalComandaStmt = db.prepare(
    `SELECT COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0) AS total
     FROM itens_pedido ip
     JOIN pedidos p ON p.id = ip.pedido_id
     WHERE p.comanda_id = ? AND ip.status != 'cancelado'`
  );

  const resultado = mesas.map((mesa) => {
    const comanda = comandaAbertaStmt.get(mesa.id);
    const reserva = mesa.status === 'reservada' ? reservaStmt.get(mesa.id) : null;
    const total = comanda ? totalComandaStmt.get(comanda.id).total : 0;

    return {
      ...mesa,
      comanda: comanda
        ? {
            id: comanda.id,
            nome_cliente: comanda.nome_cliente,
            aberta_em: comanda.aberta_em,
            total,
            desconto_tipo: comanda.desconto_tipo,
            desconto_valor: comanda.desconto_valor,
          }
        : null,
      reserva: reserva
        ? { id: reserva.id, nome_cliente: reserva.nome_cliente, horario: reserva.horario }
        : null,
    };
  });

  res.json(resultado);
});

// POST /api/mesas/:id/abrir - abre uma mesa com nome do cliente opcional
router.post('/:id/abrir', exigirPapel('admin', 'garcom', 'caixa'), (req, res) => {
  const { id } = req.params;
  const { nome_cliente, numero_pessoas } = req.body;

  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(id);
  if (!mesa) return res.status(404).json({ erro: 'Mesa não encontrada' });
  if (mesa.status === 'ocupada') return res.status(400).json({ erro: 'Mesa já está ocupada' });

  const criarComanda = db.prepare(
    'INSERT INTO comandas (restaurante_id, mesa_id, nome_cliente, numero_pessoas) VALUES (?, ?, ?, ?)'
  );
  const info = criarComanda.run(mesa.restaurante_id, mesa.id, nome_cliente || null, numero_pessoas || null);

  db.prepare(`UPDATE mesas SET status = 'ocupada' WHERE id = ?`).run(mesa.id);

  registrar({
    usuario: req.usuario,
    acao: 'mesa_aberta',
    entidade: 'mesa',
    entidadeId: mesa.id,
    detalhes: { nome_cliente: nome_cliente || null, comanda_id: info.lastInsertRowid },
  });

  res.status(201).json({ comanda_id: info.lastInsertRowid });
});

// Calcula o total devido de uma comanda (subtotal dos itens não cancelados - desconto)
function calcularTotalDevido(comanda) {
  const { total: subtotal } = db
    .prepare(
      `SELECT COALESCE(SUM(ip.quantidade * ip.preco_unitario), 0) AS total
       FROM itens_pedido ip
       JOIN pedidos p ON p.id = ip.pedido_id
       WHERE p.comanda_id = ? AND ip.status != 'cancelado'`
    )
    .get(comanda.id);

  let desconto = 0;
  if (comanda.desconto_valor > 0) {
    desconto = comanda.desconto_tipo === 'percentual'
      ? subtotal * (comanda.desconto_valor / 100)
      : comanda.desconto_valor;
  }
  return Math.max(0, subtotal - desconto);
}

const FORMAS_PAGAMENTO_VALIDAS = ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix'];

// POST /api/mesas/:id/pagamento - registra um pagamento parcial na comanda aberta
// body: { forma_pagamento, valor }
router.post('/:id/pagamento', exigirPapel('admin', 'garcom', 'caixa'), (req, res) => {
  const { id } = req.params;
  const { forma_pagamento, valor } = req.body || {};

  if (!forma_pagamento || !FORMAS_PAGAMENTO_VALIDAS.includes(forma_pagamento)) {
    return res.status(400).json({ erro: 'Forma de pagamento inválida' });
  }
  if (!valor || valor <= 0) {
    return res.status(400).json({ erro: 'Informe um valor válido' });
  }

  const comanda = db
    .prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta'`)
    .get(id);
  if (!comanda) return res.status(400).json({ erro: 'Não há comanda aberta nessa mesa' });

  const totalDevido = calcularTotalDevido(comanda);
  const { total: jaPago } = db
    .prepare('SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE comanda_id = ?')
    .get(comanda.id);
  const restante = totalDevido - jaPago;

  if (valor > restante + 0.01) {
    return res.status(400).json({ erro: `Valor maior que o restante devido (R$ ${restante.toFixed(2)})` });
  }

  const info = db
    .prepare('INSERT INTO pagamentos (comanda_id, forma_pagamento, valor) VALUES (?, ?, ?)')
    .run(comanda.id, forma_pagamento, valor);

  registrar({
    usuario: req.usuario,
    acao: 'pagamento_registrado',
    entidade: 'comanda',
    entidadeId: comanda.id,
    detalhes: { forma_pagamento, valor },
  });

  const novoRestante = Math.max(0, restante - valor);
  res.status(201).json({ id: info.lastInsertRowid, total_devido: totalDevido, total_pago: jaPago + valor, restante: novoRestante });
});

// GET /api/mesas/:id/pagamentos - lista os pagamentos já registrados na comanda aberta
router.get('/:id/pagamentos', (req, res) => {
  const { id } = req.params;
  const comanda = db
    .prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta'`)
    .get(id);
  if (!comanda) return res.json({ pagamentos: [], total_devido: 0, total_pago: 0, restante: 0 });

  const pagamentos = db
    .prepare('SELECT * FROM pagamentos WHERE comanda_id = ? ORDER BY criado_em')
    .all(comanda.id);

  const totalDevido = calcularTotalDevido(comanda);
  const totalPago = pagamentos.reduce((soma, p) => soma + p.valor, 0);

  res.json({
    pagamentos,
    total_devido: totalDevido,
    total_pago: totalPago,
    restante: Math.max(0, totalDevido - totalPago),
  });
});

// DELETE /api/mesas/:id/pagamento/:pagamentoId - remove um pagamento lançado por engano
router.delete('/:id/pagamento/:pagamentoId', exigirPapel('admin', 'caixa'), (req, res) => {
  const { id, pagamentoId } = req.params;
  const comanda = db
    .prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta'`)
    .get(id);
  if (!comanda) return res.status(400).json({ erro: 'Não há comanda aberta nessa mesa' });

  const pagamento = db.prepare('SELECT * FROM pagamentos WHERE id = ? AND comanda_id = ?').get(pagamentoId, comanda.id);
  if (!pagamento) return res.status(404).json({ erro: 'Pagamento não encontrado' });

  db.prepare('DELETE FROM pagamentos WHERE id = ?').run(pagamentoId);

  registrar({
    usuario: req.usuario,
    acao: 'pagamento_removido',
    entidade: 'comanda',
    entidadeId: comanda.id,
    detalhes: { forma_pagamento: pagamento.forma_pagamento, valor: pagamento.valor },
  });

  res.json({ ok: true });
});

// POST /api/mesas/:id/fechar - fecha a comanda e libera a mesa.
// Exige que os pagamentos registrados (tabela pagamentos) cubram o total devido.
// Atalho: se não houver nenhum pagamento registrado e vier { forma_pagamento } no
// corpo, registra automaticamente um único pagamento com o valor total (fecha em 1 clique).
router.post('/:id/fechar', exigirPapel('admin', 'garcom', 'caixa'), (req, res) => {
  const { id } = req.params;
  const { forma_pagamento } = req.body || {};

  const comanda = db
    .prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta'`)
    .get(id);
  if (!comanda) return res.status(400).json({ erro: 'Não há comanda aberta nessa mesa' });

  const totalDevido = calcularTotalDevido(comanda);
  let pagamentos = db.prepare('SELECT * FROM pagamentos WHERE comanda_id = ?').all(comanda.id);

  // Atalho de pagamento único: sem pagamentos parciais lançados, fecha com um só
  if (pagamentos.length === 0 && forma_pagamento) {
    if (!FORMAS_PAGAMENTO_VALIDAS.includes(forma_pagamento)) {
      return res.status(400).json({ erro: 'Forma de pagamento inválida' });
    }
    db.prepare('INSERT INTO pagamentos (comanda_id, forma_pagamento, valor) VALUES (?, ?, ?)')
      .run(comanda.id, forma_pagamento, totalDevido);
    pagamentos = db.prepare('SELECT * FROM pagamentos WHERE comanda_id = ?').all(comanda.id);
  }

  const totalPago = pagamentos.reduce((soma, p) => soma + p.valor, 0);
  if (totalPago < totalDevido - 0.01) {
    return res.status(400).json({
      erro: `Pagamentos não cobrem o total. Restante: R$ ${(totalDevido - totalPago).toFixed(2)}`,
    });
  }

  const formasDistintas = [...new Set(pagamentos.map((p) => p.forma_pagamento))];
  const formaFinal = formasDistintas.length === 1 ? formasDistintas[0] : 'misto';

  db.prepare(
    `UPDATE comandas SET status = 'fechada', fechada_em = CURRENT_TIMESTAMP, forma_pagamento = ? WHERE id = ?`
  ).run(formaFinal, comanda.id);

  db.prepare(`UPDATE mesas SET status = 'disponivel' WHERE id = ?`).run(id);

  registrar({
    usuario: req.usuario,
    acao: 'mesa_fechada',
    entidade: 'mesa',
    entidadeId: Number(id),
    detalhes: { comanda_id: comanda.id, forma_pagamento: formaFinal, total_pago: totalPago, qtd_pagamentos: pagamentos.length },
  });

  res.json({ ok: true });
});

// POST /api/mesas/:id/desconto - aplica ou remove desconto antes de fechar
// body: { tipo: 'percentual'|'valor', valor: number } ou { valor: 0 } pra remover
router.post('/:id/desconto', exigirPapel('admin', 'caixa'), (req, res) => {
  const { id } = req.params;
  const { tipo, valor } = req.body;

  const comanda = db
    .prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta'`)
    .get(id);
  if (!comanda) return res.status(400).json({ erro: 'Não há comanda aberta nessa mesa' });

  const descontoTipo = valor > 0 ? (tipo || 'percentual') : null;
  const descontoValor = valor || 0;

  db.prepare('UPDATE comandas SET desconto_tipo = ?, desconto_valor = ? WHERE id = ?')
    .run(descontoTipo, descontoValor, comanda.id);

  registrar({
    usuario: req.usuario,
    acao: 'desconto_aplicado',
    entidade: 'comanda',
    entidadeId: comanda.id,
    detalhes: { tipo: descontoTipo, valor: descontoValor },
  });

  res.json({ ok: true, desconto_tipo: descontoTipo, desconto_valor: descontoValor });
});

// POST /api/mesas/:id/imprimir-conta - imprime a pré-conta (não fecha a mesa, não trata pagamento)
router.post('/:id/imprimir-conta', exigirPapel('admin', 'garcom', 'caixa'), async (req, res) => {
  const { id } = req.params;

  const comanda = db
    .prepare(`SELECT * FROM comandas WHERE mesa_id = ? AND status = 'aberta'`)
    .get(id);
  if (!comanda) return res.status(400).json({ erro: 'Não há comanda aberta nessa mesa' });

  const itens = db
    .prepare(
      `SELECT ip.quantidade, ip.preco_unitario, p.nome AS produto_nome
       FROM itens_pedido ip
       JOIN pedidos pe ON pe.id = ip.pedido_id
       JOIN produtos p ON p.id = ip.produto_id
       WHERE pe.comanda_id = ? AND ip.status != 'cancelado'`
    )
    .all(comanda.id);

  const subtotal = itens.reduce((soma, item) => soma + item.quantidade * item.preco_unitario, 0);

  // Calcula desconto
  let desconto = 0;
  if (comanda.desconto_valor > 0) {
    desconto = comanda.desconto_tipo === 'percentual'
      ? subtotal * (comanda.desconto_valor / 100)
      : comanda.desconto_valor;
  }

  const total = subtotal - desconto;

  const pagamentos = db
    .prepare('SELECT forma_pagamento, valor FROM pagamentos WHERE comanda_id = ? ORDER BY criado_em')
    .all(comanda.id);

  await imprimirConta(comanda, itens, { subtotal, total, desconto, descontoTipo: comanda.desconto_tipo, descontoValor: comanda.desconto_valor, pagamentos }).catch((erro) => {
    console.warn('Falha ao imprimir conta:', erro.message);
    const mesa = db.prepare('SELECT numero FROM mesas WHERE id = ?').get(id);
    eventos.emitir('impressao_falhou', { setor: 'bar', mesa_numero: mesa?.numero ?? id, contexto: 'conta' });
  });

  registrar({
    usuario: req.usuario,
    acao: 'conta_impressa',
    entidade: 'mesa',
    entidadeId: Number(id),
    detalhes: { comanda_id: comanda.id, total, desconto },
  });

  res.json({ subtotal, desconto, total });
});

// POST /api/mesas/:id/reservar
router.post('/:id/reservar', exigirPapel('admin', 'garcom', 'caixa'), (req, res) => {
  const { id } = req.params;
  const { nome_cliente, telefone, horario, numero_pessoas } = req.body;

  if (!nome_cliente || !horario) {
    return res.status(400).json({ erro: 'nome_cliente e horario são obrigatórios' });
  }

  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(id);
  if (!mesa) return res.status(404).json({ erro: 'Mesa não encontrada' });

  const inserirReserva = db.prepare(
    'INSERT INTO reservas (restaurante_id, mesa_id, nome_cliente, telefone, horario, numero_pessoas) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = inserirReserva.run(mesa.restaurante_id, mesa.id, nome_cliente, telefone || null, horario, numero_pessoas || null);

  db.prepare(`UPDATE mesas SET status = 'reservada' WHERE id = ?`).run(mesa.id);

  registrar({
    usuario: req.usuario,
    acao: 'mesa_reservada',
    entidade: 'mesa',
    entidadeId: mesa.id,
    detalhes: { nome_cliente, horario },
  });

  res.status(201).json({ reserva_id: info.lastInsertRowid });
});

module.exports = router;
