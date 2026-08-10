// Cada arquivo de teste roda em um processo separado (padrão do node --test),
// então isolar o banco em memória aqui é suficiente: nunca toca no pdv.db real.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const app = require('../app');

const SENHAS = {
  'admin@restaurante.local': 'admin123',
  'garcom@restaurante.local': '123456',
  'caixa@restaurante.local': '123456',
  'cozinha@restaurante.local': '123456',
  'bar@restaurante.local': '123456',
};

async function login(request, email) {
  const res = await request(app).post('/api/auth/login').send({ email, senha: SENHAS[email] });
  return res.body.token;
}

module.exports = { app, login };
