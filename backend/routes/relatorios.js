const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { exigirPapel } = require('../middleware/auth');

router.use(exigirPapel('admin', 'caixa'));

// GET /api/relatorios/vendas?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
// Baseado em comandas fechadas no período (venda "de verdade", concluída).
router.get('/vendas', (req, res) => {
  // SQLite grava em UTC; pra agrupar por dia correto em BRT (UTC-3),
  // converte com datetime(..., '-3 hours') antes de extrair date().
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = req.query.inicio || hoje;
  const fim = req.query.fim || hoje;

  const porDia = db
    .prepare(
      `SELECT date(datetime(c.fechada_em, '-3 hours')) AS data,
              SUM(ip.quantidade * ip.preco_unitario) AS total,
              COUNT(DISTINCT c.id) AS comandas
       FROM comandas c
       JOIN pedidos p ON p.comanda_id = c.id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.status != 'cancelado'
       WHERE c.status = 'fechada' AND date(datetime(c.fechada_em, '-3 hours')) BETWEEN ? AND ?
       GROUP BY date(datetime(c.fechada_em, '-3 hours'))
       ORDER BY data`
    )
    .all(inicio, fim);

  const porProduto = db
    .prepare(
      `SELECT pr.nome AS produto_nome,
              SUM(ip.quantidade) AS quantidade,
              SUM(ip.quantidade * ip.preco_unitario) AS total
       FROM comandas c
       JOIN pedidos p ON p.comanda_id = c.id
       JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.status != 'cancelado'
       JOIN produtos pr ON pr.id = ip.produto_id
       WHERE c.status = 'fechada' AND date(datetime(c.fechada_em, '-3 hours')) BETWEEN ? AND ?
       GROUP BY pr.id
       ORDER BY total DESC
       LIMIT 15`
    )
    .all(inicio, fim);

  // Quebra por forma de pagamento — vem da tabela pagamentos (suporta contas divididas)
  const porFormaPagamento = db
    .prepare(
      `SELECT pg.forma_pagamento, COUNT(*) AS quantidade_pagamentos, SUM(pg.valor) AS total
       FROM pagamentos pg
       JOIN comandas c ON c.id = pg.comanda_id
       WHERE c.status = 'fechada' AND date(datetime(c.fechada_em, '-3 hours')) BETWEEN ? AND ?
       GROUP BY pg.forma_pagamento
       ORDER BY total DESC`
    )
    .all(inicio, fim);

  // Total de descontos concedidos no período
  const descontoInfo = db
    .prepare(
      `SELECT COUNT(*) AS comandas_com_desconto,
              SUM(
                CASE
                  WHEN c.desconto_tipo = 'percentual' THEN sub.total * (c.desconto_valor / 100.0)
                  WHEN c.desconto_tipo = 'valor' THEN c.desconto_valor
                  ELSE 0
                END
              ) AS total_descontos
       FROM comandas c
       JOIN (
         SELECT p.comanda_id, SUM(ip.quantidade * ip.preco_unitario) AS total
         FROM pedidos p
         JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.status != 'cancelado'
         GROUP BY p.comanda_id
       ) sub ON sub.comanda_id = c.id
       WHERE c.status = 'fechada' AND c.desconto_valor > 0
         AND date(datetime(c.fechada_em, '-3 hours')) BETWEEN ? AND ?`
    )
    .get(inicio, fim);

  const totalVendido = porDia.reduce((soma, dia) => soma + dia.total, 0);
  const totalComandas = porDia.reduce((soma, dia) => soma + dia.comandas, 0);
  const ticketMedio = totalComandas > 0 ? totalVendido / totalComandas : 0;
  const totalDescontos = descontoInfo?.total_descontos || 0;
  const totalLiquido = totalVendido - totalDescontos;

  res.json({
    periodo: { inicio, fim },
    resumo: { totalVendido, totalDescontos, totalLiquido, totalComandas, ticketMedio },
    porDia,
    porProduto,
    porFormaPagamento,
  });
});

module.exports = router;

// Helper CSV: escapa aspas e junta com ;  (padrão Excel BR)
function paraCSV(linhas) {
  return linhas
    .map((linha) => linha.map((celula) => `"${String(celula ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
}

// GET /api/relatorios/vendas/csv?inicio=&fim= - exporta o resumo em CSV
router.get('/vendas/csv', (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = req.query.inicio || hoje;
  const fim = req.query.fim || hoje;

  const comandas = db
    .prepare(
      `SELECT c.id, m.numero AS mesa, c.nome_cliente, c.forma_pagamento,
              c.desconto_tipo, c.desconto_valor,
              datetime(c.fechada_em, '-3 hours') AS fechada_em,
              sub.total AS subtotal
       FROM comandas c
       JOIN mesas m ON m.id = c.mesa_id
       JOIN (
         SELECT p.comanda_id, SUM(ip.quantidade * ip.preco_unitario) AS total
         FROM pedidos p
         JOIN itens_pedido ip ON ip.pedido_id = p.id AND ip.status != 'cancelado'
         GROUP BY p.comanda_id
       ) sub ON sub.comanda_id = c.id
       WHERE c.status = 'fechada' AND date(datetime(c.fechada_em, '-3 hours')) BETWEEN ? AND ?
       ORDER BY c.fechada_em`
    )
    .all(inicio, fim);

  const linhas = [
    ['Comanda', 'Mesa', 'Cliente', 'Fechada em', 'Subtotal', 'Desconto', 'Total', 'Forma de pagamento'],
  ];
  for (const c of comandas) {
    const desconto = c.desconto_valor > 0
      ? (c.desconto_tipo === 'percentual' ? c.subtotal * (c.desconto_valor / 100) : c.desconto_valor)
      : 0;
    linhas.push([
      c.id,
      c.mesa,
      c.nome_cliente || '',
      c.fechada_em,
      c.subtotal.toFixed(2).replace('.', ','),
      desconto.toFixed(2).replace('.', ','),
      (c.subtotal - desconto).toFixed(2).replace('.', ','),
      c.forma_pagamento || '',
    ]);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vendas_${inicio}_${fim}.csv"`);
  res.send('\uFEFF' + paraCSV(linhas)); // BOM pra Excel abrir acentos corretamente
});

// GET /api/relatorios/pagamentos/csv?inicio=&fim= - uma linha por pagamento (útil pra conferir o caixa)
router.get('/pagamentos/csv', (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = req.query.inicio || hoje;
  const fim = req.query.fim || hoje;

  const pagamentos = db
    .prepare(
      `SELECT pg.id, m.numero AS mesa, c.nome_cliente, pg.forma_pagamento, pg.valor,
              datetime(pg.criado_em, '-3 hours') AS quando
       FROM pagamentos pg
       JOIN comandas c ON c.id = pg.comanda_id
       JOIN mesas m ON m.id = c.mesa_id
       WHERE c.status = 'fechada' AND date(datetime(c.fechada_em, '-3 hours')) BETWEEN ? AND ?
       ORDER BY pg.criado_em`
    )
    .all(inicio, fim);

  const linhas = [['Pagamento', 'Mesa', 'Cliente', 'Forma', 'Valor', 'Quando']];
  for (const p of pagamentos) {
    linhas.push([p.id, p.mesa, p.nome_cliente || '', p.forma_pagamento, p.valor.toFixed(2).replace('.', ','), p.quando]);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pagamentos_${inicio}_${fim}.csv"`);
  res.send('\uFEFF' + paraCSV(linhas));
});
