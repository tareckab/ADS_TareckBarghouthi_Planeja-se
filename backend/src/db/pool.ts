import pg from 'pg';
import { config } from '../config.js';

// DATE (oid 1082) deve voltar como 'YYYY-MM-DD'. O padrão do node-pg cria um Date no
// fuso do servidor, que o JSON serializa em UTC e desloca o dia da movimentação.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Erro inesperado em uma conexão ociosa do PostgreSQL:', error);
});
