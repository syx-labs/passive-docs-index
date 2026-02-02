/**
 * Framework Templates
 * Defines the structure and queries for each supported framework
 */

import type { FrameworkTemplate } from './types.js';

// ============================================================================
// Template Definitions
// ============================================================================

export const HONO_TEMPLATE: FrameworkTemplate = {
  name: 'hono',
  displayName: 'Hono',
  version: '4.x',
  source: 'context7',
  libraryId: '/honojs/hono',
  category: 'backend',
  priority: 'P0',
  description: 'Fast, lightweight web framework for the Edge. Type-safe, works with Bun/Node/Deno/Cloudflare Workers.',
  structure: {
    api: {
      'app.mdx': {
        query: 'How to create Hono app, new Hono(), app.basePath, app configuration options',
        topics: ['app creation', 'configuration', 'basePath'],
      },
      'context.mdx': {
        query: 'Hono context object c.req c.res c.json c.text c.html c.get c.set c.var request response',
        topics: ['context', 'request', 'response', 'storage'],
      },
      'routing.mdx': {
        query: 'Hono routing app.get app.post route parameters wildcards method chaining nested routes',
        topics: ['routing', 'params', 'wildcards'],
      },
      'middleware.mdx': {
        query: 'Hono middleware pattern app.use built-in middlewares cors logger bearer auth',
        topics: ['middleware', 'built-in', 'custom'],
      },
    },
    patterns: {
      'error-handling.mdx': {
        query: 'Hono error handling HTTPException onError app.onError custom error responses',
        topics: ['errors', 'HTTPException'],
      },
      'validation.mdx': {
        query: 'Hono zod validator @hono/zod-validator schema validation request body query params',
        topics: ['validation', 'zod'],
      },
      'openapi.mdx': {
        query: '@hono/zod-openapi createRoute OpenAPI spec generation swagger documentation',
        topics: ['openapi', 'swagger', 'spec'],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: 'c.req.headers',
      warning: 'Use c.req.raw.headers for Better Auth integration',
      correct: 'c.req.raw.headers',
    },
    {
      pattern: "app.use('*',",
      warning: 'Global middleware should be registered before routes',
      correct: 'Register before app.get/post/etc calls',
    },
  ],
};

export const DRIZZLE_TEMPLATE: FrameworkTemplate = {
  name: 'drizzle',
  displayName: 'Drizzle ORM',
  version: '0.44',
  source: 'context7',
  libraryId: '/drizzle-team/drizzle-orm',
  category: 'database',
  priority: 'P0',
  description: 'TypeScript ORM with type-safe SQL queries. Supports PostgreSQL, MySQL, SQLite.',
  structure: {
    schema: {
      'tables.mdx': {
        query: 'Drizzle ORM table definition pgTable mysqlTable sqliteTable columns types serial varchar text integer boolean timestamp',
        topics: ['tables', 'columns', 'types'],
      },
      'relations.mdx': {
        query: 'Drizzle ORM relations one many references foreign key relationships',
        topics: ['relations', 'foreign keys'],
      },
      'types.mdx': {
        query: 'Drizzle ORM TypeScript types inference InferSelectModel InferInsertModel',
        topics: ['types', 'inference'],
      },
    },
    queries: {
      'select.mdx': {
        query: 'Drizzle ORM select query db.select from where orderBy limit offset joins',
        topics: ['select', 'where', 'joins'],
      },
      'insert.mdx': {
        query: 'Drizzle ORM insert update delete db.insert db.update db.delete returning onConflict',
        topics: ['insert', 'update', 'delete'],
      },
      'transactions.mdx': {
        query: 'Drizzle ORM transactions db.transaction rollback savepoint batch',
        topics: ['transactions', 'batch'],
      },
    },
    migrations: {
      'generate.mdx': {
        query: 'Drizzle Kit generate migrations drizzle-kit generate:pg config schema',
        topics: ['migrations', 'generate'],
      },
      'push.mdx': {
        query: 'Drizzle Kit push migrate db:push db:migrate apply migrations',
        topics: ['push', 'migrate'],
      },
    },
  },
};

export const BETTER_AUTH_TEMPLATE: FrameworkTemplate = {
  name: 'better-auth',
  displayName: 'Better Auth',
  version: '1.x',
  source: 'context7',
  libraryId: '/better-auth/better-auth',
  category: 'auth',
  priority: 'P0',
  description: 'Comprehensive TypeScript authentication framework with multiple providers.',
  structure: {
    config: {
      'setup.mdx': {
        query: 'Better Auth setup configuration betterAuth() database secret baseURL trustedOrigins',
        topics: ['setup', 'configuration'],
      },
      'providers.mdx': {
        query: 'Better Auth social providers OAuth Google GitHub Discord email password magic link',
        topics: ['providers', 'OAuth', 'social'],
      },
    },
    sessions: {
      'jwt.mdx': {
        query: 'Better Auth JWT tokens session management jwt plugin configuration',
        topics: ['jwt', 'tokens'],
      },
      'cookies.mdx': {
        query: 'Better Auth session cookies httpOnly secure sameSite cookie configuration',
        topics: ['cookies', 'session'],
      },
    },
    integration: {
      'hono.mdx': {
        query: 'Better Auth Hono integration toHonoHandler middleware c.req.raw.headers',
        topics: ['hono', 'integration'],
      },
      'drizzle.mdx': {
        query: 'Better Auth Drizzle adapter drizzleAdapter schema generation',
        topics: ['drizzle', 'database'],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: 'c.req.headers',
      warning: 'Must use c.req.raw for Hono integration',
      correct: 'auth.api.getSession({ headers: c.req.raw.headers })',
    },
  ],
};

export const ZOD_TEMPLATE: FrameworkTemplate = {
  name: 'zod',
  displayName: 'Zod',
  version: '4.x',
  source: 'context7',
  libraryId: '/colinhacks/zod',
  category: 'validation',
  priority: 'P0',
  description: 'TypeScript-first schema validation with static type inference.',
  structure: {
    basics: {
      'schemas.mdx': {
        query: 'Zod schema definition z.object z.string z.number z.boolean z.array z.enum z.literal z.union',
        topics: ['schemas', 'primitives', 'objects'],
      },
      'validation.mdx': {
        query: 'Zod parse safeParse validation errors ZodError formatting error messages',
        topics: ['validation', 'parsing', 'errors'],
      },
    },
    advanced: {
      'transforms.mdx': {
        query: 'Zod transform preprocess default optional nullable coerce pipe',
        topics: ['transforms', 'coercion'],
      },
      'refinements.mdx': {
        query: 'Zod refine superRefine custom validation async validation discriminatedUnion',
        topics: ['refinements', 'custom validation'],
      },
    },
  },
};

export const TANSTACK_QUERY_TEMPLATE: FrameworkTemplate = {
  name: 'tanstack-query',
  displayName: 'TanStack Query',
  version: '5.x',
  source: 'context7',
  libraryId: '/tanstack/query',
  category: 'frontend',
  priority: 'P1',
  description: 'Powerful asynchronous state management for TS/JS, React, Solid, Vue, Svelte, and Angular.',
  structure: {
    basics: {
      'queries.mdx': {
        query: 'TanStack Query useQuery queryKey queryFn staleTime cacheTime enabled select',
        topics: ['useQuery', 'configuration'],
      },
      'mutations.mdx': {
        query: 'TanStack Query useMutation mutate mutateAsync onSuccess onError onSettled',
        topics: ['useMutation', 'side effects'],
      },
    },
    advanced: {
      'invalidation.mdx': {
        query: 'TanStack Query cache invalidation queryClient.invalidateQueries refetch',
        topics: ['invalidation', 'cache'],
      },
      'optimistic.mdx': {
        query: 'TanStack Query optimistic updates setQueryData onMutate context rollback',
        topics: ['optimistic updates'],
      },
    },
  },
};

export const TANSTACK_ROUTER_TEMPLATE: FrameworkTemplate = {
  name: 'tanstack-router',
  displayName: 'TanStack Router',
  version: '1.x',
  source: 'context7',
  libraryId: '/tanstack/router',
  category: 'frontend',
  priority: 'P1',
  description: 'Type-safe router with built-in caching for React applications.',
  structure: {
    basics: {
      'routes.mdx': {
        query: 'TanStack Router createRoute createRootRoute path component loader',
        topics: ['routes', 'configuration'],
      },
      'navigation.mdx': {
        query: 'TanStack Router Link useNavigate useRouter navigation search params',
        topics: ['navigation', 'links'],
      },
    },
    advanced: {
      'loaders.mdx': {
        query: 'TanStack Router loader beforeLoad data fetching route context',
        topics: ['loaders', 'data fetching'],
      },
      'search.mdx': {
        query: 'TanStack Router search params validation zod searchSchema',
        topics: ['search params', 'validation'],
      },
    },
  },
};

export const REACT_TEMPLATE: FrameworkTemplate = {
  name: 'react',
  displayName: 'React',
  version: '19.x',
  source: 'context7',
  libraryId: '/facebook/react',
  category: 'frontend',
  priority: 'P1',
  description: 'A JavaScript library for building user interfaces.',
  structure: {
    hooks: {
      'state.mdx': {
        query: 'React hooks useState useReducer state management functional components',
        topics: ['useState', 'useReducer'],
      },
      'effects.mdx': {
        query: 'React useEffect useLayoutEffect cleanup dependencies side effects',
        topics: ['useEffect', 'side effects'],
      },
      'refs.mdx': {
        query: 'React useRef forwardRef useImperativeHandle DOM references',
        topics: ['refs', 'DOM'],
      },
    },
    patterns: {
      'server-components.mdx': {
        query: 'React Server Components RSC use client use server async components',
        topics: ['RSC', 'server components'],
      },
      'suspense.mdx': {
        query: 'React Suspense lazy loading code splitting fallback streaming',
        topics: ['Suspense', 'lazy'],
      },
    },
  },
};

export const VITE_TEMPLATE: FrameworkTemplate = {
  name: 'vite',
  displayName: 'Vite',
  version: '6.x',
  source: 'context7',
  libraryId: '/vitejs/vite',
  category: 'build',
  priority: 'P1',
  description: 'Next generation frontend tooling. Fast HMR, optimized builds.',
  structure: {
    config: {
      'basic.mdx': {
        query: 'Vite configuration vite.config.ts plugins resolve alias define',
        topics: ['configuration', 'plugins'],
      },
      'env.mdx': {
        query: 'Vite environment variables import.meta.env VITE_ prefix .env files',
        topics: ['env', 'variables'],
      },
    },
    features: {
      'hmr.mdx': {
        query: 'Vite HMR hot module replacement import.meta.hot accept',
        topics: ['HMR', 'hot reload'],
      },
      'build.mdx': {
        query: 'Vite build optimization rollup chunks splitting output',
        topics: ['build', 'optimization'],
      },
    },
  },
};

export const VITEST_TEMPLATE: FrameworkTemplate = {
  name: 'vitest',
  displayName: 'Vitest',
  version: '3.x',
  source: 'context7',
  libraryId: '/vitest-dev/vitest',
  category: 'testing',
  priority: 'P1',
  description: 'Blazing fast unit test framework powered by Vite.',
  structure: {
    basics: {
      'tests.mdx': {
        query: 'Vitest test describe it expect assertions toBe toEqual toMatchSnapshot',
        topics: ['tests', 'assertions'],
      },
      'mocking.mdx': {
        query: 'Vitest mock vi.mock vi.fn vi.spyOn mock modules functions',
        topics: ['mocking', 'spies'],
      },
    },
    config: {
      'setup.mdx': {
        query: 'Vitest configuration vitest.config.ts globals environment coverage',
        topics: ['configuration', 'setup'],
      },
    },
  },
};

export const TAILWIND_TEMPLATE: FrameworkTemplate = {
  name: 'tailwind',
  displayName: 'Tailwind CSS',
  version: '4.x',
  source: 'context7',
  libraryId: '/tailwindlabs/tailwindcss',
  category: 'styling',
  priority: 'P1',
  description: 'A utility-first CSS framework for rapid UI development.',
  structure: {
    config: {
      'setup.mdx': {
        query: 'Tailwind CSS v4 configuration CSS-first @theme @import PostCSS Vite',
        topics: ['configuration', 'setup'],
      },
      'theme.mdx': {
        query: 'Tailwind CSS v4 theme customization @theme colors spacing fonts',
        topics: ['theme', 'customization'],
      },
    },
    utilities: {
      'layout.mdx': {
        query: 'Tailwind CSS layout flex grid container responsive breakpoints',
        topics: ['layout', 'responsive'],
      },
      'components.mdx': {
        query: 'Tailwind CSS components buttons cards forms inputs modals',
        topics: ['components', 'UI'],
      },
    },
  },
};

// ============================================================================
// Template Registry
// ============================================================================

export const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  hono: HONO_TEMPLATE,
  drizzle: DRIZZLE_TEMPLATE,
  'better-auth': BETTER_AUTH_TEMPLATE,
  zod: ZOD_TEMPLATE,
  'tanstack-query': TANSTACK_QUERY_TEMPLATE,
  'tanstack-router': TANSTACK_ROUTER_TEMPLATE,
  react: REACT_TEMPLATE,
  vite: VITE_TEMPLATE,
  vitest: VITEST_TEMPLATE,
  tailwind: TAILWIND_TEMPLATE,
};

export function getTemplate(name: string): FrameworkTemplate | undefined {
  return FRAMEWORK_TEMPLATES[name];
}

export function hasTemplate(name: string): boolean {
  return name in FRAMEWORK_TEMPLATES;
}

export function listTemplates(): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES);
}

export function getTemplatesByCategory(category: FrameworkTemplate['category']): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES).filter((t) => t.category === category);
}

export function getTemplatesByPriority(priority: FrameworkTemplate['priority']): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES).filter((t) => t.priority === priority);
}
