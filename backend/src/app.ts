import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { openApiSpec } from './openapi.js';
import swaggerUi from 'swagger-ui-express';

const app = express();
const api = express.Router();
const idSchema = z.string().uuid();
const workspaceSchema = z.enum(['personal', 'business']);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origem não permitida pela política CORS.'));
  },
}));
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

function parseId(value: unknown) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    const error = new Error('Identificador inválido.');
    Object.assign(error, { status: 400 });
    throw error;
  }
  return parsed.data;
}

function asyncRoute(
  handler: (request: express.Request, response: express.Response) => Promise<unknown>,
) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    handler(request, response).catch(next);
  };
}

async function ownedWorkspace(workspaceId: string, userId: string) {
  const result = await pool.query(
    'SELECT id, kind FROM workspaces WHERE id = $1 AND owner_id = $2',
    [workspaceId, userId],
  );
  return result.rows[0] as { id: string; kind: 'personal' | 'business' } | undefined;
}

async function createSession(userId: string) {
  const sessionKey = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(sessionKey).digest('hex');
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '12 hours')`,
    [userId, tokenHash],
  );
  return sessionKey;
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
});

api.post('/auth/register', authLimiter, asyncRoute(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [input.name, input.email, await bcrypt.hash(input.password, 12)],
    );
    const workspaces = await client.query(
      `INSERT INTO workspaces (owner_id, kind)
       VALUES ($1, 'personal'), ($1, 'business')
       RETURNING id, kind`,
      [user.rows[0].id],
    );
    const session = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(session).digest('hex');
    await client.query('DELETE FROM sessions WHERE expires_at <= now()');
    await client.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '12 hours')`,
      [user.rows[0].id, tokenHash],
    );
    await client.query('COMMIT');
    response.status(201).json({ session, user: user.rows[0], workspaces: workspaces.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}));

api.post('/auth/login', authLimiter, asyncRoute(async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await pool.query(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [input.email],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    response.status(401).json({ error: 'E-mail ou senha incorretos.' });
    return;
  }
  const workspaces = await pool.query(
    'SELECT id, kind FROM workspaces WHERE owner_id = $1 ORDER BY kind',
    [user.id],
  );
  const session = await createSession(user.id);
  response.json({
    session,
    user: { id: user.id, name: user.name, email: user.email },
    workspaces: workspaces.rows,
  });
}));

api.use(requireAuth);

api.post('/auth/logout', asyncRoute(async (request, response) => {
  await pool.query('DELETE FROM sessions WHERE id = $1', [request.sessionId]);
  response.status(204).end();
}));

api.get('/me', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'SELECT id, name, email, created_at FROM users WHERE id = $1',
    [request.userId],
  );
  if (!result.rowCount) {
    response.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }
  response.json(result.rows[0]);
}));

api.get('/workspaces', asyncRoute(async (request, response) => {
  const result = await pool.query(
    'SELECT id, kind FROM workspaces WHERE owner_id = $1 ORDER BY kind',
    [request.userId],
  );
  response.json(result.rows);
}));

api.get('/workspaces/:workspaceId/data', asyncRoute(async (request, response) => {
  const workspaceId = parseId(request.params.workspaceId);
  if (!(await ownedWorkspace(workspaceId, request.userId!))) {
    response.status(404).json({ error: 'Espaço de trabalho não encontrado.' });
    return;
  }
  const [accounts, movements, goals, activity] = await Promise.all([
    pool.query(
      `SELECT id, name, bank, type, opening_balance AS opening, color
       FROM accounts WHERE workspace_id = $1 ORDER BY created_at`,
      [workspaceId],
    ),
    pool.query(
      `SELECT id, title, category, amount, kind, movement_date AS date, account_id AS account
       FROM movements WHERE workspace_id = $1
       ORDER BY movement_date DESC, created_at DESC`,
      [workspaceId],
    ),
    pool.query(
      'SELECT id, title, target, saved, color FROM goals WHERE workspace_id = $1 ORDER BY created_at',
      [workspaceId],
    ),
    pool.query(
      `SELECT id, title, detail, created_at
       FROM activity WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [workspaceId],
    ),
  ]);
  response.json({
    accounts: accounts.rows.map((row) => ({ ...row, opening: Number(row.opening) })),
    movements: movements.rows.map((row) => ({ ...row, amount: Number(row.amount) })),
    goals: goals.rows.map((row) => ({
      ...row,
      target: Number(row.target),
      saved: Number(row.saved),
    })),
    activity: activity.rows.map((row) => ({
      ...row,
      date: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(row.created_at),
    })),
  });
}));

const accountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  bank: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(40),
  opening: z.number().finite().default(0),
  color: z.string().trim().min(1).max(30).default('lavender'),
});

api.post('/workspaces/:workspaceId/accounts', asyncRoute(async (request, response) => {
  const workspaceId = parseId(request.params.workspaceId);
  if (!(await ownedWorkspace(workspaceId, request.userId!))) {
    response.status(404).json({ error: 'Espaço de trabalho não encontrado.' });
    return;
  }
  const input = accountSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO accounts (workspace_id, name, bank, type, opening_balance, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, bank, type, opening_balance AS opening, color`,
    [workspaceId, input.name, input.bank, input.type, input.opening, input.color],
  );
  response.status(201).json({ ...result.rows[0], opening: Number(result.rows[0].opening) });
}));

const movementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  amount: z.number().finite().positive(),
  kind: z.enum(['income', 'expense']),
  date: z.string().date(),
  account: z.string().uuid(),
});

