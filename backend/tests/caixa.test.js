const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, login } = require('./helpers');

test('fluxo de caixa: abrir, registrar venda, ver resumo e fechar', async () => {
  const tokenCaixa = await login(request, 'caixa@restaurante.local');
  const tokenGarcom = await login(request, 'garcom@restaurante.local');

  const semCaixa = await request(app).get('/api/caixa/atual').set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(semCaixa.body.sessao, null);

  const abrir = await request(app)
    .post('/api/caixa/abrir')
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ valor_abertura: 100 });
  assert.equal(abrir.status, 201);
  assert.equal(abrir.body.sessao.valor_abertura, 100);

  const abrirDeNovo = await request(app)
    .post('/api/caixa/abrir')
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ valor_abertura: 50 });
  assert.equal(abrirDeNovo.status, 400);

  const resProduto = await request(app)
    .post('/api/produtos')
    .set('Authorization', `Bearer ${await login(request, 'admin@restaurante.local')}`)
    .send({ nome: 'Item teste caixa', preco: 30, setor_impressao: 'bar' });
  const produtoId = resProduto.body.id;

  const resMesas = await request(app).get('/api/mesas').set('Authorization', `Bearer ${tokenGarcom}`);
  const mesaId = resMesas.body[0].id;
  const abrirMesa = await request(app)
    .post(`/api/mesas/${mesaId}/abrir`)
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ nome_cliente: 'Teste caixa' });
  const comandaId = abrirMesa.body.comanda_id;

  await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ comanda_id: comandaId, itens: [{ produto_id: produtoId, quantidade: 1 }] });

  const pagamento = await request(app)
    .post(`/api/mesas/${mesaId}/pagamento`)
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ forma_pagamento: 'pix', valor: 30 });
  assert.equal(pagamento.status, 201);

  const resumo = await request(app).get('/api/caixa/resumo').set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(resumo.status, 200);
  assert.equal(resumo.body.resumo.totalGeral, 30);
  assert.equal(resumo.body.resumo.porFormaPagamento[0].forma_pagamento, 'pix');

  const fechar = await request(app).post('/api/caixa/fechar').set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(fechar.status, 200);
  assert.equal(fechar.body.sessao.status, 'fechado');
  assert.equal(fechar.body.resumo.totalGeral, 30);

  const semCaixaDeNovo = await request(app).get('/api/caixa/atual').set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(semCaixaDeNovo.body.sessao, null);
});
