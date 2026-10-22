import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

try {
  const migration = await readFile(
    fileURLToPath(new URL('./migrations/001_initial_schema.sql', import.meta.url)),
    'utf8',
  );
  await pool.query(migration);
  console.info('Migração do banco aplicada com sucesso.');
} catch (error) {
  console.error('Falha ao aplicar migrações do banco:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
