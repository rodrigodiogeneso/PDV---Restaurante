const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { SECRET } = require('../middleware/auth');
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

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash)) {
    registrar({ usuario: null, acao: 'login_falhou', entidade: 'usuario', detalhes: { email } });
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel, restaurante_id: usuario.restaurante_id },
    SECRET,
    { expiresIn: '12h' }
  );

  registrar({ usuario, acao: 'login', entidade: 'usuario', entidadeId: usuario.id });

  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel } });
});

module.exports = router;
