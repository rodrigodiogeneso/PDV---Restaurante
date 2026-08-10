const http = require('http');
const app = require('./app');
const eventos = require('./services/eventos');

const PORT = process.env.PORT || 3000;

const servidor = http.createServer(app);
eventos.iniciar(servidor);

servidor.listen(PORT, () => {
  console.log(`Servidor PDV rodando em http://localhost:${PORT}`);
});
