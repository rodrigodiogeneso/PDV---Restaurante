const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { exigirPapel } = require('../middleware/auth');

router.use(exigirPapel('admin'));

// GET /api/auditoria?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&acao=...&usuario_id=...&limite=200
router.get('/', (req, res) => {
  const { inicio, fim, acao, usuario_id } = req.query;
  const condicoes = [];
  const params = [];

  if (inicio) {
    condicoes.push('date(criado_em) >= ?');
    params.push(inicio);
  }
  if (fim) {
    condicoes.push('date(criado_em) <= ?');
    params.push(fim);
  }
  if (acao) {
    condicoes.push('acao = ?');
    params.push(acao);
  }
  if (usuario_id) {
    condicoes.push('usuario_id = ?');
    params.push(usuario_id);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const limite = Math.min(Number(req.query.limite) || 200, 500);

  const registros = db
    .prepare(`SELECT * FROM auditoria ${where} ORDER BY criado_em DESC LIMIT ?`)
    .all(...params, limite);

  res.json(registros);
});

// GET /api/auditoria/acoes - lista de ações distintas já registradas (pra popular o filtro)
router.get('/acoes', (req, res) => {
  const acoes = db.prepare('SELECT DISTINCT acao FROM auditoria ORDER BY acao').all();
  res.json(acoes.map((a) => a.acao));
});

// GET /api/auditoria/csv?inicio=&fim=&acao=&usuario_id= - exporta em CSV
router.get('/csv', (req, res) => {
  const { inicio, fim, acao, usuario_id } = req.query;
  const condicoes = [];
  const params = [];

  if (inicio) { condicoes.push(`date(datetime(criado_em, '-3 hours')) >= ?`); params.push(inicio); }
  if (fim) { condicoes.push(`date(datetime(criado_em, '-3 hours')) <= ?`); params.push(fim); }
  if (acao) { condicoes.push('acao = ?'); params.push(acao); }
  if (usuario_id) { condicoes.push('usuario_id = ?'); params.push(usuario_id); }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const registros = db
    .prepare(`SELECT datetime(criado_em, '-3 hours') AS quando, usuario_nome, acao, entidade, entidade_id, detalhes
              FROM auditoria ${where} ORDER BY criado_em DESC LIMIT 5000`)
    .all(...params);

  const linhas = [['Quando', 'Usuário', 'Ação', 'Entidade', 'ID', 'Detalhes']];
  for (const r of registros) {
    linhas.push([r.quando, r.usuario_nome || '', r.acao, r.entidade || '', r.entidade_id || '', r.detalhes || '']);
  }

  const csv = linhas
    .map((linha) => linha.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="auditoria.csv"`);
  res.send('\uFEFF' + csv);
});

module.exports = router;
