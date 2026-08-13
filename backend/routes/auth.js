const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { SECRET, autenticar } = require('../middleware/auth');
const { registrar } = require('../services/auditoria');

// Rate limiting simples em memória — bloqueia após 10 tentativas falhas
// por IP dentro de 15 minutos (suficiente pra single-instance + SQLite).
const tentativas = new Map();
const LIMITE = 10;
const JANELA_MS = 15 * 60 * 1000;

function checarRateLimit(ip) {
  const agora = Date.now();
  const entrada = tentativas.get(ip);
  if (!entrada || agora - entrada.inicio > JANELA_MS) {
    tentativas.set(ip, { inicio: agora, contagem: 1 });
    return true;
  }
  entrada.contagem += 1;
  return entrada.contagem <= LIMITE;
}

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const agora = Date.now();
  for (const [ip, entrada] of tentativas) {
    if (agora - entrada.inicio > JANELA_MS) tentativas.delete(ip);
  }
}, 5 * 60 * 1000).unref();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checarRateLimit(ip)) {
    return res.status(429).json({ erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' });
  }
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'email e senha são obrigatórios' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash)) {
    registrar({ usuario: null, acao: 'login_falhou', entidade: 'usuario', detalhes: { email } });
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }
  if (!usuario.ativo) {
    registrar({ usuario: null, acao: 'login_bloqueado_inativo', entidade: 'usuario', entidadeId: usuario.id, detalhes: { email } });
    return res.status(403).json({ erro: 'Usuário inativo. Fale com o administrador.' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel, restaurante_id: usuario.restaurante_id },
    SECRET,
    { expiresIn: '12h' }
  );

  registrar({ usuario, acao: 'login', entidade: 'usuario', entidadeId: usuario.id });

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    deve_trocar_senha: Boolean(usuario.deve_trocar_senha),
  });
});

// POST /api/auth/trocar-senha - o próprio usuário logado troca a senha
// (obrigatório no primeiro login ou depois que o admin redefine a senha)
router.post('/trocar-senha', autenticar, (req, res) => {
  const { senha_atual, senha_nova } = req.body;
  if (!senha_atual || !senha_nova) {
    return res.status(400).json({ erro: 'senha_atual e senha_nova são obrigatórios' });
  }
  if (senha_nova.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!usuario || !bcrypt.compareSync(senha_atual, usuario.senha_hash)) {
    return res.status(401).json({ erro: 'Senha atual incorreta' });
  }

  db.prepare('UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0 WHERE id = ?')
    .run(bcrypt.hashSync(senha_nova, 10), usuario.id);

  registrar({ usuario: req.usuario, acao: 'senha_alterada', entidade: 'usuario', entidadeId: usuario.id });

  res.json({ ok: true });
});

module.exports = router;
