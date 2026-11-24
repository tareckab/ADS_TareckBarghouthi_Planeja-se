import express from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { performance, recommendation } from '../finance/insights.js';
import {
  asyncRoute, brl, currentMonth, httpError, isPgError, logActivity, monthRange, monthSchema, parseId, requireWorkspace,
} from '../http.js';

/** Categorias (RF04), metas mensais de gasto/faturamento (RF04/HU06-07) e resumo do mês (RF06/RF07). */
export const planning = express.Router();

const kindSchema = z.enum(['income', 'expense']);
const kindLabel = { income: 'faturamento', expense: 'gasto' } as const;

// ---------------------------------------------------------------- categorias

planning.get('/workspaces/:workspaceId/categories', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const result = await pool.query(
    `SELECT c.id, c.name, c.kind, COUNT(m.id)::int AS "usage"
     FROM categories c LEFT JOIN movements m ON m.category_id = c.id
     WHERE c.workspace_id = $1
     GROUP BY c.id ORDER BY c.kind DESC, c.name`,
    [workspaceId],
  );
  response.json(result.rows);
}));

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: kindSchema,
});

planning.post('/workspaces/:workspaceId/categories', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const input = categorySchema.parse(request.body);
  try {
    const result = await pool.query(
      `INSERT INTO categories (workspace_id, name, kind) VALUES ($1, $2, $3)
       RETURNING id, name, kind, 0 AS "usage"`,
      [workspaceId, input.name, input.kind],
    );
    await logActivity(pool, {
      workspaceId, userId: request.userId, entity: 'category', entityId: result.rows[0].id,
      title: `Categoria criada: ${input.name}`, detail: input.kind === 'income' ? 'Entradas' : 'Saídas',
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    if (isPgError(error, '23505')) throw httpError(409, 'Já existe uma categoria com esse nome.');
    throw error;
  }
}));

planning.delete('/workspaces/:workspaceId/categories/:categoryId', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const categoryId = parseId(request.params.categoryId);
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND workspace_id = $2 RETURNING name',
      [categoryId, workspaceId],
    );
    if (!result.rowCount) throw httpError(404, 'Categoria não encontrada.');
    await logActivity(pool, {
      workspaceId, userId: request.userId, entity: 'category', entityId: categoryId,
      title: `Categoria removida: ${result.rows[0].name}`, detail: 'Metas mensais da categoria também foram removidas',
    });
    response.status(204).end();
  } catch (error) {
    if (isPgError(error, '23503')) {
      throw httpError(409, 'Esta categoria tem lançamentos. Mova-os para outra categoria antes de removê-la.');
    }
    throw error;
  }
}));

// ---------------------------------------------------------------- metas mensais

const budgetSchema = z.object({
  month: monthSchema,
  kind: kindSchema,
  categoryId: z.string().uuid().nullable().default(null),
  amount: z.number().finite().positive().max(1e12),
});

function assertOpenPeriod(month: string) {
  // HU06: metas de meses já encerrados só podem ser consultadas.
  if (month < currentMonth()) throw httpError(409, 'Metas de meses encerrados não podem ser alteradas.');
}

planning.put('/workspaces/:workspaceId/budgets', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const input = budgetSchema.parse(request.body);
  assertOpenPeriod(input.month);
  let categoryName = 'Todo o espaço';
  if (input.categoryId) {
    const category = await pool.query(
      'SELECT name, kind FROM categories WHERE id = $1 AND workspace_id = $2',
      [input.categoryId, workspaceId],
    );
    if (!category.rowCount) throw httpError(404, 'Categoria não encontrada.');
    if (category.rows[0].kind !== input.kind) {
      throw httpError(400, 'A categoria não é do mesmo tipo da meta (gasto/faturamento).');
    }
    categoryName = category.rows[0].name;
  }
  const { start } = monthRange(input.month);
  const result = await pool.query(
    `INSERT INTO budgets (workspace_id, category_id, kind, amount, month)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT budgets_period_key DO UPDATE SET amount = EXCLUDED.amount
     RETURNING id, (xmax = 0) AS created`,
    [workspaceId, input.categoryId, input.kind, input.amount, start],
  );
  const { id, created } = result.rows[0];
  await logActivity(pool, {
    workspaceId, userId: request.userId, entity: 'budget', entityId: id,
    title: `Meta de ${kindLabel[input.kind]} ${created ? 'definida' : 'atualizada'}: ${categoryName}`,
    detail: `${brl(input.amount)} · ${input.month}`,
  });
  response.status(created ? 201 : 200).json({ id });
}));

