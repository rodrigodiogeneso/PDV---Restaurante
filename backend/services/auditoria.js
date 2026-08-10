const db = require('../db/database');

const inserir = db.prepare(
  `INSERT INTO auditoria (restaurante_id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

// usuario vem de req.usuario (payload do JWT) ou null (ex.: tentativa de login que falhou)
function registrar({ usuario, acao, entidade, entidadeId, detalhes, restauranteId }) {
  inserir.run(
    restauranteId || usuario?.restaurante_id || 1,
    usuario?.id ?? null,
    usuario?.nome ?? null,
    acao,
    entidade ?? null,
    entidadeId ?? null,
    detalhes ? JSON.stringify(detalhes) : null
  );
}

module.exports = { registrar };
