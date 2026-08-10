// Importa o cardápio real do Restaurante Rancho Alegre a partir do relatório de
// produtos do sistema anterior (insert.pdf). Preço usado: PREÇO VENDA.
// Não importados: TAXA DE SERVIÇO / TAXA DE COUVERT (o sistema já calcula 10% na
// pré-conta) e linhas de controle sem preço real.
// Setor de impressão: cozinha = precisa de preparo; bar = servido pronto (bebidas,
// drinques, sorvetes) ou não-alimentício (serviços).
const db = require('../db/database');

const RESTAURANTE_ID = 1;

db.prepare('UPDATE restaurantes SET nome = ? WHERE id = ?').run('Restaurante Rancho Alegre', RESTAURANTE_ID);

// Produtos demo do seed inicial — desativados, não apagados, pra não sumir do
// histórico de vendas/auditoria se já tiverem sido usados em testes.
db.prepare(
  `UPDATE produtos SET ativo = 0 WHERE restaurante_id = ? AND nome IN ('Picanha grelhada','Risoto de funghi','Caipirinha','Cerveja long neck')`
).run(RESTAURANTE_ID);

const CATEGORIAS = ['Pratos', 'Bebidas', 'Drinques e Doses', 'Petiscos', 'Porções Extras', 'Sorvetes e Picolés', 'Serviços'];

const buscarCategoria = db.prepare('SELECT id FROM categorias WHERE restaurante_id = ? AND nome = ?');
const criarCategoria = db.prepare('INSERT INTO categorias (restaurante_id, nome) VALUES (?, ?)');

const categoriaId = {};
for (const nome of CATEGORIAS) {
  const existente = buscarCategoria.get(RESTAURANTE_ID, nome);
  categoriaId[nome] = existente ? existente.id : criarCategoria.run(RESTAURANTE_ID, nome).lastInsertRowid;
}

