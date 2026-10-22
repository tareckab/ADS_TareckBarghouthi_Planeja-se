# Backend Planeja-se

API REST separada para autenticação e persistência dos dados financeiros do Planeja-se. O banco de dados é PostgreSQL 17; valores monetários são armazenados em `NUMERIC(14, 2)` e as operações que alteram lançamentos/aportes e seu histórico são executadas em transações SQL.

## Requisitos

- Node.js 20 ou superior
- Docker com Docker Compose, ou uma instância PostgreSQL 17

## Executar localmente

No diretório `backend`, para usar o banco `planeja-se` criado no pgAdmin:

```powershell
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run dev
```

No `.env`, substitua `SUA_SENHA` pela senha do usuário `postgres`. O servidor local está configurado para autenticação SCRAM e rejeitou conexões sem senha; o pgAdmin pode ter guardado a senha anteriormente. Se não souber a senha, redefina-a pelo Query Tool do pgAdmin conectado como `postgres`, por exemplo com `ALTER USER postgres WITH PASSWORD 'uma_nova_senha';`, e atualize o `.env`. Não compartilhe nem versione essa senha; `.env` já está no `.gitignore`. Caracteres especiais da senha precisam ser codificados para URL.

Alternativamente, para iniciar uma instância isolada PostgreSQL 17 com Docker Compose, use `docker compose up -d` e altere `DATABASE_URL` no `.env` para `postgresql://planeja:planeja@localhost:5432/planeja_se`.

Defina `JWT_SECRET` em `.env` com pelo menos 32 caracteres aleatórios antes de usar a API fora do ambiente local. O script de migração é idempotente e pode ser executado novamente.

A API inicia em `http://localhost:3000`; `GET /health` verifica a conexão com o banco. `CORS_ORIGINS` aceita uma lista de origens separadas por vírgula.

## Endpoints

As rotas abaixo de `/api` (exceto cadastro e login) exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/register` | Cria usuário e espaços pessoal/empresarial |
| POST | `/api/auth/login` | Autentica usuário e retorna token JWT |
| GET | `/api/me` | Retorna o usuário autenticado |
| GET | `/api/workspaces` | Lista os espaços do usuário |
| GET | `/api/workspaces/:workspaceId/data` | Retorna contas, movimentações, metas e atividade |
| POST | `/api/workspaces/:workspaceId/accounts` | Cria conta |
| GET | `/api/workspaces/:workspaceId/movements` | Lista movimentações; suporta `kind`, `account` e `search` |
| POST | `/api/workspaces/:workspaceId/movements` | Cria movimentação e registro de atividade atomicamente |
| POST | `/api/workspaces/:workspaceId/goals` | Cria meta |
| POST | `/api/workspaces/:workspaceId/goals/:goalId/deposits` | Registra aporte e atualiza progresso atomicamente |

O cadastro aceita `{ "name": "Nome", "email": "email@exemplo.com", "password": "senha-com-8-ou-mais" }`. Os valores enviados em `amount`, `opening` e `target` são números em reais. A API verifica a propriedade do espaço de trabalho em cada operação e valida o vínculo da conta antes de registrar uma movimentação.

## Build de produção

```powershell
npm run build
npm start
```
