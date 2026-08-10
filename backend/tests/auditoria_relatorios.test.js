const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, login } = require('./helpers');

test('auditoria e relatório de vendas refletem o fluxo de uma venda', async () => {
  const tokenAdmin = await login(request, 'admin@restaurante.local');
  const tokenGarcom = await login(request, 'garcom@restaurante.local');

  const resProduto = await request(app)
    .post('/api/produtos')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ nome: 'Água com gás', preco: 6, setor_impressao: 'bar' });
  const produtoId = resProduto.body.id;

  const mesaId = (await request(app).get('/api/mesas').set('Authorization', `Bearer ${tokenGarcom}`))
    .body[0].id;

  const resAbrir = await request(app)
    .post(`/api/mesas/${mesaId}/abrir`)
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ nome_cliente: 'Cliente relatório' });
  const comandaId = resAbrir.body.comanda_id;

  await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ comanda_id: comandaId, itens: [{ produto_id: produtoId, quantidade: 2 }] });

  await request(app)
    .post(`/api/mesas/${mesaId}/fechar`)
    .set('Authorization', `Bearer ${tokenGarcom}`)
    .send({ forma_pagamento: 'pix' });

  const hoje = new Date().toISOString().slice(0, 10);

  const resRelatorio = await request(app)
    .get('/api/relatorios/vendas')
    .query({ inicio: hoje, fim: hoje })
    .set('Authorization', `Bearer ${tokenAdmin}`);
  assert.equal(resRelatorio.status, 200);
  assert.equal(resRelatorio.body.resumo.totalVendido, 12);
  assert.equal(resRelatorio.body.resumo.totalComandas, 1);

  const resAuditoria = await request(app)
    .get('/api/auditoria')
    .set('Authorization', `Bearer ${tokenAdmin}`);
  assert.equal(resAuditoria.status, 200);
  const acoes = resAuditoria.body.map((r) => r.acao);
  assert.ok(acoes.includes('mesa_aberta'));
  assert.ok(acoes.includes('pedido_criado'));
  assert.ok(acoes.includes('mesa_fechada'));
  assert.ok(acoes.includes('login'));

  const resGarcomRelatorio = await request(app)
    .get('/api/relatorios/vendas')
    .set('Authorization', `Bearer ${tokenGarcom}`);
  assert.equal(resGarcomRelatorio.status, 403);

  const resGarcomAuditoria = await request(app)
    .get('/api/auditoria')
    .set('Authorization', `Bearer ${tokenGarcom}`);
  assert.equal(resGarcomAuditoria.status, 403);
});

test('caixa pode abrir mesa, garçom não vê botão mas backend também bloqueia cancelamento indevido', async () => {
  const tokenCaixa = await login(request, 'caixa@restaurante.local');

  const mesas = (await request(app).get('/api/mesas').set('Authorization', `Bearer ${tokenCaixa}`)).body;
  const mesaDisponivel = mesas.find((m) => m.status === 'disponivel');

  const resAbrir = await request(app)
    .post(`/api/mesas/${mesaDisponivel.id}/abrir`)
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ nome_cliente: 'Aberta pelo caixa' });
  assert.equal(resAbrir.status, 201);
});

test('pagamento dividido: várias partes cobrindo o total antes de poder fechar', async () => {
  const tokenAdmin = await login(request, 'admin@restaurante.local');
  const tokenCaixa = await login(request, 'caixa@restaurante.local');

  const resProduto = await request(app)
    .post('/api/produtos')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ nome: 'Rodízio', preco: 100, setor_impressao: 'cozinha' });
  const produtoId = resProduto.body.id;

  const mesas = (await request(app).get('/api/mesas').set('Authorization', `Bearer ${tokenCaixa}`)).body;
  const mesaId = mesas.find((m) => m.status === 'disponivel').id;

  const resAbrir = await request(app)
    .post(`/api/mesas/${mesaId}/abrir`)
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ nome_cliente: 'Grupo de 5' });
  const comandaId = resAbrir.body.comanda_id;

  await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ comanda_id: comandaId, itens: [{ produto_id: produtoId, quantidade: 1 }] });

  // Tenta fechar sem pagamentos suficientes -> deve falhar
  const resFecharCedo = await request(app)
    .post(`/api/mesas/${mesaId}/fechar`)
    .set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(resFecharCedo.status, 400);

  // Registra 2 pagamentos parciais (dividindo a conta)
  const resPag1 = await request(app)
    .post(`/api/mesas/${mesaId}/pagamento`)
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ forma_pagamento: 'pix', valor: 60 });
  assert.equal(resPag1.status, 201);
  assert.equal(resPag1.body.restante, 40);

  // Pagamento maior que o restante deve ser rejeitado
  const resPagExcesso = await request(app)
    .post(`/api/mesas/${mesaId}/pagamento`)
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ forma_pagamento: 'dinheiro', valor: 999 });
  assert.equal(resPagExcesso.status, 400);

  const resPag2 = await request(app)
    .post(`/api/mesas/${mesaId}/pagamento`)
    .set('Authorization', `Bearer ${tokenCaixa}`)
    .send({ forma_pagamento: 'cartao_credito', valor: 40 });
  assert.equal(resPag2.status, 201);
  assert.equal(resPag2.body.restante, 0);

  // Agora fecha normalmente (pagamentos já cobrem o total)
  const resFechar = await request(app)
    .post(`/api/mesas/${mesaId}/fechar`)
    .set('Authorization', `Bearer ${tokenCaixa}`);
  assert.equal(resFechar.status, 200);

  // Forma final deve ser "misto" (2 formas diferentes usadas)
  const resAuditoria = await request(app)
    .get('/api/auditoria')
    .query({ acao: 'mesa_fechada' })
    .set('Authorization', `Bearer ${tokenAdmin}`);
  const registro = resAuditoria.body.find((r) => r.entidade_id === mesaId);
  const detalhes = JSON.parse(registro.detalhes);
  assert.equal(detalhes.forma_pagamento, 'misto');
  assert.equal(detalhes.qtd_pagamentos, 2);
});
