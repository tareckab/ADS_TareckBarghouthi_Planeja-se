# Planeja-se

MVP de organização financeira pessoal e empresarial, feito com React, TypeScript e Vite.
O layout e os componentes usam Tailwind CSS v4; `src/styles/app.css` mantém apenas os detalhes visuais específicos do produto, como gráficos e estados de marca.

## Estrutura

```text
src/
  app/                    # Controller da aplicação, navegação e persistência
  components/             # Componentes compartilhados entre funcionalidades
  features/
    accounts/             # Contas e seus extratos
    auth/                 # Cadastro e login integrados à API
    dashboard/            # Visão geral e indicadores
    finance/              # Tipos, dados iniciais e formatação financeira
    goals/                # Metas e aportes
    recommendations/      # Ajuda e recomendações
    transactions/         # Lançamentos, filtros, log e leitura de extratos
  styles/                 # Estilos globais e da aplicação
```

## Desenvolvimento

```sh
npm install
npm run dev
```

Para verificar o build de produção:

```sh
npm run build
```

## Funcionalidades e limites

- Cadastro e login usam a API e sessões persistidas no PostgreSQL; configure e inicie o backend conforme [`backend/README.md`](../backend/README.md).
- Contas, movimentações, metas e aportes são persistidos no PostgreSQL, separados entre os espaços pessoal e empresarial.
- A sessão atual fica no `localStorage` deste navegador.
- A leitura de imagem usa OCR no navegador. Os campos reconhecidos devem ser conferidos antes do registro.
- Contas bancárias não são conectadas automaticamente.
