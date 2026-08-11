const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { exigirPapel } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

function buscarSessaoAberta(restauranteId) {
  return db
    .prepare(`SELECT * FROM caixa_sessoes WHERE restaurante_id = ? AND status = 'aberto' ORDER BY id DESC LIMIT 1`)
    .get(restauranteId);
}

// Soma os pagamentos por forma, entre a abertura da sessão e o instante informado (ou agora)
function calcularResumo(sessao, ateData) {
  const porFormaPagamento = db
    .prepare(
      `SELECT p.forma_pagamento, SUM(p.valor) AS total
       FROM pagamentos p
       JOIN comandas c ON c.id = p.comanda_id
       WHERE c.restaurante_id = ? AND p.criado_em >= ? AND p.criado_em <= ?
       GROUP BY p.forma_pagamento`
    )
    .all(sessao.restaurante_id, sessao.aberto_em, ateData);

  const totalGeral = porFormaPagamento.reduce((soma, linha) => soma + linha.total, 0);
  return { porFormaPagamento, totalGeral };
}

// GET /api/caixa/atual - sessão de caixa aberta no momento, se houver
router.get('/atual', (req, res) => {
  const sessao = buscarSessaoAberta(req.usuario.restaurante_id);
  res.json({ sessao: sessao || null });
});

// GET /api/caixa/resumo - vendas acumuladas na sessão aberta (pra caixa acompanhar/prestar contas)
router.get('/resumo', exigirPapel('admin', 'caixa'), (req, res) => {
  const sessao = buscarSessaoAberta(req.usuario.restaurante_id);
  if (!sessao) return res.status(400).json({ erro: 'Não há caixa aberto' });

  const agora = db.prepare('SELECT CURRENT_TIMESTAMP AS agora').get().agora;
  res.json({ sessao, resumo: calcularResumo(sessao, agora) });
});

// POST /api/caixa/abrir - abre o caixa do dia com o valor inicial em espécie
router.post('/abrir', exigirPapel('admin', 'caixa'), (req, res) => {
  const { valor_abertura } = req.body;
  if (valor_abertura === undefined || valor_abertura === null || valor_abertura < 0) {
    return res.status(400).json({ erro: 'Informe o valor de abertura do caixa' });
  }

  if (buscarSessaoAberta(req.usuario.restaurante_id)) {
    return res.status(400).json({ erro: 'Já existe um caixa aberto' });
  }

  const info = db
    .prepare('INSERT INTO caixa_sessoes (restaurante_id, usuario_id, valor_abertura) VALUES (?, ?, ?)')
    .run(req.usuario.restaurante_id, req.usuario.id, valor_abertura);

  registrar({
    usuario: req.usuario,
    acao: 'caixa_aberto',
    entidade: 'caixa_sessao',
    entidadeId: info.lastInsertRowid,
    detalhes: { valor_abertura },
  });

  const sessao = db.prepare('SELECT * FROM caixa_sessoes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ sessao });
});

// POST /api/caixa/fechar - fecha o caixa aberto e devolve o resumo de vendas do turno
router.post('/fechar', exigirPapel('admin', 'caixa'), (req, res) => {
  const sessao = buscarSessaoAberta(req.usuario.restaurante_id);
  if (!sessao) return res.status(400).json({ erro: 'Não há caixa aberto' });

  const mesasAbertas = db
    .prepare(`SELECT COUNT(*) AS total FROM mesas WHERE restaurante_id = ? AND status = 'ocupada'`)
    .get(req.usuario.restaurante_id).total;
  if (mesasAbertas > 0) {
    return res.status(400).json({
      erro: `Ainda há ${mesasAbertas} mesa${mesasAbertas > 1 ? 's' : ''} aberta${mesasAbertas > 1 ? 's' : ''}. Feche todas as mesas antes de fechar o caixa.`,
    });
  }

  db.prepare(`UPDATE caixa_sessoes SET status = 'fechado', fechado_em = CURRENT_TIMESTAMP WHERE id = ?`).run(sessao.id);
  const sessaoFechada = db.prepare('SELECT * FROM caixa_sessoes WHERE id = ?').get(sessao.id);
  const resumo = calcularResumo(sessaoFechada, sessaoFechada.fechado_em);

  registrar({
    usuario: req.usuario,
    acao: 'caixa_fechado',
    entidade: 'caixa_sessao',
    entidadeId: sessao.id,
    detalhes: { valor_abertura: sessao.valor_abertura, total_geral: resumo.totalGeral, por_forma_pagamento: resumo.porFormaPagamento },
  });

  res.json({ sessao: sessaoFechada, resumo });
});

module.exports = router;
