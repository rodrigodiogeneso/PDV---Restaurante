const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, login } = require('./helpers');

test('fluxo completo: abrir mesa, lançar pedido e remover item (só caixa/admin)', async () => {
  const tokenAdmin = await login(request, 'admin@restaurante.local');
  const tokenGarcom = await login(request, 'garcom@restaurante.local');
  const tokenCaixa = await login(request, 'caixa@restaurante.local');

  const resProduto = await request(app)
    .post('/api/produtos')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ nome: 'Suco de laranja', preco: 10, setor_impressao: 'bar' });
  assert.equal(resProduto.status, 201);
  const produtoId = resProduto.body.id;

  const resMesas = await request(app).get('/api/mesas').set('Authorization', `Bearer ${tokenGarcom}`);
  const mesaId = resMesas.body[0].id;

  const resAbrir = await request(app)
    .post(`/api/mesas/${mesaId}/abrir`)
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ nome_cliente: 'Mesa de teste' });
  assert.equal(resAbrir.status, 201);
  const comandaId = resAbrir.body.comanda_id;

  const resPedido = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ comanda_id: comandaId, itens: [{ produto_id: produtoId, quantidade: 3 }] });
  assert.equal(resPedido.status, 201);
  const itemId = resPedido.body.itens[0].id;

  const resCancelGarcom = await request(app)
    .delete(`/api/pedidos/itens/${itemId}`)
    .set('Authorization', `Bearer ${tokenGarcom}`);
  assert.equal(resCancelGarcom.status, 403);

  const resCancelCaixa = await request(app)
    .delete(`/api/pedidos/itens/${itemId}`)
    .set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(resCancelCaixa.status, 200);

  const itensRestantes = await request(app)
    .get(`/api/pedidos/comanda/${comandaId}`)
    .set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(itensRestantes.body.find((i) => i.id === itemId), undefined);
});

test('garçom não pode cadastrar produto (rota exclusiva do admin)', async () => {
  const tokenGarcom = await login(request, 'garcom@restaurante.local');
  const res = await request(app)
    .post('/api/produtos')
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ nome: 'Item qualquer', preco: 5, setor_impressao: 'bar' });
  assert.equal(res.status, 403);
});
