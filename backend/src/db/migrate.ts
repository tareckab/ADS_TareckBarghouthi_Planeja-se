import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

// Aplica, em ordem, cada arquivo de migrations/ ainda não registrado em schema_migrations.
const directory = fileURLToPath(new URL('./migrations/', import.meta.url));

const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const applied = new Set(
    (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name),
  );
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(`${directory}${file}`, 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.info(`Migração aplicada: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Falha em ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.info('Banco atualizado.');
} catch (error) {
  console.error('Falha ao aplicar migrações do banco:', error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
