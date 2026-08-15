-- Schema PDV Restaurante
-- Todas as tabelas relevantes já nascem com restaurante_id, mesmo em modo
-- single-tenant, para facilitar a migração futura para multi-tenant.

CREATE TABLE IF NOT EXISTS restaurantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('admin','garcom','cozinha','bar','caixa')),
  deve_trocar_senha INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS impressoras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  nome TEXT NOT NULL,
  setor TEXT NOT NULL CHECK (setor IN ('cozinha','bar')),
  ip TEXT NOT NULL,
  porta INTEGER NOT NULL DEFAULT 9100,
  ativa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  numero TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','ocupada','reservada')),
  capacidade INTEGER DEFAULT 4,
  UNIQUE(restaurante_id, numero)
);

CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  mesa_id INTEGER NOT NULL REFERENCES mesas(id),
  nome_cliente TEXT NOT NULL,
  telefone TEXT,
  horario TEXT NOT NULL,
  numero_pessoas INTEGER,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada','concluida')),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comandas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  mesa_id INTEGER NOT NULL REFERENCES mesas(id),
  nome_cliente TEXT,
  numero_pessoas INTEGER,
  desconto_tipo TEXT CHECK (desconto_tipo IN ('percentual','valor')),
  desconto_valor REAL DEFAULT 0,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','pix','misto')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','cancelada')),
  aberta_em TEXT DEFAULT CURRENT_TIMESTAMP,
  fechada_em TEXT
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  categoria_id INTEGER REFERENCES categorias(id),
  nome TEXT NOT NULL,
  preco REAL NOT NULL,
  setor_impressao TEXT NOT NULL CHECK (setor_impressao IN ('cozinha','bar')),
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comanda_id INTEGER NOT NULL REFERENCES comandas(id),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario REAL NOT NULL,
  setor TEXT NOT NULL CHECK (setor IN ('cozinha','bar')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','preparando','pronto','entregue','cancelado')),
  observacao TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comanda_id INTEGER NOT NULL REFERENCES comandas(id),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','pix')),
  valor REAL NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS caixa_sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  valor_abertura REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  aberto_em TEXT DEFAULT CURRENT_TIMESTAMP,
  fechado_em TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id INTEGER,
  detalhes TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS falhas_impressao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id),
  setor TEXT NOT NULL,
  mesa_numero TEXT,
  contexto TEXT NOT NULL DEFAULT 'pedido' CHECK (contexto IN ('pedido','conta')),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  resolvida_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_itens_pedido_setor_status ON itens_pedido(setor, status);
CREATE INDEX IF NOT EXISTS idx_comandas_mesa ON comandas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_mesas_restaurante ON mesas(restaurante_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_pagamentos_comanda ON pagamentos(comanda_id);
CREATE INDEX IF NOT EXISTS idx_falhas_impressao_restaurante_resolvida ON falhas_impressao(restaurante_id, resolvida_em);
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_restaurante_status ON caixa_sessoes(restaurante_id, status);
