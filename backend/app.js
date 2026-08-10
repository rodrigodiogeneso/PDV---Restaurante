require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { autenticar } = require('./middleware/auth');
const authRouter = require('./routes/auth');
const mesasRouter = require('./routes/mesas');
const produtosRouter = require('./routes/produtos');
const pedidosRouter = require('./routes/pedidos');
const usuariosRouter = require('./routes/usuarios');
const auditoriaRouter = require('./routes/auditoria');
const relatoriosRouter = require('./routes/relatorios');
const caixaRouter = require('./routes/caixa');
const impressorasRouter = require('./routes/impressoras');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Tudo abaixo desta linha exige um Bearer token válido
app.use('/api', autenticar);

app.use('/api/mesas', mesasRouter);
app.use('/api/produtos', produtosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/auditoria', auditoriaRouter);
app.use('/api/relatorios', relatoriosRouter);
app.use('/api/caixa', caixaRouter);
app.use('/api/impressoras', impressorasRouter);

module.exports = app;
