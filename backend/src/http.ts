import type express from 'express';
import { z } from 'zod';
import { pool, type Queryable } from './db/pool.js';

const idSchema = z.string().uuid();

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function parseId(value: unknown) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw httpError(400, 'Identificador inválido.');
  return parsed.data;
}

export function asyncRoute(
  handler: (request: express.Request, response: express.Response) => Promise<unknown>,
) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    handler(request, response).catch(next);
  };
}

/** Garante que o workspace da rota pertence ao usuário autenticado; devolve o id validado. */
export async function requireWorkspace(request: express.Request) {
  const workspaceId = parseId(request.params.workspaceId);
  const result = await pool.query(
    'SELECT id FROM workspaces WHERE id = $1 AND owner_id = $2',
    [workspaceId, request.userId],
  );
  if (!result.rowCount) throw httpError(404, 'Espaço de trabalho não encontrado.');
  return workspaceId;
}

export function isPgError(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** Registra no log de alterações (RF06) quem fez o quê e em qual registro. */
export function logActivity(
  db: Queryable,
  entry: { workspaceId: string; userId?: string; entity: string; entityId: string; title: string; detail: string },
) {
  return db.query(
    `INSERT INTO activity (workspace_id, user_id, entity, entity_id, title, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entry.workspaceId, entry.userId ?? null, entry.entity, entry.entityId, entry.title.slice(0, 200), entry.detail.slice(0, 240)],
  );
}

export const brl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "2026-11" -> { start: '2026-11-01', next: '2026-12-01', previous: '2026-10-01' } */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM.');

export function monthRange(month: string) {
  const [year, m] = month.split('-').map(Number);
  const iso = (y: number, mm: number) => {
    const date = new Date(Date.UTC(y, mm - 1, 1));
    return date.toISOString().slice(0, 10);
  };
  return { start: iso(year, m), next: iso(year, m + 1), previous: iso(year, m - 1) };
}

export function currentMonth(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}
