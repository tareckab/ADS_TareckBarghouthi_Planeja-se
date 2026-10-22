import app from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

const server = app.listen(config.PORT, () => {
  console.info(`API Planeja-se disponível em http://localhost:${config.PORT}`);
});

function shutdown(signal: string) {
  console.info(`${signal} recebido; encerrando API...`);
  server.close((error) => {
    if (error) {
      console.error('Falha ao encerrar o servidor HTTP:', error);
      process.exitCode = 1;
    }
    pool.end().catch((poolError) => {
      console.error('Falha ao encerrar conexões PostgreSQL:', poolError);
      process.exitCode = 1;
    });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
