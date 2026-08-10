// Canal de eventos em tempo real (WebSocket) para o KDS e a comanda saberem
// na hora quando um pedido é criado ou um item muda de status, sem polling.
// Autenticado por JWT: o frontend envia o token na query string (/ws?token=...).
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

let wss = null;

function iniciar(servidorHttp) {
  wss = new WebSocketServer({ server: servidorHttp, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    try {
      const usuario = jwt.verify(token, SECRET);
      socket.usuario = usuario;
    } catch {
      socket.close(4001, 'Token inválido');
    }
  });
}

function emitir(tipo, dados) {
  if (!wss) return;
  const payload = JSON.stringify({ tipo, dados });
  wss.clients.forEach((cliente) => {
    if (cliente.readyState === cliente.OPEN && cliente.usuario) cliente.send(payload);
  });
}

module.exports = { iniciar, emitir };
