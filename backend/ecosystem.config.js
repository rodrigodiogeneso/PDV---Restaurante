// Config do PM2 para produção. SQLite (better-sqlite3) é single-writer,
// então roda com uma única instância — não usar cluster mode aqui.
module.exports = {
  apps: [
    {
      name: 'pdv-restaurante-backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
