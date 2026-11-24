import express from 'express';
import { z } from 'zod';
import { pool, type Queryable } from '../db/pool.js';
import { asyncRoute, brl, httpError, logActivity, parseId, requireWorkspace } from '../http.js';

/** Transações (RF03): registro, edição, confirmação e cancelamento (estorno). */
export const movements = express.Router();

const kindSchema = z.enum(['income', 'expense']);
const statusSchema = z.enum(['pending', 'confirmed', 'cancelled']);
const prioritySchema = z.enum(['urgent', 'normal', 'low']);

export const MOVEMENT_COLUMNS = `
  m.id, m.title, c.name AS category, m.category_id AS "categoryId", m.amount, m.kind,
  m.movement_date AS date, m.account_id AS account, m.status, m.priority`;

export type MovementRow = Record<string, unknown> & { amount: string | number };
export const toMovement = (row: MovementRow) => ({ ...row, amount: Number(row.amount) });

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  categoryId: z.string().uuid(),
  amount: z.number().finite().positive().max(1e12),
  kind: kindSchema,
  date: z.string().date(),
  account: z.string().uuid(),
  // Lançar já cancelado não faz sentido: o cancelamento é uma ação sobre um lançamento existente.
  status: z.enum(['pending', 'confirmed']).default('confirmed'),
  priority: prioritySchema.default('normal'),
});
const updateSchema = createSchema.omit({ status: true }).partial()
  .extend({ status: statusSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para alterar.');

async function checkReferences(db: Queryable, workspaceId: string, account: string, categoryId: string, kind: string) {
  const [accountRow, categoryRow] = await Promise.all([
    db.query('SELECT name FROM accounts WHERE id = $1 AND workspace_id = $2', [account, workspaceId]),
    db.query('SELECT kind FROM categories WHERE id = $1 AND workspace_id = $2', [categoryId, workspaceId]),
  ]);
  if (!accountRow.rowCount) throw httpError(404, 'Conta não encontrada neste espaço de trabalho.');
  if (!categoryRow.rowCount) throw httpError(404, 'Categoria não encontrada neste espaço de trabalho.');
  if (categoryRow.rows[0].kind !== kind) {
    throw httpError(400, kind === 'income'
      ? 'Escolha uma categoria de entrada para este lançamento.'
      : 'Escolha uma categoria de saída para este lançamento.');
  }
  return accountRow.rows[0].name as string;
}

async function selectMovement(db: Queryable, id: string) {
  const result = await db.query(
    `SELECT ${MOVEMENT_COLUMNS} FROM movements m JOIN categories c ON c.id = m.category_id WHERE m.id = $1`,
    [id],
  );
  return toMovement(result.rows[0]);
}

async function inTransaction<T>(work: (client: Queryable) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

movements.get('/workspaces/:workspaceId/movements', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const filters = z.object({
    kind: kindSchema.optional(),
    status: statusSchema.optional(),
    account: z.string().uuid().optional(),
    category: z.string().uuid().optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    search: z.string().max(120).optional(),
  }).parse(Object.fromEntries(
    Object.entries(request.query).filter(([, value]) => value !== 'all' && value !== ''),
  ));
  const result = await pool.query(
    `SELECT ${MOVEMENT_COLUMNS}
     FROM movements m JOIN categories c ON c.id = m.category_id
     WHERE m.workspace_id = $1
       AND ($2::text IS NULL OR m.kind = $2)
       AND ($3::text IS NULL OR m.status = $3)
       AND ($4::uuid IS NULL OR m.account_id = $4)
       AND ($5::uuid IS NULL OR m.category_id = $5)
       AND ($6::date IS NULL OR m.movement_date >= $6)
       AND ($7::date IS NULL OR m.movement_date <= $7)
       AND ($8::text IS NULL OR m.title ILIKE '%' || $8 || '%' OR c.name ILIKE '%' || $8 || '%')
     ORDER BY m.movement_date DESC, m.created_at DESC`,
    [workspaceId, filters.kind ?? null, filters.status ?? null, filters.account ?? null,
      filters.category ?? null, filters.from ?? null, filters.to ?? null, filters.search ?? null],
  );
  response.json(result.rows.map(toMovement));
}));

movements.post('/workspaces/:workspaceId/movements', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const input = createSchema.parse(request.body);
  const movement = await inTransaction(async (db) => {
    const accountName = await checkReferences(db, workspaceId, input.account, input.categoryId, input.kind);
    const inserted = await db.query(
      `INSERT INTO movements
         (workspace_id, account_id, category_id, title, amount, kind, movement_date, status, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [workspaceId, input.account, input.categoryId, input.title, input.amount, input.kind,
        input.date, input.status, input.priority, request.userId],
    );
    const id = inserted.rows[0].id as string;
    await logActivity(db, {
      workspaceId, userId: request.userId, entity: 'movement', entityId: id,
      title: `${input.kind === 'income' ? 'Entrada' : 'Saída'} ${input.status === 'pending' ? 'agendada' : 'registrada'}: ${input.title}`,
      detail: `${brl(input.amount)} · ${accountName}`,
    });
    return selectMovement(db, id);
  });
  response.status(201).json(movement);
}));

movements.patch('/workspaces/:workspaceId/movements/:movementId', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const movementId = parseId(request.params.movementId);
  const input = updateSchema.parse(request.body);
  const movement = await inTransaction(async (db) => {
    const found = await db.query(
      `SELECT title, category_id, amount, kind, movement_date, account_id, status, priority
       FROM movements WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [movementId, workspaceId],
    );
    if (!found.rowCount) throw httpError(404, 'Lançamento não encontrado.');
    const current = found.rows[0];
    if (current.status === 'cancelled') {
      throw httpError(409, 'Lançamento cancelado não pode ser alterado. Registre um novo, se precisar.');
    }
    const next = {
      title: input.title ?? current.title,
      categoryId: input.categoryId ?? current.category_id,
      amount: input.amount ?? Number(current.amount),
      kind: input.kind ?? current.kind,
      date: input.date ?? current.movement_date,
      account: input.account ?? current.account_id,
      status: input.status ?? current.status,
      priority: input.priority ?? current.priority,
    };
    const accountName = await checkReferences(db, workspaceId, next.account, next.categoryId, next.kind);
    await db.query(
      `UPDATE movements SET title = $2, category_id = $3, amount = $4, kind = $5, movement_date = $6,
         account_id = $7, status = $8, priority = $9, updated_at = now()
       WHERE id = $1`,
      [movementId, next.title, next.categoryId, next.amount, next.kind, next.date, next.account, next.status, next.priority],
    );
    const action = next.status === 'cancelled'
      ? 'Lançamento cancelado (estorno)'
      : current.status === 'pending' && next.status === 'confirmed'
        ? next.kind === 'income' ? 'Recebimento confirmado' : 'Pagamento confirmado'
        : 'Lançamento editado';
    await logActivity(db, {
      workspaceId, userId: request.userId, entity: 'movement', entityId: movementId,
      title: `${action}: ${next.title}`,
      detail: `${brl(next.amount)} · ${accountName}`,
    });
    return selectMovement(db, movementId);
  });
  response.json(movement);
}));