api.get('/workspaces/:workspaceId/movements', asyncRoute(async (request, response) => {
  const workspaceId = parseId(request.params.workspaceId);
  if (!(await ownedWorkspace(workspaceId, request.userId!))) {
    response.status(404).json({ error: 'Espaço de trabalho não encontrado.' });
    return;
  }
  const kind = request.query.kind === 'all' || request.query.kind === undefined
    ? undefined
    : z.enum(['income', 'expense']).parse(request.query.kind);
  const account = request.query.account === 'all' || request.query.account === undefined
    ? undefined
    : parseId(String(request.query.account));
  const search = z.string().max(120).optional().parse(request.query.search);
  const result = await pool.query(
    `SELECT id, title, category, amount, kind, movement_date AS date, account_id AS account
     FROM movements
     WHERE workspace_id = $1
       AND ($2::text IS NULL OR kind = $2)
       AND ($3::uuid IS NULL OR account_id = $3)
       AND ($4::text IS NULL OR title ILIKE '%' || $4 || '%' OR category ILIKE '%' || $4 || '%')
     ORDER BY movement_date DESC, created_at DESC`,
    [workspaceId, kind ?? null, account ?? null, search ?? null],
  );
  response.json(result.rows.map((row) => ({ ...row, amount: Number(row.amount) })));
}));

api.post('/workspaces/:workspaceId/movements', asyncRoute(async (request, response) => {
  const workspaceId = parseId(request.params.workspaceId);
  if (!(await ownedWorkspace(workspaceId, request.userId!))) {
    response.status(404).json({ error: 'Espaço de trabalho não encontrado.' });
    return;
  }
  const input = movementSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query(
      'SELECT id, name FROM accounts WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
      [input.account, workspaceId],
    );
    if (!account.rowCount) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Conta não encontrada neste espaço de trabalho.' });
      return;
    }
    const movement = await client.query(
      `INSERT INTO movements (workspace_id, account_id, title, category, amount, kind, movement_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, category, amount, kind, movement_date AS date, account_id AS account`,
      [workspaceId, input.account, input.title, input.category, input.amount, input.kind, input.date],
    );
    await client.query(
      'INSERT INTO activity (workspace_id, title, detail) VALUES ($1, $2, $3)',
      [
        workspaceId,
        `${input.kind === 'income' ? 'Entrada' : 'Saída'} registrada: ${input.title}`,
        `R$ ${Number(input.amount).toFixed(2)} · ${account.rows[0].name}`,
      ],
    );
    await client.query('COMMIT');
    response.status(201).json({ ...movement.rows[0], amount: Number(movement.rows[0].amount) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

const goalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  target: z.number().finite().positive(),
  color: z.string().trim().min(1).max(30).default('green'),
});

api.post('/workspaces/:workspaceId/goals', asyncRoute(async (request, response) => {
  const workspaceId = parseId(request.params.workspaceId);
  if (!(await ownedWorkspace(workspaceId, request.userId!))) {
    response.status(404).json({ error: 'Espaço de trabalho não encontrado.' });
    return;
  }
  const input = goalSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO goals (workspace_id, title, target, color)
     VALUES ($1, $2, $3, $4) RETURNING id, title, target, saved, color`,
    [workspaceId, input.title, input.target, input.color],
  );
  response.status(201).json({
    ...result.rows[0],
    target: Number(result.rows[0].target),
    saved: Number(result.rows[0].saved),
  });
}));

const depositSchema = z.object({ amount: z.number().finite().positive() });

api.post('/workspaces/:workspaceId/goals/:goalId/deposits', asyncRoute(async (request, response) => {
  const workspaceId = parseId(request.params.workspaceId);
  const goalId = parseId(request.params.goalId);
  if (!(await ownedWorkspace(workspaceId, request.userId!))) {
    response.status(404).json({ error: 'Espaço de trabalho não encontrado.' });
    return;
  }
  const { amount } = depositSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const goal = await client.query(
      'SELECT id, title FROM goals WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
      [goalId, workspaceId],
    );
    if (!goal.rowCount) {
      await client.query('ROLLBACK');
      response.status(404).json({ error: 'Meta não encontrada neste espaço de trabalho.' });
      return;
    }
    await client.query(
      'INSERT INTO goal_deposits (id, goal_id, amount) VALUES ($1, $2, $3)',
      [randomUUID(), goalId, amount],
    );
    const updated = await client.query(
      `UPDATE goals SET saved = saved + $1 WHERE id = $2
       RETURNING id, title, target, saved, color`,
      [amount, goalId],
    );
    await client.query(
      'INSERT INTO activity (workspace_id, title, detail) VALUES ($1, $2, $3)',
      [workspaceId, `Aporte adicionado: ${goal.rows[0].title}`, `R$ ${amount.toFixed(2)}`],
    );
    await client.query('COMMIT');
    response.status(201).json({
      ...updated.rows[0],
      target: Number(updated.rows[0].target),
      saved: Number(updated.rows[0].saved),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/health', asyncRoute(async (_request, response) => {
  await pool.query('SELECT 1');
  response.json({ status: 'ok', database: 'connected' });
}));

app.get('/api-docs.json', (_request, response) => {
  response.json(openApiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api', api);
app.use((_request, response) => {
  response.status(404).json({ error: 'Rota não encontrada.' });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: 'Dados inválidos.',
      details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
    return;
  }
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status)
    : 500;
  if (status >= 500) console.error('Erro na API:', error);
  response.status(status >= 400 && status < 500 ? status : 500).json({
    error: status >= 500 ? 'Erro interno do servidor.' : String(error.message ?? 'Requisição inválida.'),
  });
};
app.use(errorHandler);

export default app;
