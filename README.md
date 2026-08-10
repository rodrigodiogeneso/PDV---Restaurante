# PDV Restaurante

Sistema de PDV para restaurante — login por papel, mesas, comandas,
lançamento e cancelamento de pedidos, impressão térmica em rede por setor
e tela de gestão de cardápio.

O sistema **não integra pagamento**: o pagamento acontece na maquineta,
fora do sistema. O que ele faz é gerenciar mesas/comandas e imprimir a
pré-conta para o cliente conferir antes de pagar.

- **Backend:** Node.js + Express + SQLite (better-sqlite3) + WebSocket (ws)
- **Frontend:** Vue 3 + Vite + Pinia

## Estrutura

```
pdv-restaurante/
├── backend/
│   ├── db/
│   │   ├── schema.sql        # schema completo do banco
│   │   └── database.js       # conexão + inicialização + seed inicial
│   ├── middleware/
│   │   └── auth.js           # JWT: autenticar() e exigirPapel(...)
│   ├── routes/
│   │   ├── auth.js           # login
│   │   ├── usuarios.js       # CRUD de usuários (admin)
│   │   ├── mesas.js          # mapa de mesas, abrir/fechar, reservas, imprimir conta
│   │   ├── produtos.js       # cardápio, categorias
│   │   ├── pedidos.js        # lançamento/cancelamento de itens + fila do KDS
│   │   ├── relatorios.js     # vendas por período (admin)
│   │   └── auditoria.js      # trilha de auditoria (admin)
│   ├── services/
│   │   ├── impressao.js      # roteamento de impressão por setor (ESC/POS via TCP)
│   │   ├── eventos.js        # broadcast via WebSocket (pedido criado / item atualizado)
│   │   └── auditoria.js      # registrar() — grava uma linha na trilha de auditoria
│   ├── tests/                # node:test + supertest
│   ├── app.js                # configuração do Express (sem listen — usado nos testes)
│   └── server.js             # cria o servidor HTTP + WebSocket e sobe
└── frontend/
    └── src/
        ├── views/
        │   ├── Login.vue
        │   ├── MapaMesas.vue # mesas disponível/ocupada/reservada + nome do cliente
        │   ├── Comanda.vue   # lançamento/cancelamento de pedido, itens já enviados
        │   ├── Kds.vue       # kanban pendente/preparando/pronto, por setor
        │   ├── Gestao.vue    # produtos, categorias, usuários (admin)
        │   ├── Relatorios.vue # vendas por período (admin)
        │   └── Auditoria.vue  # trilha de auditoria com filtros (admin)
        ├── stores/            # Pinia: auth (login/token) e ui (loading/erro global)
        ├── services/          # api.js (axios) e ws.js (WebSocket com reconexão)
        ├── router/
        └── tests/
```

## Como rodar

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Sobe em `http://localhost:3000`. Na primeira execução, o banco SQLite é
criado automaticamente em `backend/db/pdv.db` com 30 mesas, 4 produtos de
exemplo, as 2 impressoras (cozinha e bar) e 5 usuários de demonstração —
ajuste os IPs das impressoras em `backend/db/database.js` (função
`seedIfEmpty`) ou diretamente no banco.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Sobe em `http://localhost:5173`, com proxy de `/api` e `/ws` para o backend.

### Testes
```bash
cd backend && npm test    # node:test + supertest, banco em memória
cd frontend && npm test   # vitest
```

## Login e papéis

O login é feito em `/login` com e-mail e senha; o backend devolve um JWT
(válido por 12h) que o frontend guarda no `localStorage` e envia em todo
request via `Authorization: Bearer`. Todas as rotas de `/api` exigem token,
exceto `/api/auth/login` e `/api/health`.

Usuários de demonstração criados no primeiro boot (troque as senhas em
produção pela tela de Gestão):

