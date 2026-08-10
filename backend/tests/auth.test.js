const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, login } = require('./helpers');

test('login com credenciais corretas retorna token e dados do usuário', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@restaurante.local', senha: 'admin123' });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.usuario.papel, 'admin');
});

test('login com senha errada retorna 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@restaurante.local', senha: 'errada' });

  assert.equal(res.status, 401);
});

test('rota protegida sem token retorna 401', async () => {
  const res = await request(app).get('/api/mesas');
  assert.equal(res.status, 401);
});

test('rota protegida com token válido retorna 200', async () => {
  const token = await login(request, 'admin@restaurante.local');
  const res = await request(app).get('/api/mesas').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
});
