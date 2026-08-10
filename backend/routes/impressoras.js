const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { exigirPapel } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

// GET /api/impressoras - lista as impressoras cadastradas
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM impressoras ORDER BY setor, nome').all());
});

// POST /api/impressoras - cadastra uma nova impressora
router.post('/', exigirPapel('admin'), (req, res) => {
  const { nome, setor, ip, porta } = req.body;
  if (!nome || !setor || !ip) {
    return res.status(400).json({ erro: 'nome, setor e ip são obrigatórios' });
  }
  if (!['cozinha', 'bar'].includes(setor)) {
    return res.status(400).json({ erro: 'setor inválido' });
  }

  const info = db
    .prepare('INSERT INTO impressoras (restaurante_id, nome, setor, ip, porta) VALUES (?, ?, ?, ?, ?)')
    .run(req.usuario.restaurante_id, nome, setor, ip, porta || 9100);

  registrar({
    usuario: req.usuario,
    acao: 'impressora_criada',
    entidade: 'impressora',
    entidadeId: info.lastInsertRowid,
    detalhes: { nome, setor, ip, porta: porta || 9100 },
  });

  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT /api/impressoras/:id - edita nome/setor/ip/porta ou ativa/desativa
router.put('/:id', exigirPapel('admin'), (req, res) => {
  const { id } = req.params;
  const { nome, setor, ip, porta, ativa } = req.body;

  const impressora = db.prepare('SELECT * FROM impressoras WHERE id = ?').get(id);
  if (!impressora) return res.status(404).json({ erro: 'Impressora não encontrada' });
  if (setor && !['cozinha', 'bar'].includes(setor)) {
    return res.status(400).json({ erro: 'setor inválido' });
  }

  db.prepare('UPDATE impressoras SET nome = ?, setor = ?, ip = ?, porta = ?, ativa = ? WHERE id = ?').run(
    nome ?? impressora.nome,
    setor ?? impressora.setor,
    ip ?? impressora.ip,
    porta ?? impressora.porta,
    ativa === undefined ? impressora.ativa : (ativa ? 1 : 0),
    id
  );

  registrar({
    usuario: req.usuario,
    acao: 'impressora_editada',
    entidade: 'impressora',
    entidadeId: Number(id),
    detalhes: { antes: impressora, depois: req.body },
  });

  res.json({ ok: true });
});

module.exports = router;