| Papel     | E-mail                      | Senha      |
|-----------|------------------------------|------------|
| admin     | admin@restaurante.local      | admin123   |
| garcom    | garcom@restaurante.local     | 123456     |
| caixa     | caixa@restaurante.local      | 123456     |
| cozinha   | cozinha@restaurante.local    | 123456     |
| bar       | bar@restaurante.local        | 123456     |

Regras de permissão principais:
- **garçom** abre mesa e lança pedidos (adiciona itens na comanda), mas
  **não pode cancelar** um item já enviado — só remover itens do próprio
  carrinho antes de enviar. O frontend nem mostra o cardápio/botão de
  enviar pedido pra quem não tem essa permissão.
- **caixa** tem toda a autonomia do garçom (abre mesa, lança pedidos) e
  além disso fecha mesa, imprime a conta, e é, junto com o admin, o único
  que pode remover um item já enviado à cozinha/bar.
- **cozinha** e **bar** só avançam o status dos itens do seu setor no KDS
  (pendente → preparando → pronto).
- **admin** tem acesso às telas de Gestão, Relatórios e Auditoria, além de
  todas as ações operacionais.

O frontend esconde botões e telas que o usuário logado não tem permissão
de usar (em vez de deixar clicar e tomar 403) — cada view checa o papel do
usuário via a store `auth` antes de renderizar a ação.

## Relatórios e auditoria (admin)

`/relatorios` — vendas por período (baseado em comandas **fechadas**):
total vendido, quantidade de comandas, ticket médio, quebra por dia e
produtos mais vendidos. Backend em `GET /api/relatorios/vendas?inicio=&fim=`.

`/auditoria` — trilha completa de ações do sistema: login (inclusive
tentativas falhas), abrir/fechar/reservar mesa, imprimir conta, lançar
pedido, cancelar/avançar status de item, criar/editar produto e categoria,
criar/editar/remover usuário — cada registro guarda quem fez, quando, e um
`detalhes` em JSON com o que mudou. Backend em `GET /api/auditoria` (filtros
`inicio`, `fim`, `acao`, `usuario_id`) e `services/auditoria.js` (função
`registrar()`, chamada a partir de cada rota que muda estado).

## Tempo real (WebSocket)

O backend expõe um WebSocket em `/ws` (via `services/eventos.js`) que
emite `pedido_criado` e `item_atualizado`. O KDS e a comanda escutam esse
canal (`services/ws.js`, com reconexão automática a cada 3s se cair) e se
atualizam na hora, sem esperar um polling — mantém só um poll de segurança
a cada 30s como rede de proteção.

## Impressão em rede

O roteamento por setor já está implementado em `services/impressao.js`:
cada item do pedido carrega um `setor_impressao` (`cozinha` ou `bar`) vindo
do cadastro do produto, e ao enviar o pedido o backend agrupa os itens e
manda para a impressora correspondente, cadastrada na tabela `impressoras`
(nome, IP, porta).

Usa a lib `node-thermal-printer`, compatível com a maioria das impressoras
térmicas com interface Ethernet (protocolo ESC/POS, porta padrão 9100).
Se a impressora não responder, o pedido é salvo normalmente e um aviso é
logado no console — a venda nunca trava por causa da impressora.

## Fechamento de mesa (sem pagamento)

`POST /api/mesas/:id/imprimir-conta` imprime a pré-conta (itens, subtotal,
desconto se houver, e total) na impressora do bar, com o aviso "Não é
documento fiscal". Não fecha a mesa nem registra pagamento — isso acontece
na maquineta, fora do sistema.

Depois que o cliente paga na maquineta, o garçom/caixa chama
`POST /api/mesas/:id/fechar`, que fecha a comanda e libera a mesa. No
frontend, a tela da comanda tem os botões "Imprimir conta" e "Fechar mesa"
(este último pede confirmação de que o pagamento já foi feito).

## Tela de gestão

