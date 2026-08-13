const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { exigirPapel } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

const PAPEIS_VALIDOS = ['admin', 'garcom', 'cozinha', 'bar', 'caixa'];

router.use(exigirPapel('admin'));

// GET /api/usuarios
router.get('/', (req, res) => {
  const usuarios = db
    .prepare('SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY ativo DESC, nome')
    .all();
  res.json(usuarios);
});

// POST /api/usuarios
router.post('/', (req, res) => {
  const { restaurante_id, nome, email, senha, papel } = req.body;
  if (!nome || !email || !senha || !papel) {
    return res.status(400).json({ erro: 'nome, email, senha e papel são obrigatórios' });
  }
  if (!PAPEIS_VALIDOS.includes(papel)) {
    return res.status(400).json({ erro: 'papel inválido' });
  }

  try {
    const info = db
      .prepare(
        'INSERT INTO usuarios (restaurante_id, nome, email, senha_hash, papel, deve_trocar_senha) VALUES (?, ?, ?, ?, ?, 1)'
      )
      .run(req.usuario.restaurante_id || restaurante_id || 1, nome, email.trim().toLowerCase(), bcrypt.hashSync(senha, 10), papel);

    registrar({ usuario: req.usuario, acao: 'usuario_criado', entidade: 'usuario', entidadeId: info.lastInsertRowid, detalhes: { nome, email, papel } });

    res.status(201).json({ id: info.lastInsertRowid });
  } catch (erro) {
    if (erro.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail' });
    }
    throw erro;
  }
});

// PUT /api/usuarios/:id - edita nome/papel e, opcionalmente, a senha
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nome, papel, senha, ativo } = req.body;

  if (ativo !== undefined && Number(id) === req.usuario.id && !ativo) {
    return res.status(400).json({ erro: 'Você não pode inativar seu próprio usuário' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  if (papel && !PAPEIS_VALIDOS.includes(papel)) {
    return res.status(400).json({ erro: 'papel inválido' });
  }

  db.prepare('UPDATE usuarios SET nome = ?, papel = ?, senha_hash = ?, deve_trocar_senha = ?, ativo = ? WHERE id = ?').run(
    nome ?? usuario.nome,
    papel ?? usuario.papel,
    senha ? bcrypt.hashSync(senha, 10) : usuario.senha_hash,
    senha ? 1 : usuario.deve_trocar_senha,
    ativo !== undefined ? Number(Boolean(ativo)) : usuario.ativo,
    id
  );

  registrar({
    usuario: req.usuario,
    acao: ativo !== undefined && Number(ativo) !== usuario.ativo
      ? (ativo ? 'usuario_ativado' : 'usuario_inativado')
      : 'usuario_editado',
    entidade: 'usuario',
    entidadeId: Number(id),
    detalhes: { nome: nome ?? usuario.nome, papel: papel ?? usuario.papel, senhaAlterada: Boolean(senha) },
  });

  res.json({ ok: true });
});

// DELETE /api/usuarios/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode remover seu próprio usuário' });
  }
  const usuario = db.prepare('SELECT nome, email FROM usuarios WHERE id = ?').get(id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

  try {
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  } catch (erro) {
    if (erro.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return res.status(400).json({
        erro: 'Não é possível remover este usuário: ele possui histórico vinculado (vendas, caixa ou auditoria). Você pode trocar a senha dele em vez de removê-lo.',
      });
    }
    throw erro;
  }

  registrar({ usuario: req.usuario, acao: 'usuario_removido', entidade: 'usuario', entidadeId: Number(id), detalhes: usuario });

  res.json({ ok: true });
});

module.exports = router;
