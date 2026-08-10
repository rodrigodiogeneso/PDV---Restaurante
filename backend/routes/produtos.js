const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { exigirPapel } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

// GET /api/produtos - lista produtos (só ativos, a menos que ?incluirInativos=1)
router.get('/', (req, res) => {
  const incluirInativos = req.query.incluirInativos === '1';
  const produtos = db
    .prepare(
      `SELECT p.*, c.nome AS categoria_nome
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ${incluirInativos ? '' : 'WHERE p.ativo = 1'}
       ORDER BY c.nome, p.nome`
    )
    .all();
  res.json(produtos);
});

// GET /api/produtos/categorias
router.get('/categorias', (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY nome').all();
  res.json(categorias);
});

// POST /api/produtos/categorias
router.post('/categorias', exigirPapel('admin'), (req, res) => {
  const { restaurante_id, nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome é obrigatório' });

  const info = db
    .prepare('INSERT INTO categorias (restaurante_id, nome) VALUES (?, ?)')
    .run(req.usuario.restaurante_id || restaurante_id || 1, nome);

  registrar({ usuario: req.usuario, acao: 'categoria_criada', entidade: 'categoria', entidadeId: info.lastInsertRowid, detalhes: { nome } });

  res.status(201).json({ id: info.lastInsertRowid });
});

// POST /api/produtos
router.post('/', exigirPapel('admin'), (req, res) => {
  const { restaurante_id, categoria_id, nome, preco, setor_impressao } = req.body;
  if (!nome || !preco || !setor_impressao) {
    return res.status(400).json({ erro: 'nome, preco e setor_impressao são obrigatórios' });
  }
  const info = db
    .prepare(
      'INSERT INTO produtos (restaurante_id, categoria_id, nome, preco, setor_impressao) VALUES (?, ?, ?, ?, ?)'
    )
    .run(req.usuario.restaurante_id || restaurante_id || 1, categoria_id || null, nome, preco, setor_impressao);

  registrar({ usuario: req.usuario, acao: 'produto_criado', entidade: 'produto', entidadeId: info.lastInsertRowid, detalhes: { nome, preco } });

  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT /api/produtos/:id - edita produto ou ativa/desativa (soft delete)
router.put('/:id', exigirPapel('admin'), (req, res) => {
  const { id } = req.params;
  const { nome, preco, categoria_id, setor_impressao, ativo } = req.body;

  const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
  if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

  db.prepare(
    `UPDATE produtos SET nome = ?, preco = ?, categoria_id = ?, setor_impressao = ?, ativo = ? WHERE id = ?`
  ).run(
    nome ?? produto.nome,
    preco ?? produto.preco,
    categoria_id === undefined ? produto.categoria_id : categoria_id,
    setor_impressao ?? produto.setor_impressao,
    ativo === undefined ? produto.ativo : (ativo ? 1 : 0),
    id
  );

  registrar({
    usuario: req.usuario,
    acao: 'produto_editado',
    entidade: 'produto',
    entidadeId: Number(id),
    detalhes: { antes: produto, depois: req.body },
  });

  res.json({ ok: true });
});

module.exports = router;
