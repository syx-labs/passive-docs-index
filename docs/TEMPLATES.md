# Criando Templates de Frameworks

Este guia explica como criar templates de documentação para novos frameworks.

## Estrutura do Template

```typescript
interface FrameworkTemplate {
  name: string;           // ID único (lowercase, hyphens)
  displayName: string;    // Nome para exibição
  version: string;        // Versão suportada (e.g., "4.x")
  source: 'context7' | 'template'; // Fonte dos docs
  libraryId?: string;     // ID do Context7 (e.g., "/honojs/hono")
  category: 'backend' | 'frontend' | 'validation' | 'database' | 'auth' | 'styling' | 'build' | 'testing';
  priority: 'P0' | 'P1' | 'P2'; // Importância
  description: string;    // Descrição breve
  structure: Record<string, Record<string, DocFileTemplate>>;
  criticalPatterns?: CriticalPattern[];
}
```

## Exemplo Completo

```typescript
// src/lib/templates.ts

export const MEU_FRAMEWORK_TEMPLATE: FrameworkTemplate = {
  name: 'meu-framework',
  displayName: 'Meu Framework',
  version: '2.x',
  source: 'context7',
  libraryId: '/org/meu-framework',
  category: 'backend',
  priority: 'P1',
  description: 'Framework para criar APIs REST de forma simples.',

  structure: {
    // Categoria: api
    api: {
      'getting-started.mdx': {
        query: 'How to get started with Meu Framework, installation, basic setup, hello world example',
        topics: ['installation', 'setup', 'hello world'],
      },
      'routing.mdx': {
        query: 'Meu Framework routing system, defining routes, route parameters, wildcards, methods',
        topics: ['routing', 'params', 'methods'],
      },
      'middleware.mdx': {
        query: 'Meu Framework middleware pattern, creating middleware, built-in middleware, order',
        topics: ['middleware', 'built-in', 'custom'],
      },
    },

    // Categoria: advanced
    advanced: {
      'error-handling.mdx': {
        query: 'Meu Framework error handling, custom errors, error middleware, status codes',
        topics: ['errors', 'handling', 'status codes'],
      },
      'testing.mdx': {
        query: 'Testing Meu Framework applications, unit tests, integration tests, mocking',
        topics: ['testing', 'mocking'],
      },
    },
  },

  // Padrões críticos que AI deve seguir
  criticalPatterns: [
    {
      pattern: 'app.use(middleware)',
      warning: 'Middleware must be registered before routes',
      correct: 'Register middleware at the top of your app file, before any route definitions',
    },
    {
      pattern: 'async (req, res)',
      warning: 'Always handle async errors',
      correct: 'Wrap async handlers with try-catch or use an error middleware',
    },
  ],
};

// Registrar no FRAMEWORK_TEMPLATES
export const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  // ... outros templates
  'meu-framework': MEU_FRAMEWORK_TEMPLATE,
};
```

## Campos do Template

### `name`
ID único do template. Use lowercase e hyphens:
- ✅ `tanstack-query`
- ✅ `better-auth`
- ❌ `TanStack Query`
- ❌ `better_auth`

### `displayName`
Nome para exibição ao usuário:
- `TanStack Query`
- `Better Auth`

### `version`
Versão suportada. Use o formato:
- `4.x` para major versions
- `0.44` para pre-1.0

### `source`
- `context7`: Docs serão buscados via Context7 MCP
- `template`: Docs são estáticos/manuais

### `libraryId`
ID da biblioteca no Context7. Formato: `/org/repo`

Para encontrar o ID:
```bash
# Via CLI do Context7
mcp-cli call plugin_context7_context7/resolve-library-id '{"libraryName": "hono"}'
```

### `category`
Categoria do framework para organização:
- `backend`: Hono, Express, Fastify
- `frontend`: React, Vue, Svelte
- `database`: Drizzle, Prisma
- `auth`: Better Auth, Lucia
- `validation`: Zod, Valibot
- `styling`: Tailwind
- `build`: Vite, esbuild
- `testing`: Vitest, Playwright

### `priority`
Importância do framework:
- `P0`: Essencial - frameworks muito usados
- `P1`: Recomendado - frameworks populares
- `P2`: Opcional - frameworks de nicho

### `structure`
Define a estrutura de arquivos de documentação:

```typescript
structure: {
  [categoria]: {
    [arquivo.mdx]: {
      query: 'Query para Context7',
      topics: ['tópico1', 'tópico2'],
    }
  }
}
```

**Dicas para queries:**
- Seja específico mas abrangente
- Inclua nomes de funções/métodos principais
- Mencione casos de uso comuns

### `criticalPatterns`
Padrões que AI deve seguir (ou evitar):

```typescript
criticalPatterns: [
  {
    pattern: 'código problemático',
    warning: 'Explicação do problema',
    correct: 'Forma correta de fazer',
  }
]
```

## Estrutura de Arquivos Recomendada

### Para Frameworks Backend

```typescript
structure: {
  api: {
    'app.mdx': { /* criação da app */ },
    'routing.mdx': { /* definição de rotas */ },
    'middleware.mdx': { /* middlewares */ },
    'context.mdx': { /* objeto de contexto */ },
  },
  patterns: {
    'error-handling.mdx': { /* tratamento de erros */ },
    'validation.mdx': { /* validação de dados */ },
    'authentication.mdx': { /* autenticação */ },
  },
}
```

### Para Frameworks Frontend

```typescript
structure: {
  basics: {
    'components.mdx': { /* componentes */ },
    'state.mdx': { /* gerenciamento de estado */ },
    'props.mdx': { /* props e comunicação */ },
  },
  hooks: {
    'built-in.mdx': { /* hooks nativos */ },
    'custom.mdx': { /* hooks customizados */ },
  },
  patterns: {
    'composition.mdx': { /* composição */ },
    'performance.mdx': { /* otimização */ },
  },
}
```

### Para ORMs/Database

```typescript
structure: {
  schema: {
    'tables.mdx': { /* definição de tabelas */ },
    'relations.mdx': { /* relações */ },
    'types.mdx': { /* tipos */ },
  },
  queries: {
    'select.mdx': { /* queries de leitura */ },
    'insert.mdx': { /* inserções */ },
    'update.mdx': { /* atualizações */ },
    'delete.mdx': { /* deleções */ },
  },
  migrations: {
    'generate.mdx': { /* gerar migrations */ },
    'apply.mdx': { /* aplicar migrations */ },
  },
}
```

## Testando seu Template

1. Adicione o template em `src/lib/templates.ts`
2. Registre no `FRAMEWORK_TEMPLATES`
3. Rebuild: `bun run build`
4. Teste:

```bash
# Verificar se aparece na lista
pdi list

# Testar adição
pdi add meu-framework
```

## Checklist para Novo Template

- [ ] `name` é único e lowercase
- [ ] `libraryId` está correto (verificado via Context7)
- [ ] `version` reflete a versão atual do framework
- [ ] `category` está correta
- [ ] `structure` cobre os principais tópicos
- [ ] Queries são específicas e úteis
- [ ] `criticalPatterns` inclui armadilhas comuns
- [ ] Template registrado em `FRAMEWORK_TEMPLATES`
- [ ] Template adicionado em `KNOWN_FRAMEWORKS` (constants.ts)
