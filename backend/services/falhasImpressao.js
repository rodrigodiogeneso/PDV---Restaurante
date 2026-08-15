const db = require('../db/database');

function registrar({ restauranteId, setor, mesaNumero, contexto = 'pedido' }) {
  db.prepare(
    `INSERT INTO falhas_impressao (restaurante_id, setor, mesa_numero, contexto) VALUES (?, ?, ?, ?)`
  ).run(restauranteId, setor, mesaNumero != null ? String(mesaNumero) : null, contexto);
}

module.exports = { registrar };
