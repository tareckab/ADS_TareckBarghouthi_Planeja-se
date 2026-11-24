# Backend Planeja-se

API REST separada para autenticação e persistência dos dados financeiros do Planeja-se. O banco de dados é PostgreSQL 17; valores monetários são armazenados em `NUMERIC(14, 2)` e as operações que alteram lançamentos/aportes e seu histórico são executadas em transações SQL.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL 17 instalado e em execução

## Executar localmente

Use o PostgreSQL local em `localhost:5432` e o banco `planeja-se`. Se o banco ainda não existir, crie-o pelo Query Tool do pgAdmin:

```sql
CREATE DATABASE "planeja-se";
```

No diretório `backend`, crie o `.env` somente se ainda não existir:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run db:migrate
npm run dev
```

No `.env`, substitua `SUA_SENHA` pela senha do usuário `postgres`. O servidor local está configurado para autenticação SCRAM e rejeitou conexões sem senha; o pgAdmin pode ter guardado a senha anteriormente. Se não souber a senha, redefina-a pelo Query Tool do pgAdmin conectado como `postgres`, por exemplo com `ALTER USER postgres WITH PASSWORD 'uma_nova_senha';`, e atualize o `.env`. Não compartilhe nem versione essa senha; `.env` já está no `.gitignore`. Caracteres especiais da senha precisam ser codificados para URL.


O `db:migrate` aplica, em ordem, os arquivos de `src/db/migrations/` ainda não registrados na tabela `schema_migrations` (cada um em uma transação) e pode ser executado novamente. `npm test` roda os testes das regras de desempenho e recomendação de gastos. As sessões (tokens JWT) expiram após 12 horas e podem ser encerradas pelo endpoint de logout. Defina `JWT_SECRET` no `.env` com pelo menos 32 caracteres aleatórios.

A API inicia em `http://localhost:3000`; `GET /health` verifica a conexão com o banco. A documentação interativa Swagger fica disponível em `http://localhost:3000/api-docs`. `CORS_ORIGINS` aceita uma lista de origens separadas por vírgula.

## Endpoints

As rotas abaixo de `/api` (exceto cadastro e login) exigem `Authorization: Bearer <token>`. O token é um JWT (HS256) assinado com `JWT_SECRET`, retornado no campo `session` do cadastro/login. Ele contém o id do usuário (`sub`) e o id da sessão (`sid`); a sessão fica registrada no banco (apenas o hash do token), o que permite revogar o JWT no logout antes da expiração.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/register` | Cria usuário e um espaço do tipo escolhido no cadastro |
| POST | `/api/auth/login` | Autentica usuário e cria uma sessão |
| POST | `/api/auth/logout` | Encerra a sessão autenticada |
| GET | `/api/me` | Retorna o usuário autenticado |
| GET | `/api/workspaces` | Lista os espaços do usuário |
| GET | `/api/workspaces/:workspaceId/data` | Retorna contas, movimentações, categorias, objetivos e registro de alterações |
| POST | `/api/workspaces/:workspaceId/accounts` | Cria conta |
| GET | `/api/workspaces/:workspaceId/movements` | Lista movimentações; filtros `kind`, `status`, `account`, `category`, `from`, `to` e `search` |
| POST | `/api/workspaces/:workspaceId/movements` | Cria movimentação (status `confirmed` ou `pending`, prioridade) e registro no log atomicamente |
| PATCH | `/api/workspaces/:workspaceId/movements/:movementId` | Edita, confirma (`status: confirmed`) ou cancela/estorna (`status: cancelled`) |
| GET / POST | `/api/workspaces/:workspaceId/categories` | Lista ou cria categorias de entrada/saída |
| DELETE | `/api/workspaces/:workspaceId/categories/:categoryId` | Remove categoria sem lançamentos |
| PUT | `/api/workspaces/:workspaceId/budgets` | Define ou atualiza meta mensal de gasto/faturamento (geral ou por categoria) |
| DELETE | `/api/workspaces/:workspaceId/budgets/:budgetId` | Remove meta mensal de mês ainda aberto |
| GET | `/api/workspaces/:workspaceId/summary?month=AAAA-MM` | Progresso das metas, % de ganhos/perdas e recomendação de quanto ainda pode gastar |
| POST | `/api/workspaces/:workspaceId/goals` | Cria objetivo de economia |
| POST | `/api/workspaces/:workspaceId/goals/:goalId/deposits` | Registra aporte (o valor guardado é a soma dos aportes) |

O cadastro aceita `{ "name": "Nome", "email": "email@exemplo.com", "password": "senha-com-8-ou-mais", "workspace": "personal" }`; `workspace` deve ser `personal` ou `business` e fica definido na criação da conta. Os valores enviados em `amount`, `opening` e `target` são números em reais. A API verifica a propriedade do espaço de trabalho em cada operação e valida o vínculo da conta antes de registrar uma movimentação.

## Build de produção

```powershell
npm run build
npm start
```
