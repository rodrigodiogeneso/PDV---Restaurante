const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pdv.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrar();
}

// Aplica alterações de colunas em bancos já existentes (CREATE TABLE IF NOT EXISTS
// não adiciona colunas novas em tabelas que já existiam antes da mudança no schema).
function migrar() {
  const colunasUsuarios = db.prepare("PRAGMA table_info(usuarios)").all().map((c) => c.name);
  if (!colunasUsuarios.includes('ativo')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1');
  }
  // Login passou a comparar e-mail em minúsculas; normaliza o que já estava salvo.
  db.exec("UPDATE usuarios SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email))");
}

function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS total FROM restaurantes').get();
  if (row.total > 0) return;

  const insertRestaurante = db.prepare('INSERT INTO restaurantes (nome) VALUES (?)');
  const restauranteId = insertRestaurante.run('Meu Restaurante').lastInsertRowid;

  const insertUsuario = db.prepare(
    'INSERT INTO usuarios (restaurante_id, nome, email, senha_hash, papel) VALUES (?, ?, ?, ?, ?)'
  );
  const senhaPadraoHash = bcrypt.hashSync('123456', 10);
  insertUsuario.run(restauranteId, 'Administrador', 'admin@restaurante.local', bcrypt.hashSync('admin123', 10), 'admin');
  insertUsuario.run(restauranteId, 'Garçom Demo', 'garcom@restaurante.local', senhaPadraoHash, 'garcom');
  insertUsuario.run(restauranteId, 'Caixa Demo', 'caixa@restaurante.local', senhaPadraoHash, 'caixa');
  insertUsuario.run(restauranteId, 'Cozinha Demo', 'cozinha@restaurante.local', senhaPadraoHash, 'cozinha');
  insertUsuario.run(restauranteId, 'Bar Demo', 'bar@restaurante.local', senhaPadraoHash, 'bar');

  const insertMesa = db.prepare(
    'INSERT INTO mesas (restaurante_id, numero, status, capacidade) VALUES (?, ?, ?, ?)'
  );
  for (let i = 1; i <= 30; i++) {
    insertMesa.run(restauranteId, String(i).padStart(2, '0'), 'disponivel', 4);
  }

  const insertCategoria = db.prepare('INSERT INTO categorias (restaurante_id, nome) VALUES (?, ?)');
  const catPratos = insertCategoria.run(restauranteId, 'Pratos').lastInsertRowid;
  const catBebidas = insertCategoria.run(restauranteId, 'Bebidas').lastInsertRowid;

  const insertProduto = db.prepare(
    'INSERT INTO produtos (restaurante_id, categoria_id, nome, preco, setor_impressao) VALUES (?, ?, ?, ?, ?)'
  );
  insertProduto.run(restauranteId, catPratos, 'Picanha grelhada', 68.0, 'cozinha');
  insertProduto.run(restauranteId, catPratos, 'Risoto de funghi', 52.0, 'cozinha');
  insertProduto.run(restauranteId, catBebidas, 'Caipirinha', 18.0, 'bar');
  insertProduto.run(restauranteId, catBebidas, 'Cerveja long neck', 12.0, 'bar');

  const insertImpressora = db.prepare(
    'INSERT INTO impressoras (restaurante_id, nome, setor, ip, porta) VALUES (?, ?, ?, ?, ?)'
  );
  insertImpressora.run(restauranteId, 'Impressora cozinha', 'cozinha', '192.168.0.101', 9100);
  insertImpressora.run(restauranteId, 'Impressora bar', 'bar', '192.168.0.102', 9100);
}

initSchema();
// Em produção, não cria usuários demo com senhas fracas.
// Para criar o primeiro admin manualmente:
//   node -e "const db=require('./db/database'); const b=require('bcryptjs'); db.prepare('INSERT INTO restaurantes(nome) VALUES(?)').run('Restaurante'); db.prepare('INSERT INTO usuarios(restaurante_id,nome,email,senha_hash,papel) VALUES(1,?,?,?,?)').run('Admin','admin@seudominio.com',b.hashSync('SENHA_FORTE',10),'admin');"
if (process.env.NODE_ENV !== 'production') {
  seedIfEmpty();
}

module.exports = db;