// [nome, preço venda, categoria, setor]
const PRODUTOS = [
  ['Galinha Sertaneja', 130.0, 'Pratos', 'cozinha'],
  ['Skol 600', 12.0, 'Bebidas', 'bar'],
  ['Devassa 600', 10.0, 'Bebidas', 'bar'],
  ['Heineken Long Neck', 10.0, 'Bebidas', 'bar'],
  ['Refrigerante 1L', 10.0, 'Bebidas', 'bar'],
  ['Refrigerante Lata', 5.0, 'Bebidas', 'bar'],
  ['Água Mineral C/Gás', 3.5, 'Bebidas', 'bar'],
  ['Água Mineral S/Gás', 2.5, 'Bebidas', 'bar'],
  ['Ypioca Lata', 10.0, 'Bebidas', 'bar'],
  ['Pitú Lata', 10.0, 'Bebidas', 'bar'],
  ['Caranguejo Lata', 10.0, 'Bebidas', 'bar'],
  ['Caipirinha Simples', 6.0, 'Drinques e Doses', 'bar'],
  ['Caipirinha Cremosa', 8.0, 'Drinques e Doses', 'bar'],
  ['Caipfruta Maracujá', 13.0, 'Drinques e Doses', 'bar'],
  ['Caipfruta Abacaxi', 13.0, 'Drinques e Doses', 'bar'],
  ['Caipfruta Acerola', 13.0, 'Drinques e Doses', 'bar'],
  ['Caipfruta Uva', 13.0, 'Drinques e Doses', 'bar'],
  ['Suco - Jarra 500ml', 10.0, 'Bebidas', 'bar'],
  ['Suco - Jarra 1L', 15.0, 'Bebidas', 'bar'],
  ['Peixe Frito (Almoço)', 130.0, 'Pratos', 'cozinha'],
  ['Peixe Cozido (Almoço)', 130.0, 'Pratos', 'cozinha'],
  ['Cordeiro à Moda Rancho', 130.0, 'Pratos', 'cozinha'],
  ['Carne Bovina (Almoço)', 130.0, 'Pratos', 'cozinha'],
  ['Cupim Intransigente', 130.0, 'Pratos', 'cozinha'],
  ['Cordeiro (Petisco)', 65.0, 'Petiscos', 'cozinha'],
  ['Carne Bovina (Petisco)', 65.0, 'Petiscos', 'cozinha'],
  ['Cupim Intransigente (Petisco)', 65.0, 'Petiscos', 'cozinha'],
  ['Peixe Frito (Petisco)', 80.0, 'Petiscos', 'cozinha'],
  ['Pirão de Queijo c/ Carne de Sol (Petisco)', 50.0, 'Petiscos', 'cozinha'],
  ['Filé com Fritas (Petisco)', 40.0, 'Petiscos', 'cozinha'],
  ['Picadinho de Carneiro (Petisco)', 15.0, 'Petiscos', 'cozinha'],
  ['Dobradinha (Petisco)', 15.0, 'Petiscos', 'cozinha'],
  ['Peixe Cozido (Petisco)', 80.0, 'Petiscos', 'cozinha'],
  ['Queijo Coalho c/ Mel de Cana (Petisco)', 20.0, 'Petiscos', 'cozinha'],
  ['Batata Frita (Petisco)', 15.0, 'Petiscos', 'cozinha'],
  ['Macaxeira Frita (Petisco)', 15.0, 'Petiscos', 'cozinha'],
  ['Asa de Frango Assada (Petisco)', 40.0, 'Petiscos', 'cozinha'],
  ['Linguiça Assada (Petisco)', 40.0, 'Petiscos', 'cozinha'],
  ['Fígado Acebolado (Petisco)', 40.0, 'Petiscos', 'cozinha'],
  ['Banho de Piscina (Adulto)', 15.0, 'Drinques e Doses', 'bar'],
  ['Banho de Piscina (Infantil)', 10.0, 'Drinques e Doses', 'bar'],
  ['Black White (Dose)', 8.0, 'Drinques e Doses', 'bar'],
  ['Filé com Fritas c/ Calabresa', 40.0, 'Petiscos', 'cozinha'],
  ['Quentinha', 19.0, 'Pratos', 'cozinha'],
  ['Sorvete Sterbinho', 6.99, 'Sorvetes e Picolés', 'bar'],
  ['Maximum', 12.0, 'Sorvetes e Picolés', 'bar'],
  ['Bom Bom', 12.0, 'Sorvetes e Picolés', 'bar'],
  ['Sterkone', 9.99, 'Sorvetes e Picolés', 'bar'],
  ['Copo Mais', 9.99, 'Sorvetes e Picolés', 'bar'],
  ['Ster Kids', 3.5, 'Sorvetes e Picolés', 'bar'],
  ['Sunder', 5.99, 'Sorvetes e Picolés', 'bar'],
  ['Picolé Brigadeiro', 7.99, 'Sorvetes e Picolés', 'bar'],
  ['Açaí com Leite Condensado', 6.99, 'Sorvetes e Picolés', 'bar'],
  ['Buenisimo', 8.99, 'Sorvetes e Picolés', 'bar'],
  ['Sterblito', 8.99, 'Sorvetes e Picolés', 'bar'],
  ['Sterninho Trufado', 8.99, 'Sorvetes e Picolés', 'bar'],
  ['Lacto', 3.99, 'Sorvetes e Picolés', 'bar'],
  ['Sterlapis', 2.5, 'Sorvetes e Picolés', 'bar'],
  ['Picolé de Fruta', 3.99, 'Sorvetes e Picolés', 'bar'],
  ['H20', 7.0, 'Bebidas', 'bar'],
  ['Vinho (Taça)', 8.0, 'Bebidas', 'bar'],
  ['Ster Lapis', 2.5, 'Sorvetes e Picolés', 'bar'],
  ['Morgado', 25.0, 'Bebidas', 'bar'],
  ['Vinho Galioto', 30.0, 'Bebidas', 'bar'],
  ['Vinho Quinto Morgado', 25.0, 'Bebidas', 'bar'],
  ['Suco Copo', 5.0, 'Bebidas', 'bar'],
  ['Stella 600ml', 15.0, 'Bebidas', 'bar'],
  ['Amstel 600ml', 12.0, 'Bebidas', 'bar'],
  ['Budweiser 600ml', 14.0, 'Bebidas', 'bar'],
  ['Brahma 600', 12.0, 'Bebidas', 'bar'],
  ['Gelo Pacote', 5.0, 'Bebidas', 'bar'],
  ['Red Bull', 15.0, 'Bebidas', 'bar'],
  ['Cachaça Dose - Pitú/Caranguejo/Ypioca', 2.0, 'Drinques e Doses', 'bar'],
  ['Samanaú Dose', 5.0, 'Drinques e Doses', 'bar'],
  ['Dose Old Parr', 15.0, 'Drinques e Doses', 'bar'],
  ['Dreher Dose', 4.0, 'Drinques e Doses', 'bar'],
  ['Black & White (Dose)', 8.0, 'Drinques e Doses', 'bar'],
  ['Dreher', 40.0, 'Drinques e Doses', 'bar'],
  ['Dreher Copo', 10.0, 'Drinques e Doses', 'bar'],
  ['Calabresa Porção', 35.0, 'Petiscos', 'cozinha'],
  ['Pirão de Queijo', 25.0, 'Petiscos', 'cozinha'],
  ['Porção de Carne', 30.0, 'Petiscos', 'cozinha'],
  ['Capote (Galinha D’Angola)', 150.0, 'Pratos', 'cozinha'],
  ['Lagoa - Aluguel', 150.0, 'Serviços', 'bar'],
  ['Linguiça (Unidade)', 6.0, 'Petiscos', 'cozinha'],
  ['Prato', 20.0, 'Pratos', 'cozinha'],
  ['Cachaça Samanaú Ouro - Garrafinha', 23.0, 'Bebidas', 'bar'],
  ['Arroz de Leite (de Coco)', 5.0, 'Porções Extras', 'cozinha'],
  ['Arroz Solto', 5.0, 'Porções Extras', 'cozinha'],
  ['Feijão', 5.0, 'Porções Extras', 'cozinha'],
  ['Água de Coco 500ml', 10.0, 'Bebidas', 'bar'],
  ['Heineken', 18.0, 'Bebidas', 'bar'],
  ['Matuta 1L', 46.0, 'Bebidas', 'bar'],
  ['Matuta 300ml', 30.0, 'Bebidas', 'bar'],
  ['Montilla (Dose)', 5.0, 'Drinques e Doses', 'bar'],
  ['Macarrão', 5.0, 'Porções Extras', 'cozinha'],
];

const inserirProduto = db.prepare(
  'INSERT INTO produtos (restaurante_id, categoria_id, nome, preco, setor_impressao, ativo) VALUES (?, ?, ?, ?, ?, 1)'
);

const importar = db.transaction(() => {
  for (const [nome, preco, categoria, setor] of PRODUTOS) {
    inserirProduto.run(RESTAURANTE_ID, categoriaId[categoria], nome, preco, setor);
  }
});
importar();

console.log(`Importados ${PRODUTOS.length} produtos em ${CATEGORIAS.length} categorias.`);
