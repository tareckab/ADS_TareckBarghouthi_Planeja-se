import type { Account, Activity, Category, Goal, Kind, Movement, MovementInput, Summary, User, Workspace } from './model';

const SESSION_KEY = 'planeja-se-api-session';
const LEGACY_TOKEN_KEY = 'planeja-se-api-token';
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type WorkspaceInfo = { id: string; kind: Workspace };
type SessionResponse = {
  session: string;
  user: User & { id: string };
  workspaces: WorkspaceInfo[];
};
type Credentials = {
  mode: 'login' | 'register';
  name?: string;
  workspace?: Workspace;
  email: string;
  password: string;
};
type ApiData = {
  accounts: Account[];
  movements: Movement[];
  categories: Category[];
  goals: Goal[];
  activity: Activity[];
};
export type BudgetInput = { month: string; kind: Kind; categoryId: string | null; amount: number };

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem(SESSION_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError(`Não foi possível conectar à API em ${API_URL}. Confira se o backend está iniciado.`);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Não foi possível concluir a solicitação.';
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export const financeApi = {
  getSession: () => {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return localStorage.getItem(SESSION_KEY);
  },
  setSession: (session: string) => localStorage.setItem(SESSION_KEY, session),
  clearSession: () => localStorage.removeItem(SESSION_KEY),

  authenticate: (credentials: Credentials) =>
    request<SessionResponse>(credentials.mode === 'register' ? '/auth/register' : '/auth/login', {
      method: 'POST',
      body: JSON.stringify(
        credentials.mode === 'register'
          ? {
              name: credentials.name,
              email: credentials.email,
              password: credentials.password,
              workspace: credentials.workspace,
            }
          : { email: credentials.email, password: credentials.password },
      ),
    }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User & { id: string }>('/me'),
  workspaces: () => request<WorkspaceInfo[]>('/workspaces'),
  data: (workspaceId: string) => request<ApiData>(`/workspaces/${encodeURIComponent(workspaceId)}/data`),

  createMovement: (workspaceId: string, movement: MovementInput) =>
    request<Movement>(`/workspaces/${encodeURIComponent(workspaceId)}/movements`, {
      method: 'POST',
      body: JSON.stringify(movement),
    }),

  /** Edita, confirma (status 'confirmed') ou cancela/estorna (status 'cancelled'). */
  updateMovement: (workspaceId: string, movementId: string, changes: Partial<MovementInput>) =>
    request<Movement>(`/workspaces/${encodeURIComponent(workspaceId)}/movements/${encodeURIComponent(movementId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),

  createCategory: (workspaceId: string, category: { name: string; kind: Kind }) =>
    request<Category>(`/workspaces/${encodeURIComponent(workspaceId)}/categories`, {
      method: 'POST',
      body: JSON.stringify(category),
    }),

  deleteCategory: (workspaceId: string, categoryId: string) =>
    request<void>(`/workspaces/${encodeURIComponent(workspaceId)}/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    }),

  summary: (workspaceId: string, month: string) =>
    request<Summary>(`/workspaces/${encodeURIComponent(workspaceId)}/summary?month=${encodeURIComponent(month)}`),

  saveBudget: (workspaceId: string, budget: BudgetInput) =>
    request<{ id: string }>(`/workspaces/${encodeURIComponent(workspaceId)}/budgets`, {
      method: 'PUT',
      body: JSON.stringify(budget),
    }),

  deleteBudget: (workspaceId: string, budgetId: string) =>
    request<void>(`/workspaces/${encodeURIComponent(workspaceId)}/budgets/${encodeURIComponent(budgetId)}`, {
      method: 'DELETE',
    }),

  createAccount: (workspaceId: string, account: Omit<Account, 'id'>) =>
    request<Account>(`/workspaces/${encodeURIComponent(workspaceId)}/accounts`, {
      method: 'POST',
      body: JSON.stringify(account),
    }),

  createGoal: (workspaceId: string, goal: Omit<Goal, 'id' | 'saved'>) =>
    request<Goal>(`/workspaces/${encodeURIComponent(workspaceId)}/goals`, {
      method: 'POST',
      body: JSON.stringify(goal),
    }),

  deposit: (workspaceId: string, goalId: string, amount: number) =>
    request<Goal>(`/workspaces/${encodeURIComponent(workspaceId)}/goals/${encodeURIComponent(goalId)}/deposits`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  movements: (workspaceId: string, filters: { kind: 'all' | Kind; account: string; search: string }) => {
    const query = new URLSearchParams();
    if (filters.kind !== 'all') query.set('kind', filters.kind);
    if (filters.account !== 'all') query.set('account', filters.account);
    if (filters.search.trim()) query.set('search', filters.search.trim());
    const suffix = query.size ? `?${query.toString()}` : '';
    return request<Movement[]>(`/workspaces/${encodeURIComponent(workspaceId)}/movements${suffix}`);
  },
};

export type { ApiData, Credentials, SessionResponse, WorkspaceInfo };
