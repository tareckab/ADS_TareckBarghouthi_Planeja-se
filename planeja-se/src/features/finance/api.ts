import type { Account, Activity, Goal, Kind, Movement, User, Workspace } from './model';

const TOKEN_KEY = 'planeja-se-api-token';
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type WorkspaceInfo = { id: string; kind: Workspace };
type SessionResponse = {
  token: string;
  user: User & { id: string };
  workspaces: WorkspaceInfo[];
};
type Credentials = {
  mode: 'login' | 'register';
  name?: string;
  email: string;
  password: string;
};
type ApiData = {
  accounts: Account[];
  movements: Movement[];
  goals: Goal[];
  activity: Activity[];
};

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
  const token = localStorage.getItem(TOKEN_KEY);
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
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  authenticate: (credentials: Credentials) =>
    request<SessionResponse>(credentials.mode === 'register' ? '/auth/register' : '/auth/login', {
      method: 'POST',
      body: JSON.stringify(
        credentials.mode === 'register'
          ? { name: credentials.name, email: credentials.email, password: credentials.password }
          : { email: credentials.email, password: credentials.password },
      ),
    }),

  me: () => request<User & { id: string }>('/me'),
  workspaces: () => request<WorkspaceInfo[]>('/workspaces'),
  data: (workspaceId: string) => request<ApiData>(`/workspaces/${workspaceId}/data`),

  createMovement: (workspaceId: string, movement: Omit<Movement, 'id'>) =>
    request<Movement>(`/workspaces/${workspaceId}/movements`, {
      method: 'POST',
      body: JSON.stringify(movement),
    }),

  createAccount: (workspaceId: string, account: Omit<Account, 'id'>) =>
    request<Account>(`/workspaces/${workspaceId}/accounts`, {
      method: 'POST',
      body: JSON.stringify(account),
    }),

  createGoal: (workspaceId: string, goal: Omit<Goal, 'id' | 'saved'>) =>
    request<Goal>(`/workspaces/${workspaceId}/goals`, {
      method: 'POST',
      body: JSON.stringify(goal),
    }),

  deposit: (workspaceId: string, goalId: string, amount: number) =>
    request<Goal>(`/workspaces/${workspaceId}/goals/${goalId}/deposits`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  movements: (workspaceId: string, filters: { kind: 'all' | Kind; account: string; search: string }) => {
    const query = new URLSearchParams();
    if (filters.kind !== 'all') query.set('kind', filters.kind);
    if (filters.account !== 'all') query.set('account', filters.account);
    if (filters.search.trim()) query.set('search', filters.search.trim());
    const suffix = query.size ? `?${query.toString()}` : '';
    return request<Movement[]>(`/workspaces/${workspaceId}/movements${suffix}`);
  },
};

export type { ApiData, Credentials, SessionResponse, WorkspaceInfo };
