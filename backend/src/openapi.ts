const errorResponse = {
  description: 'Erro na requisição.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const json = (schema: object) => ({ 'application/json': { schema } });
const ok = (description: string, schema: object) => ({ description, content: json(schema) });
const errors = { '400': errorResponse, '401': errorResponse, '404': errorResponse, '409': errorResponse };
const idParameter = (name: string) => ({ name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
const kindEnum = { type: 'string', enum: ['income', 'expense'] };
const movementInput = {
  title: { type: 'string', minLength: 1, maxLength: 160 },
  categoryId: { type: 'string', format: 'uuid', description: 'Categoria do mesmo tipo (entrada/saída) do lançamento.' },
  amount: { type: 'number', exclusiveMinimum: 0 },
  kind: kindEnum,
  date: { type: 'string', format: 'date' },
  account: { type: 'string', format: 'uuid' },
  priority: { type: 'string', enum: ['urgent', 'normal', 'low'], default: 'normal' },
};

const workspaceIdParameter = {
  name: 'workspaceId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Planeja-se API',
    version: '1.0.0',
    description: 'API de autenticação e gerenciamento financeiro pessoal e empresarial.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Status' },
    { name: 'Autenticação' },
    { name: 'Usuário' },
    { name: 'Espaços de trabalho' },
    { name: 'Contas' },
    { name: 'Movimentações' },
    { name: 'Categorias' },
    { name: 'Metas mensais' },
    { name: 'Resumo e recomendação' },
    { name: 'Metas' },
  ],
  components: {
    securitySchemes: {
      SessionAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Use o token JWT (campo session) retornado pelo cadastro ou login. Expira em 12 horas e é revogado no logout.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        required: ['error'],
      },
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          kind: { type: 'string', enum: ['personal', 'business'] },
        },
        required: ['id', 'kind'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['id', 'name', 'email'],
      },
      SessionResponse: {
        type: 'object',
        properties: {
          session: { type: 'string', description: 'Token JWT (HS256) da sessão.' },
          user: { $ref: '#/components/schemas/User' },
          workspaces: {
            type: 'array',
            items: { $ref: '#/components/schemas/Workspace' },
          },
        },
        required: ['session', 'user', 'workspaces'],
      },
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          bank: { type: 'string' },
          type: { type: 'string' },
          opening: { type: 'number' },
          color: { type: 'string' },
        },
        required: ['id', 'name', 'bank', 'type', 'opening', 'color'],
      },
      Movement: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          category: { type: 'string', description: 'Nome da categoria.' },
          categoryId: { type: 'string', format: 'uuid' },
          amount: { type: 'number', exclusiveMinimum: 0 },
          kind: kindEnum,
          date: { type: 'string', format: 'date' },
          account: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'] },
          priority: { type: 'string', enum: ['urgent', 'normal', 'low'] },
        },
        required: ['id', 'title', 'category', 'categoryId', 'amount', 'kind', 'date', 'account', 'status', 'priority'],
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          kind: kindEnum,
          usage: { type: 'integer', description: 'Quantidade de lançamentos na categoria.' },
        },
        required: ['id', 'name', 'kind', 'usage'],
      },
      Summary: {
        type: 'object',
        properties: {
          month: { type: 'string', example: '2026-11' },
          performance: {
            type: 'object',
            description: 'Somente transações confirmadas. change = variação % do resultado frente ao mês anterior (null sem base).',
            properties: {
              income: { type: 'number' }, expenses: { type: 'number' }, result: { type: 'number' },
              previousResult: { type: 'number' }, change: { type: 'number', nullable: true },
            },
          },
          pendingExpenses: { type: 'number' },
          budgets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' }, kind: kindEnum,
                categoryId: { type: 'string', format: 'uuid', nullable: true },
                category: { type: 'string', nullable: true },
                amount: { type: 'number' }, achieved: { type: 'number' }, pending: { type: 'number' },
                percent: { type: 'number', description: 'achieved / amount x 100 (confirmadas).' },
              },
            },
          },
          recommendation: {
            type: 'object',
            description: 'status no-budget quando não há meta de gasto. Considera despesas confirmadas + pendentes.',
            properties: {
              status: { type: 'string', enum: ['no-budget', 'ok', 'warning', 'exceeded'] },
              scope: { type: 'string', enum: ['workspace', 'categories'], nullable: true },
              limit: { type: 'number' }, committed: { type: 'number' }, remaining: { type: 'number' },
              daysLeft: { type: 'integer' }, dailyAllowance: { type: 'number' }, projected: { type: 'number' },
            },
          },
        },
      },
      Goal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          target: { type: 'number', exclusiveMinimum: 0 },
          saved: { type: 'number', minimum: 0 },
          color: { type: 'string' },
        },
        required: ['id', 'title', 'target', 'saved', 'color'],
      },
      WorkspaceData: {
        type: 'object',
        properties: {
          accounts: { type: 'array', items: { $ref: '#/components/schemas/Account' } },
          movements: { type: 'array', items: { $ref: '#/components/schemas/Movement' } },
          categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
          goals: { type: 'array', items: { $ref: '#/components/schemas/Goal' } },
          activity: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string' },
                detail: { type: 'string' },
                date: { type: 'string' },
                entity: { type: 'string', nullable: true },
                author: { type: 'string', nullable: true },
              },
              required: ['id', 'title', 'detail', 'date'],
            },
          },
        },
        required: ['accounts', 'movements', 'categories', 'goals', 'activity'],
      },
    },
  },
  security: [{ SessionAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Status'],
        summary: 'Verifica API e conexão com o banco',
        security: [],
        responses: {
          '200': {
            description: 'API ativa e banco conectado.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    database: { type: 'string', example: 'connected' },
                  },
                },
              },
            },
          },
          '500': errorResponse,
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Cria conta e sessão',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 120 },
                  email: { type: 'string', format: 'email', maxLength: 254 },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                  workspace: { type: 'string', enum: ['personal'], default: 'personal', description: 'Somente espaço pessoal no MVP; empresarial previsto para versões futuras.' },
                },
                required: ['name', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Conta criada.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionResponse' },
              },
            },
          },
          '400': errorResponse,
          '409': errorResponse,
          '429': { description: 'Limite de tentativas excedido.' },
          '500': errorResponse,
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Autentica usuário e cria sessão',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 1, maxLength: 128 },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Autenticação concluída.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SessionResponse' },
              },
            },
          },
          '400': errorResponse,
          '401': errorResponse,
          '429': { description: 'Limite de tentativas excedido.' },
          '500': errorResponse,
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Autenticação'],
        summary: 'Encerra a sessão atual',
        responses: {
          '204': { description: 'Sessão encerrada.' },
          '401': errorResponse,
          '500': errorResponse,
        },
      },
    },
    '/api/me': {
      get: {
        tags: ['Usuário'],
        summary: 'Retorna o usuário autenticado',
        responses: {
          '200': {
            description: 'Usuário atual.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/User' },
                    {
                      type: 'object',
                      properties: { created_at: { type: 'string', format: 'date-time' } },
                    },
                  ],
                },
              },
            },
          },
          '401': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/api/workspaces': {
      get: {
        tags: ['Espaços de trabalho'],
        summary: 'Lista os espaços do usuário',
        responses: {
          '200': {
            description: 'Espaços disponíveis.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Workspace' },
                },
              },
            },
          },
          '401': errorResponse,
        },
      },
    },
    '/api/workspaces/{workspaceId}/data': {
      get: {
        tags: ['Espaços de trabalho'],
        summary: 'Retorna os dados financeiros do espaço',
        parameters: [workspaceIdParameter],
        responses: {
          '200': {
            description: 'Dados financeiros.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WorkspaceData' },
              },
            },
          },
          '401': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/api/workspaces/{workspaceId}/accounts': {
      post: {
        tags: ['Contas'],
        summary: 'Cria conta financeira',
        parameters: [workspaceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 120 },
                  bank: { type: 'string', minLength: 1, maxLength: 120 },
                  type: { type: 'string', minLength: 1, maxLength: 40 },
                  opening: { type: 'number', default: 0 },
                  color: { type: 'string', default: 'lavender' },
                },
                required: ['name', 'bank', 'type'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Conta criada.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Account' },
              },
            },
          },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/api/workspaces/{workspaceId}/movements': {
      get: {
        tags: ['Movimentações'],
        summary: 'Lista movimentações com filtros opcionais',
        parameters: [
          workspaceIdParameter,
          {
            name: 'kind',
            in: 'query',
            schema: { type: 'string', enum: ['all', 'income', 'expense'] },
          },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'pending', 'confirmed', 'cancelled'] } },
          { name: 'account', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'category', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 120 } },
        ],
        responses: {
          '200': {
            description: 'Movimentações encontradas.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Movement' },
                },
              },
            },
          },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse,
        },
      },
      post: {
        tags: ['Movimentações'],
        summary: 'Registra movimentação e atividade',
        parameters: [workspaceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ...movementInput,
                  status: { type: 'string', enum: ['pending', 'confirmed'], default: 'confirmed' },
                },
                required: ['title', 'categoryId', 'amount', 'kind', 'date', 'account'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Movimentação registrada.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Movement' },
              },
            },
          },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/api/workspaces/{workspaceId}/movements/{movementId}': {
      patch: {
        tags: ['Movimentações'],
        summary: 'Edita, confirma (status confirmed) ou cancela/estorna (status cancelled) um lançamento',
        description: 'Lançamentos cancelados não podem mais ser alterados (409). Toda alteração é registrada no log.',
        parameters: [workspaceIdParameter, idParameter('movementId')],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            minProperties: 1,
            properties: { ...movementInput, status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'] } },
          }),
        },
        responses: { '200': ok('Lançamento atualizado.', { $ref: '#/components/schemas/Movement' }), ...errors },
      },
    },
    '/api/workspaces/{workspaceId}/categories': {
      get: {
        tags: ['Categorias'],
        summary: 'Lista as categorias de entrada e saída do espaço',
        parameters: [workspaceIdParameter],
        responses: { '200': ok('Categorias.', { type: 'array', items: { $ref: '#/components/schemas/Category' } }), ...errors },
      },
      post: {
        tags: ['Categorias'],
        summary: 'Cria categoria',
        parameters: [workspaceIdParameter],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: { name: { type: 'string', minLength: 1, maxLength: 80 }, kind: kindEnum },
            required: ['name', 'kind'],
          }),
        },
        responses: { '201': ok('Categoria criada.', { $ref: '#/components/schemas/Category' }), ...errors },
      },
    },
    '/api/workspaces/{workspaceId}/categories/{categoryId}': {
      delete: {
        tags: ['Categorias'],
        summary: 'Remove categoria sem lançamentos (409 se estiver em uso)',
        parameters: [workspaceIdParameter, idParameter('categoryId')],
        responses: { '204': { description: 'Removida.' }, ...errors },
      },
    },
    '/api/workspaces/{workspaceId}/budgets': {
      put: {
        tags: ['Metas mensais'],
        summary: 'Define ou atualiza a meta mensal de gasto (expense) ou faturamento (income)',
        description: 'categoryId nulo = meta do espaço inteiro. Uma meta por categoria, tipo e mês. Meses encerrados não podem ser alterados (409).',
        parameters: [workspaceIdParameter],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: {
              month: { type: 'string', example: '2026-11' },
              kind: kindEnum,
              categoryId: { type: 'string', format: 'uuid', nullable: true },
              amount: { type: 'number', exclusiveMinimum: 0 },
            },
            required: ['month', 'kind', 'amount'],
          }),
        },
        responses: {
          '200': ok('Meta atualizada.', { type: 'object', properties: { id: { type: 'string' } } }),
          '201': ok('Meta criada.', { type: 'object', properties: { id: { type: 'string' } } }),
          ...errors,
        },
      },
    },
    '/api/workspaces/{workspaceId}/budgets/{budgetId}': {
      delete: {
        tags: ['Metas mensais'],
        summary: 'Remove meta mensal de um mês ainda aberto',
        parameters: [workspaceIdParameter, idParameter('budgetId')],
        responses: { '204': { description: 'Removida.' }, ...errors },
      },
    },
    '/api/workspaces/{workspaceId}/summary': {
      get: {
        tags: ['Resumo e recomendação'],
        summary: 'Progresso das metas, % de ganhos/perdas e recomendação de quanto ainda pode gastar',
        parameters: [workspaceIdParameter, { name: 'month', in: 'query', schema: { type: 'string', example: '2026-11' } }],
        responses: { '200': ok('Resumo do mês.', { $ref: '#/components/schemas/Summary' }), ...errors },
      },
    },
    '/api/workspaces/{workspaceId}/goals': {
      post: {
        tags: ['Metas'],
        summary: 'Cria objetivo de economia (cofrinho)',
        parameters: [workspaceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', minLength: 1, maxLength: 160 },
                  target: { type: 'number', exclusiveMinimum: 0 },
                  color: { type: 'string', default: 'green' },
                },
                required: ['title', 'target'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Meta criada.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Goal' },
              },
            },
          },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/api/workspaces/{workspaceId}/goals/{goalId}/deposits': {
      post: {
        tags: ['Metas'],
        summary: 'Registra aporte em uma meta',
        parameters: [
          workspaceIdParameter,
          {
            name: 'goalId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { amount: { type: 'number', exclusiveMinimum: 0 } },
                required: ['amount'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Aporte registrado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Goal' },
              },
            },
          },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse,
        },
      },
    },
  },
} as const;