Em `/gestao` (só para `admin`): cadastro e edição de produtos e categorias,
ativar/desativar produto, filtros de busca por nome/categoria/setor/status,
e cadastro de usuários por papel.

## Docker (completo)

O `docker-compose.yml` sobe backend + frontend (Nginx) em dois containers.
O banco fica num volume nomeado (`pdv_data`), persistente entre rebuilds.

```bash
cp .env.example .env          # preencha JWT_SECRET
docker compose up --build     # sobe em http://localhost (porta 80)
```

Em produção, o seed de usuários demo **não roda** (`NODE_ENV=production`).
Crie o primeiro admin manualmente — veja o comentário em `db/database.js`.

## Deploy na VPS (sem Docker)

1. `cd frontend && npm run build` gera `frontend/dist` (estático).
2. Copie `frontend/dist` e a pasta `backend/` (sem `node_modules`) para o
   servidor; rode `npm install --omit=dev` dentro de `backend/`.
3. Configure `backend/.env` (`JWT_SECRET` forte e `NODE_ENV=production`).
4. Suba o backend com PM2: `pm2 start backend/ecosystem.config.js`.
5. Configure o Nginx com `deploy/nginx.conf` (inclui redirect HTTP → HTTPS
   e blocos de SSL para uso com Certbot).

SQLite é single-writer: **não** rode o backend em cluster sem trocar por
PostgreSQL.

## Backup do banco

`deploy/backup.sh` usa `sqlite3 .backup` (seguro mesmo durante escrita
com WAL) e comprime com gzip. Adicione ao crontab:
```bash
0 */6 * * * /opt/pdv-restaurante/deploy/backup.sh
```
Retém backups por 30 dias (configurável via `RETENTION_DAYS`).

## Segurança

- **WebSocket autenticado**: o frontend envia o JWT na query string
  (`/ws?token=...`); conexões sem token válido são desconectadas na hora.
- **Rate limiting no login**: 10 tentativas por IP a cada 15 minutos;
  após isso retorna 429.
- **SSL**: `deploy/nginx.conf` já inclui redirect HTTP → HTTPS e blocos
  para Certbot (Let's Encrypt).
- **Seed desabilitado em produção**: `NODE_ENV=production` impede a
  criação de usuários demo com senhas fracas.

## Recursos operacionais

- **Desconto na comanda** (admin/caixa): percentual ou valor fixo, visível
  na comanda, no mapa de mesas, na pré-conta impressa e nos relatórios.
- **Pagamento dividido**: a mesma comanda aceita vários pagamentos
  parciais, cada um com sua forma (ex: 5 pessoas, cada uma pagando sua
  parte por PIX, cartão ou dinheiro). O sistema mostra pago/restante em
  tempo real e só libera "Fechar mesa" quando o restante chega a zero.
  Atalho de 1 clique continua disponível pra quem só quer escolher uma
  forma e fechar (sem dividir).
- **Resumo de vendas**: total bruto, descontos, total líquido, comandas,
  ticket médio, quebra por dia, por produto e por forma de pagamento
  (agora agregada a partir dos pagamentos individuais, refletindo contas
  divididas corretamente).
- **Exportação CSV**: relatório de vendas por comanda, detalhamento por
  pagamento individual (`/relatorios/pagamentos/csv`) e trilha de
  auditoria — compatível com Excel BR (separador `;`, BOM UTF-8, decimal
  com vírgula).
- **Senhas definidas somente pelo admin**: não existe troca de senha pelo
  próprio usuário — só o admin cria usuários e define/redefine a senha de
  qualquer um pela tela de Gestão (`PUT /api/usuarios/:id`).

## Próximos passos sugeridos

- [ ] Multi-tenant completo (JWT já carrega restaurante_id; falta filtrar
      todas as consultas SELECT por restaurante e criar tela de cadastro
      de restaurantes)
- [ ] Renovação automática de token antes de expirar (hoje expira em 12h
      e exige novo login)
