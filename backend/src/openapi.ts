const errorResponse = {
  description: 'Erro na requisição.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
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
    { name: 'Metas' },
  ],
  components: {
    securitySchemes: {
      SessionAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Sessão opaca',
        description: 'Use a sessão retornada pelo cadastro ou login.',
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
          session: { type: 'string', description: 'Credencial opaca da sessão.' },
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
          category: { type: 'string' },
          amount: { type: 'number', exclusiveMinimum: 0 },
          kind: { type: 'string', enum: ['income', 'expense'] },
          date: { type: 'string', format: 'date' },
          account: { type: 'string', format: 'uuid' },
        },
        required: ['id', 'title', 'category', 'amount', 'kind', 'date', 'account'],
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
              },
              required: ['id', 'title', 'detail', 'date'],
            },
          },
        },
        required: ['accounts', 'movements', 'goals', 'activity'],
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
          { name: 'account', in: 'query', schema: { type: 'string', format: 'uuid' } },
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
                  title: { type: 'string', minLength: 1, maxLength: 160 },
                  category: { type: 'string', minLength: 1, maxLength: 80 },
                  amount: { type: 'number', exclusiveMinimum: 0 },
                  kind: { type: 'string', enum: ['income', 'expense'] },
                  date: { type: 'string', format: 'date' },
                  account: { type: 'string', format: 'uuid' },
                },
                required: ['title', 'category', 'amount', 'kind', 'date', 'account'],
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
    '/api/workspaces/{workspaceId}/goals': {
      post: {
        tags: ['Metas'],
        summary: 'Cria meta financeira',
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
