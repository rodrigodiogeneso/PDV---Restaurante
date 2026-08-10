const jwt = require('jsonwebtoken');

const PLACEHOLDERS = ['dev-secret-troque-em-producao', 'troque-este-valor-em-producao', 'gere-uma-string-forte-aqui'];

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || PLACEHOLDERS.includes(process.env.JWT_SECRET))) {
  throw new Error('JWT_SECRET não configurado (ou usando valor de exemplo) em produção. Defina uma string forte e única na variável de ambiente JWT_SECRET.');
}

const SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao';

// Exige um Bearer token válido; anexa os dados do usuário em req.usuario
function autenticar(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token ausente' });

  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// Restringe a rota a papéis específicos (usar depois de `autenticar`)
function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!papeis.includes(req.usuario?.papel)) {
      return res.status(403).json({ erro: 'Sem permissão para esta ação' });
    }
    next();
  };
}

module.exports = { autenticar, exigirPapel, SECRET };
