// Serviço de impressão térmica em rede (ESC/POS).
// Usa a lib `node-thermal-printer`, que fala com impressoras de rede via IP:porta
// (padrão 9100 para a maioria das térmicas com interface Ethernet).
const db = require('../db/database');

// Lança erro (em vez de retornar null) quando não há impressora configurada ou ela
// não responde, pra quem chama (imprimirItens/imprimirConta) conseguir tratar a
// falha via .catch() — é esse catch que alimenta o aviso de "falha de impressão".
async function conectarImpressora(setor) {
  const impressora = db
    .prepare(`SELECT * FROM impressoras WHERE setor = ? AND ativa = 1 LIMIT 1`)
    .get(setor);

  if (!impressora) {
    throw new Error(`Nenhuma impressora ativa cadastrada para o setor "${setor}"`);
  }

  // Import tardio para não quebrar o boot caso a lib ainda não esteja instalada
  const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${impressora.ip}:${impressora.porta}`,
    removeSpecialCharacters: false,
    options: { timeout: 3000 },
  });

  const conectado = await printer.isPrinterConnected().catch(() => false);
  if (!conectado) {
    throw new Error(`Impressora "${impressora.nome}" (${impressora.ip}:${impressora.porta}) não respondeu`);
  }

  return printer;
}

function buscarNumeroMesa(mesaId) {
  return db.prepare('SELECT numero FROM mesas WHERE id = ?').get(mesaId)?.numero ?? mesaId;
}

function buscarNomeRestaurante(restauranteId) {
  return db.prepare('SELECT nome FROM restaurantes WHERE id = ?').get(restauranteId)?.nome ?? '';
}

const FORMA_PAGAMENTO_LABELS = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  pix: 'PIX',
};

async function imprimirItens(setor, comanda, itens, nomeGarcom) {
  const printer = await conectarImpressora(setor);

  printer.alignCenter();
  printer.bold(true);
  printer.println(buscarNomeRestaurante(comanda.restaurante_id));
  printer.println(setor === 'cozinha' ? 'COZINHA' : 'BAR');
  printer.bold(false);
  printer.println(`Mesa ${buscarNumeroMesa(comanda.mesa_id)}${comanda.nome_cliente ? ' - ' + comanda.nome_cliente : ''}`);
  if (nomeGarcom) printer.println(`Garçom: ${nomeGarcom}`);
  printer.drawLine();
  printer.alignLeft();

  itens.forEach((item) => {
    printer.println(`${item.quantidade}x ${item.produto_nome}`);
  });

  printer.cut();

  await printer.execute();
}

// Imprime a pré-conta da mesa (não é documento fiscal, não envolve pagamento).
// Sai por padrão na impressora do bar.
async function imprimirConta(comanda, itens, valores) {
  const printer = await conectarImpressora('bar');

  const { subtotal, total, desconto, descontoTipo, descontoValor, pagamentos } = valores;

  printer.alignCenter();
  printer.bold(true);
  printer.println(buscarNomeRestaurante(comanda.restaurante_id));
  printer.println('PRÉ-CONTA');
  printer.bold(false);
  printer.println(`Mesa ${buscarNumeroMesa(comanda.mesa_id)}${comanda.nome_cliente ? ' - ' + comanda.nome_cliente : ''}`);
  printer.drawLine();
  printer.alignLeft();

  itens.forEach((item) => {
    printer.println(`${item.quantidade}x ${item.produto_nome}`);
    printer.println(`   R$ ${(item.quantidade * item.preco_unitario).toFixed(2)}`);
  });

  printer.drawLine();
  printer.println(`Subtotal: R$ ${subtotal.toFixed(2)}`);
  if (desconto > 0) {
    const label = descontoTipo === 'percentual' ? `Desconto (${descontoValor}%)` : 'Desconto';
    printer.println(`${label}: -R$ ${desconto.toFixed(2)}`);
  }
  printer.bold(true);
  printer.println(`Total: R$ ${total.toFixed(2)}`);
  printer.bold(false);

  if (pagamentos && pagamentos.length) {
    printer.drawLine();
    printer.println(pagamentos.length > 1 ? 'Pagamento (dividido):' : 'Forma de pagamento:');
    pagamentos.forEach((p) => {
      const label = FORMA_PAGAMENTO_LABELS[p.forma_pagamento] || p.forma_pagamento;
      printer.println(`  ${label}: R$ ${p.valor.toFixed(2)}`);
    });
  }

  printer.drawLine();
  printer.alignCenter();
  printer.println('Não é documento fiscal');
  printer.cut();

  await printer.execute();
}

module.exports = { imprimirItens, imprimirConta };
