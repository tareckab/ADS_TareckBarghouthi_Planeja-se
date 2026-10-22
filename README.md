# Planeja-se
Esse projeto trata-se de uma ideia voltada a um SaaS de gerencimento financeiro. Destacando-se por exibir com clareza e intuitividade as respectivas informações que realmente são atrativas para o usuario.

## Backend

O backend REST e o banco PostgreSQL 17 ficam no projeto separado [`backend/`](./backend/README.md). Consulte o README do backend para configurar o banco, aplicar as migrações e iniciar a API.

## Iniciar a comunicação entre frontend e backend

Com a API e o banco iniciados conforme o README do backend, abra outro terminal:

```powershell
cd planeja-se
Copy-Item .env.example .env
npm install
npm run dev
```

O frontend usa `VITE_API_URL=http://localhost:3000` por padrão. Crie uma conta pela tela inicial; após autenticar, a tela carrega os dados da API e salva contas, movimentações, metas e aportes no PostgreSQL.
