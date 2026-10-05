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
    auth/                 # Telas demonstrativas de cadastro e login
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

## Escopo do protótipo

- Cadastro e login são demonstrativos; não há autenticação de servidor.
- Os dados são persistidos no `localStorage` deste navegador e separados entre os espaços pessoal e empresarial.
- A leitura de imagem usa OCR no navegador. Os campos reconhecidos devem ser conferidos antes do registro.
- Contas bancárias não são conectadas automaticamente.
