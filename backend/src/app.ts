import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { requireAuth } from './middleware/auth.js';
import { issueToken } from './auth/token.js';
import { asyncRoute, brl, logActivity, parseId, requireWorkspace } from './http.js';
import { movements, MOVEMENT_COLUMNS, toMovement } from './routes/movements.js';
import { planning } from './routes/planning.js';
import { openApiSpec } from './openapi.js';
import swaggerUi from 'swagger-ui-express';

const app = express();
const api = express.Router();
// O MVP atende finanças pessoais; 'business' segue no banco para a versão empresarial futura.
const workspaceSchema = z.literal('personal').default('personal');

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// Hash fixo para igualar o tempo de resposta do login quando o usuário não existe.
const dummyPasswordHash = bcrypt.hashSync('senha-fantasia-para-timing', 12);

const passwordMaxBytes = 72;
const passwordBytesMessage = 'A senha deve ter no máximo 72 bytes (caracteres acentuados ocupam mais de 1 byte).';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= passwordMaxBytes, passwordBytesMessage),
  workspace: workspaceSchema,
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= passwordMaxBytes, passwordBytesMessage),
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
       VALUES ($1, $2)
       RETURNING id, kind`,
      [user.rows[0].id, input.workspace],
    );
    await client.query('SELECT seed_default_categories($1)', [workspaces.rows[0].id]);
    const session = await issueToken(client, user.rows[0].id);
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
  const passwordMatches = await bcrypt.compare(input.password, user?.password_hash ?? dummyPasswordHash);
  if (!user || !passwordMatches) {
    response.status(401).json({ error: 'E-mail ou senha incorretos.' });
    return;
  }
  const workspaces = await pool.query(
    'SELECT id, kind FROM workspaces WHERE owner_id = $1 ORDER BY kind',
    [user.id],
  );
  const session = await issueToken(pool, user.id);
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
  const workspaceId = await requireWorkspace(request);
  const [accounts, movementRows, categories, goals, activity] = await Promise.all([
    pool.query(
      `SELECT id, name, bank, type, opening_balance AS opening, color
       FROM accounts WHERE workspace_id = $1 ORDER BY created_at`,
      [workspaceId],
    ),
    pool.query(
      `SELECT ${MOVEMENT_COLUMNS}
       FROM movements m JOIN categories c ON c.id = m.category_id
       WHERE m.workspace_id = $1
       ORDER BY m.movement_date DESC, m.created_at DESC`,
      [workspaceId],
    ),
    pool.query(
      `SELECT c.id, c.name, c.kind, COUNT(m.id)::int AS "usage"
       FROM categories c LEFT JOIN movements m ON m.category_id = c.id
       WHERE c.workspace_id = $1 GROUP BY c.id ORDER BY c.kind DESC, c.name`,
      [workspaceId],
    ),
    pool.query(
      `SELECT g.id, g.title, g.target, g.color, COALESCE(SUM(d.amount), 0) AS saved
       FROM goals g LEFT JOIN goal_deposits d ON d.goal_id = g.id
       WHERE g.workspace_id = $1 GROUP BY g.id ORDER BY g.created_at`,
      [workspaceId],
    ),
    pool.query(
      `SELECT a.id, a.title, a.detail, a.created_at, a.entity, u.name AS author
       FROM activity a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.workspace_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [workspaceId],
    ),
  ]);
  response.json({
    accounts: accounts.rows.map((row) => ({ ...row, opening: Number(row.opening) })),
    movements: movementRows.rows.map(toMovement),
    categories: categories.rows,
    goals: goals.rows.map((row) => ({
      ...row,
      target: Number(row.target),
      saved: Number(row.saved),
    })),
    activity: activity.rows.map(({ created_at: createdAt, ...row }) => ({
      ...row,
      date: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(createdAt),
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
  const workspaceId = await requireWorkspace(request);
  const input = accountSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO accounts (workspace_id, name, bank, type, opening_balance, color)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, bank, type, opening_balance AS opening, color`,
    [workspaceId, input.name, input.bank, input.type, input.opening, input.color],
  );
  await logActivity(pool, {
    workspaceId, userId: request.userId, entity: 'account', entityId: result.rows[0].id,
    title: `Conta adicionada: ${input.name}`, detail: `${input.bank} · saldo inicial ${brl(input.opening)}`,
  });
  response.status(201).json({ ...result.rows[0], opening: Number(result.rows[0].opening) });
}));

const goalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  target: z.number().finite().positive(),
  color: z.string().trim().min(1).max(30).default('green'),
});

api.post('/workspaces/:workspaceId/goals', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const input = goalSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO goals (workspace_id, title, target, color)
     VALUES ($1, $2, $3, $4) RETURNING id, title, target, 0 AS saved, color`,
    [workspaceId, input.title, input.target, input.color],
  );
  await logActivity(pool, {
    workspaceId, userId: request.userId, entity: 'goal', entityId: result.rows[0].id,
    title: `Objetivo criado: ${input.title}`, detail: `Alvo de ${brl(input.target)}`,
  });
  response.status(201).json({
    ...result.rows[0],
    target: Number(result.rows[0].target),
    saved: Number(result.rows[0].saved),
  });
}));

const depositSchema = z.object({ amount: z.number().finite().positive() });

api.post('/workspaces/:workspaceId/goals/:goalId/deposits', asyncRoute(async (request, response) => {
  const workspaceId = await requireWorkspace(request);
  const goalId = parseId(request.params.goalId);
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
      'INSERT INTO goal_deposits (goal_id, amount) VALUES ($1, $2)',
      [goalId, amount],
    );
    // O valor guardado é sempre a soma dos aportes (não é armazenado).
    const updated = await client.query(
      `SELECT g.id, g.title, g.target, g.color, COALESCE(SUM(d.amount), 0) AS saved
       FROM goals g LEFT JOIN goal_deposits d ON d.goal_id = g.id
       WHERE g.id = $1 GROUP BY g.id`,
      [goalId],
    );
    await logActivity(client, {
      workspaceId, userId: request.userId, entity: 'goal', entityId: goalId,
      title: `Aporte adicionado: ${goal.rows[0].title}`, detail: brl(amount),
    });
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

if (config.NODE_ENV !== 'production') {
  app.get('/api-docs.json', (_request, response) => {
    response.json(openApiSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}

api.use(movements);
api.use(planning);

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