planning.delete('/workspaces/:workspaceId/budgets/:budgetId', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const budgetId = parseId(request.params.budgetId);
  const found = await pool.query(
    `SELECT to_char(b.month, 'YYYY-MM') AS month, b.kind, COALESCE(c.name, 'Todo o espaço') AS category
     FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
     WHERE b.id = $1 AND b.workspace_id = $2`,
    [budgetId, workspaceId],
  );
  if (!found.rowCount) throw httpError(404, 'Meta não encontrada.');
  const budget = found.rows[0];
  assertOpenPeriod(budget.month);
  await pool.query('DELETE FROM budgets WHERE id = $1', [budgetId]);
  await logActivity(pool, {
    workspaceId, userId: request.userId, entity: 'budget', entityId: budgetId,
    title: `Meta de ${kindLabel[budget.kind as 'income' | 'expense']} removida: ${budget.category}`, detail: budget.month,
  });
  response.status(204).end();
}));

// ---------------------------------------------------------------- resumo do mês

/**
 * Indicadores do mês recalculados a cada consulta (RNF10):
 * metas com percentual atingido (HU07), variação do resultado (HU08) e recomendação de gasto (HU09).
 */
planning.get('/workspaces/:workspaceId/summary', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const month = monthSchema.default(currentMonth()).parse(request.query.month);
  const { start, next, previous } = monthRange(month);

  const [totals, budgets] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE movement_date >= $2 AND kind = 'income' AND status = 'confirmed'), 0) AS income,
         COALESCE(SUM(amount) FILTER (WHERE movement_date >= $2 AND kind = 'expense' AND status = 'confirmed'), 0) AS expenses,
         COALESCE(SUM(amount) FILTER (WHERE movement_date >= $2 AND kind = 'expense' AND status = 'pending'), 0) AS pending_expenses,
         COALESCE(SUM(amount) FILTER (WHERE movement_date < $2 AND kind = 'income' AND status = 'confirmed'), 0) AS previous_income,
         COALESCE(SUM(amount) FILTER (WHERE movement_date < $2 AND kind = 'expense' AND status = 'confirmed'), 0) AS previous_expenses
       FROM movements
       WHERE workspace_id = $1 AND movement_date >= $4 AND movement_date < $3`,
      [workspaceId, start, next, previous],
    ),
    pool.query(
      `SELECT b.id, b.kind, b.amount, b.category_id AS "categoryId", c.name AS category,
         COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'confirmed'), 0) AS achieved,
         COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'pending'), 0) AS pending
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       LEFT JOIN movements m ON m.workspace_id = b.workspace_id AND m.kind = b.kind
         AND m.movement_date >= b.month AND m.movement_date < $3
         AND (b.category_id IS NULL OR m.category_id = b.category_id)
       WHERE b.workspace_id = $1 AND b.month = $2
       GROUP BY b.id, c.name
       ORDER BY b.kind DESC, c.name NULLS FIRST`,
      [workspaceId, start, next],
    ),
  ]);

  const t = totals.rows[0];
  const budgetRows = budgets.rows.map((row) => {
    const amount = Number(row.amount);
    const achieved = Number(row.achieved);
    return {
      id: row.id as string,
      kind: row.kind as 'income' | 'expense',
      categoryId: row.categoryId as string | null,
      category: row.category as string | null,
      amount,
      achieved,
      pending: Number(row.pending),
      percent: Math.round((achieved / amount) * 1000) / 10,
    };
  });

  // Limite da recomendação: meta de gasto do espaço inteiro; sem ela, a soma das metas por categoria.
  const overall = budgetRows.find((b) => b.kind === 'expense' && !b.categoryId);
  const byCategory = budgetRows.filter((b) => b.kind === 'expense' && b.categoryId);
  const limit = overall ? overall.amount : byCategory.length ? byCategory.reduce((s, b) => s + b.amount, 0) : null;
  const spent = overall || !byCategory.length
    ? { confirmed: Number(t.expenses), pending: Number(t.pending_expenses) }
    : {
        confirmed: byCategory.reduce((s, b) => s + b.achieved, 0),
        pending: byCategory.reduce((s, b) => s + b.pending, 0),
      };

  response.json({
    month,
    performance: performance(
      { income: Number(t.income), expenses: Number(t.expenses) },
      { income: Number(t.previous_income), expenses: Number(t.previous_expenses) },
    ),
    pendingExpenses: Number(t.pending_expenses),
    budgets: budgetRows,
    recommendation: {
      ...recommendation(limit, spent, month),
      scope: overall ? 'workspace' : byCategory.length ? 'categories' : null,
    },
  });
}));
