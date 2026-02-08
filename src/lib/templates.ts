/**
 * Framework Templates
 * Defines the structure and queries for each supported framework
 */

import type { FrameworkTemplate } from "./types.js";

// ============================================================================
// Template Definitions
// ============================================================================

export const HONO_TEMPLATE: FrameworkTemplate = {
  name: "hono",
  displayName: "Hono",
  version: "4.x",
  source: "context7",
  libraryId: "/honojs/hono",
  category: "backend",
  priority: "P0",
  description:
    "Fast, lightweight web framework for the Edge. Type-safe, works with Bun/Node/Deno/Cloudflare Workers.",
  structure: {
    api: {
      "app.mdx": {
        query:
          "How to create Hono app, new Hono(), app.basePath, app configuration options",
        topics: ["app creation", "configuration", "basePath"],
      },
      "context.mdx": {
        query:
          "Hono context object c.req c.res c.json c.text c.html c.get c.set c.var request response",
        topics: ["context", "request", "response", "storage"],
      },
      "routing.mdx": {
        query:
          "Hono routing app.get app.post route parameters wildcards method chaining nested routes",
        topics: ["routing", "params", "wildcards"],
      },
      "middleware.mdx": {
        query:
          "Hono middleware pattern app.use built-in middlewares cors logger bearer auth",
        topics: ["middleware", "built-in", "custom"],
      },
    },
    patterns: {
      "error-handling.mdx": {
        query:
          "Hono error handling HTTPException onError app.onError custom error responses",
        topics: ["errors", "HTTPException"],
      },
      "validation.mdx": {
        query:
          "Hono zod validator @hono/zod-validator schema validation request body query params",
        topics: ["validation", "zod"],
      },
      "openapi.mdx": {
        query:
          "@hono/zod-openapi createRoute OpenAPI spec generation swagger documentation",
        topics: ["openapi", "swagger", "spec"],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: "c.req.headers",
      warning: "Use c.req.raw.headers for Better Auth integration",
      correct: "c.req.raw.headers",
    },
    {
      pattern: "app.use('*',",
      warning: "Global middleware should be registered before routes",
      correct: "Register before app.get/post/etc calls",
    },
  ],
};

export const DRIZZLE_TEMPLATE: FrameworkTemplate = {
  name: "drizzle",
  displayName: "Drizzle ORM",
  version: "0.44",
  source: "context7",
  libraryId: "/drizzle-team/drizzle-orm",
  category: "database",
  priority: "P0",
  description:
    "TypeScript ORM with type-safe SQL queries. Supports PostgreSQL, MySQL, SQLite.",
  structure: {
    schema: {
      "tables.mdx": {
        query:
          "Drizzle ORM table definition pgTable mysqlTable sqliteTable columns types serial varchar text integer boolean timestamp",
        topics: ["tables", "columns", "types"],
      },
      "relations.mdx": {
        query:
          "Drizzle ORM relations one many references foreign key relationships",
        topics: ["relations", "foreign keys"],
      },
      "types.mdx": {
        query:
          "Drizzle ORM TypeScript types inference InferSelectModel InferInsertModel",
        topics: ["types", "inference"],
      },
    },
    queries: {
      "select.mdx": {
        query:
          "Drizzle ORM select query db.select from where orderBy limit offset joins",
        topics: ["select", "where", "joins"],
      },
      "insert.mdx": {
        query:
          "Drizzle ORM insert update delete db.insert db.update db.delete returning onConflict",
        topics: ["insert", "update", "delete"],
      },
      "transactions.mdx": {
        query:
          "Drizzle ORM transactions db.transaction rollback savepoint batch",
        topics: ["transactions", "batch"],
      },
    },
    migrations: {
      "generate.mdx": {
        query:
          "Drizzle Kit generate migrations drizzle-kit generate:pg config schema",
        topics: ["migrations", "generate"],
      },
      "push.mdx": {
        query: "Drizzle Kit push migrate db:push db:migrate apply migrations",
        topics: ["push", "migrate"],
      },
    },
  },
};

export const BETTER_AUTH_TEMPLATE: FrameworkTemplate = {
  name: "better-auth",
  displayName: "Better Auth",
  version: "1.x",
  source: "context7",
  libraryId: "/better-auth/better-auth",
  category: "auth",
  priority: "P0",
  description:
    "Comprehensive TypeScript authentication framework with multiple providers.",
  structure: {
    config: {
      "setup.mdx": {
        query:
          "Better Auth setup configuration betterAuth() database secret baseURL trustedOrigins",
        topics: ["setup", "configuration"],
      },
      "providers.mdx": {
        query:
          "Better Auth social providers OAuth Google GitHub Discord email password magic link",
        topics: ["providers", "OAuth", "social"],
      },
    },
    sessions: {
      "jwt.mdx": {
        query:
          "Better Auth JWT tokens session management jwt plugin configuration",
        topics: ["jwt", "tokens"],
      },
      "cookies.mdx": {
        query:
          "Better Auth session cookies httpOnly secure sameSite cookie configuration",
        topics: ["cookies", "session"],
      },
    },
    integration: {
      "hono.mdx": {
        query:
          "Better Auth Hono integration toHonoHandler middleware c.req.raw.headers",
        topics: ["hono", "integration"],
      },
      "drizzle.mdx": {
        query: "Better Auth Drizzle adapter drizzleAdapter schema generation",
        topics: ["drizzle", "database"],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: "c.req.headers",
      warning: "Must use c.req.raw for Hono integration",
      correct: "auth.api.getSession({ headers: c.req.raw.headers })",
    },
  ],
};

export const ZOD_TEMPLATE: FrameworkTemplate = {
  name: "zod",
  displayName: "Zod",
  version: "4.x",
  source: "context7",
  libraryId: "/colinhacks/zod",
  category: "validation",
  priority: "P0",
  description: "TypeScript-first schema validation with static type inference.",
  structure: {
    basics: {
      "schemas.mdx": {
        query:
          "Zod schema definition z.object z.string z.number z.boolean z.array z.enum z.literal z.union",
        topics: ["schemas", "primitives", "objects"],
      },
      "validation.mdx": {
        query:
          "Zod parse safeParse validation errors ZodError formatting error messages",
        topics: ["validation", "parsing", "errors"],
      },
    },
    advanced: {
      "transforms.mdx": {
        query: "Zod transform preprocess default optional nullable coerce pipe",
        topics: ["transforms", "coercion"],
      },
      "refinements.mdx": {
        query:
          "Zod refine superRefine custom validation async validation discriminatedUnion",
        topics: ["refinements", "custom validation"],
      },
    },
  },
};

export const TANSTACK_QUERY_TEMPLATE: FrameworkTemplate = {
  name: "tanstack-query",
  displayName: "TanStack Query",
  version: "5.x",
  source: "context7",
  libraryId: "/tanstack/query",
  category: "frontend",
  priority: "P1",
  description:
    "Powerful asynchronous state management for TS/JS, React, Solid, Vue, Svelte, and Angular.",
  structure: {
    basics: {
      "queries.mdx": {
        query:
          "TanStack Query useQuery queryKey queryFn staleTime cacheTime enabled select",
        topics: ["useQuery", "configuration"],
      },
      "mutations.mdx": {
        query:
          "TanStack Query useMutation mutate mutateAsync onSuccess onError onSettled",
        topics: ["useMutation", "side effects"],
      },
    },
    advanced: {
      "invalidation.mdx": {
        query:
          "TanStack Query cache invalidation queryClient.invalidateQueries refetch",
        topics: ["invalidation", "cache"],
      },
      "optimistic.mdx": {
        query:
          "TanStack Query optimistic updates setQueryData onMutate context rollback",
        topics: ["optimistic updates"],
      },
    },
  },
};

export const TANSTACK_ROUTER_TEMPLATE: FrameworkTemplate = {
  name: "tanstack-router",
  displayName: "TanStack Router",
  version: "1.x",
  source: "context7",
  libraryId: "/tanstack/router",
  category: "frontend",
  priority: "P1",
  description: "Type-safe router with built-in caching for React applications.",
  structure: {
    basics: {
      "routes.mdx": {
        query:
          "TanStack Router createRoute createRootRoute path component loader",
        topics: ["routes", "configuration"],
      },
      "navigation.mdx": {
        query:
          "TanStack Router Link useNavigate useRouter navigation search params",
        topics: ["navigation", "links"],
      },
    },
    advanced: {
      "loaders.mdx": {
        query: "TanStack Router loader beforeLoad data fetching route context",
        topics: ["loaders", "data fetching"],
      },
      "search.mdx": {
        query: "TanStack Router search params validation zod searchSchema",
        topics: ["search params", "validation"],
      },
    },
  },
};

export const REACT_TEMPLATE: FrameworkTemplate = {
  name: "react",
  displayName: "React",
  version: "19.x",
  source: "context7",
  libraryId: "/facebook/react",
  category: "frontend",
  priority: "P1",
  description: "A JavaScript library for building user interfaces.",
  structure: {
    hooks: {
      "state.mdx": {
        query:
          "React hooks useState useReducer state management functional components",
        topics: ["useState", "useReducer"],
      },
      "effects.mdx": {
        query:
          "React useEffect useLayoutEffect cleanup dependencies side effects",
        topics: ["useEffect", "side effects"],
      },
      "refs.mdx": {
        query: "React useRef forwardRef useImperativeHandle DOM references",
        topics: ["refs", "DOM"],
      },
    },
    patterns: {
      "server-components.mdx": {
        query:
          "React Server Components RSC use client use server async components",
        topics: ["RSC", "server components"],
      },
      "suspense.mdx": {
        query: "React Suspense lazy loading code splitting fallback streaming",
        topics: ["Suspense", "lazy"],
      },
    },
  },
};

export const VITE_TEMPLATE: FrameworkTemplate = {
  name: "vite",
  displayName: "Vite",
  version: "6.x",
  source: "context7",
  libraryId: "/vitejs/vite",
  category: "build",
  priority: "P1",
  description: "Next generation frontend tooling. Fast HMR, optimized builds.",
  structure: {
    config: {
      "basic.mdx": {
        query: "Vite configuration vite.config.ts plugins resolve alias define",
        topics: ["configuration", "plugins"],
      },
      "env.mdx": {
        query:
          "Vite environment variables import.meta.env VITE_ prefix .env files",
        topics: ["env", "variables"],
      },
    },
    features: {
      "hmr.mdx": {
        query: "Vite HMR hot module replacement import.meta.hot accept",
        topics: ["HMR", "hot reload"],
      },
      "build.mdx": {
        query: "Vite build optimization rollup chunks splitting output",
        topics: ["build", "optimization"],
      },
    },
  },
};

export const VITEST_TEMPLATE: FrameworkTemplate = {
  name: "vitest",
  displayName: "Vitest",
  version: "3.x",
  source: "context7",
  libraryId: "/vitest-dev/vitest",
  category: "testing",
  priority: "P1",
  description: "Blazing fast unit test framework powered by Vite.",
  structure: {
    basics: {
      "tests.mdx": {
        query:
          "Vitest test describe it expect assertions toBe toEqual toMatchSnapshot",
        topics: ["tests", "assertions"],
      },
      "mocking.mdx": {
        query: "Vitest mock vi.mock vi.fn vi.spyOn mock modules functions",
        topics: ["mocking", "spies"],
      },
    },
    config: {
      "setup.mdx": {
        query:
          "Vitest configuration vitest.config.ts globals environment coverage",
        topics: ["configuration", "setup"],
      },
    },
  },
};

export const TAILWIND_TEMPLATE: FrameworkTemplate = {
  name: "tailwind",
  displayName: "Tailwind CSS",
  version: "4.x",
  source: "context7",
  libraryId: "/tailwindlabs/tailwindcss.com",
  category: "styling",
  priority: "P1",
  description: "A utility-first CSS framework for rapid UI development.",
  structure: {
    config: {
      "setup.mdx": {
        query:
          "Tailwind CSS v4 configuration CSS-first @theme @import PostCSS Vite",
        topics: ["configuration", "setup"],
      },
      "theme.mdx": {
        query:
          "Tailwind CSS v4 theme customization @theme colors spacing fonts",
        topics: ["theme", "customization"],
      },
    },
    utilities: {
      "layout.mdx": {
        query: "Tailwind CSS layout flex grid container responsive breakpoints",
        topics: ["layout", "responsive"],
      },
      "components.mdx": {
        query: "Tailwind CSS components buttons cards forms inputs modals",
        topics: ["components", "UI"],
      },
    },
  },
};

export const ELYSIA_TEMPLATE: FrameworkTemplate = {
  name: "elysia",
  displayName: "Elysia",
  version: "1.x",
  source: "context7",
  libraryId: "/elysiajs/elysia",
  category: "backend",
  priority: "P0",
  description:
    "Ergonomic and type-safe web framework for Bun with end-to-end type safety.",
  structure: {
    api: {
      "app.mdx": {
        query: "Elysia app creation new Elysia() configuration listen port",
        topics: ["app creation", "configuration", "listen"],
      },
      "routing.mdx": {
        query:
          "Elysia routing get post put patch delete route parameters wildcard group prefix",
        topics: ["routing", "methods", "params", "groups"],
      },
      "context.mdx": {
        query:
          "Elysia context handler request body query params headers set status cookie",
        topics: ["context", "request", "response", "cookies"],
      },
    },
    patterns: {
      "lifecycle.mdx": {
        query:
          "Elysia lifecycle hooks onRequest onParse onTransform onBeforeHandle onAfterHandle onError onResponse",
        topics: ["lifecycle", "hooks", "events"],
      },
      "validation.mdx": {
        query:
          "Elysia validation t.Object t.String t.Number body query params headers type-safe schema",
        topics: ["validation", "typebox", "schema"],
      },
      "plugins.mdx": {
        query:
          "Elysia plugin system .use() plugin creation scoped plugin derive decorate state",
        topics: ["plugins", "derive", "decorate", "state"],
      },
    },
    advanced: {
      "websocket.mdx": {
        query: "Elysia WebSocket ws subscribe publish message handler upgrade",
        topics: ["websocket", "realtime"],
      },
      "eden.mdx": {
        query: "Elysia Eden treaty end-to-end type safety client RPC-like API",
        topics: ["eden", "treaty", "type-safety", "client"],
      },
      "error-handling.mdx": {
        query:
          "Elysia error handling onError mapResponse custom error responses status codes",
        topics: ["errors", "error handling", "status codes"],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: "app.listen(3000)",
      warning: "Use app.listen with object config for better control",
      correct: "app.listen({ port: 3000, hostname: '0.0.0.0' })",
    },
    {
      pattern: ".use(cors())",
      warning: "CORS plugin must be installed: bun add @elysiajs/cors",
      correct: "import { cors } from '@elysiajs/cors'; app.use(cors())",
    },
  ],
};

export const DRIZZLE_V1_TEMPLATE: FrameworkTemplate = {
  name: "drizzle-v1",
  displayName: "Drizzle ORM v1",
  version: "1.0.0-beta",
  source: "context7",
  libraryId: "/drizzle-team/drizzle-orm",
  category: "database",
  priority: "P0",
  description:
    "Drizzle ORM v1.0 beta — new relational queries API, improved type inference, and migration system.",
  structure: {
    schema: {
      "tables.mdx": {
        query:
          "Drizzle ORM v1 table definition pgTable mysqlTable sqliteTable column types integer text varchar boolean timestamp serial",
        topics: ["tables", "columns", "types"],
      },
      "relations.mdx": {
        query:
          "Drizzle ORM v1 relations defineRelations one many relational queries",
        topics: ["relations", "defineRelations"],
      },
      "types.mdx": {
        query:
          "Drizzle ORM v1 TypeScript types inference $inferSelect $inferInsert table type helpers",
        topics: ["types", "inference", "$inferSelect"],
      },
    },
    queries: {
      "select.mdx": {
        query:
          "Drizzle ORM v1 select query db.select from where eq and or orderBy limit offset joins",
        topics: ["select", "where", "joins", "operators"],
      },
      "mutations.mdx": {
        query:
          "Drizzle ORM v1 insert update delete db.insert db.update db.delete values set returning onConflictDoUpdate",
        topics: ["insert", "update", "delete", "upsert"],
      },
      "relational.mdx": {
        query:
          "Drizzle ORM v1 relational queries db.query findMany findFirst with columns where",
        topics: ["relational queries", "findMany", "with"],
      },
    },
    migrations: {
      "kit.mdx": {
        query:
          "Drizzle Kit v1 drizzle-kit generate migrate push pull config drizzle.config.ts",
        topics: ["drizzle-kit", "generate", "migrate", "push"],
      },
      "config.mdx": {
        query:
          "Drizzle ORM v1 drizzle.config.ts configuration schema out driver dialect dbCredentials",
        topics: ["config", "drizzle.config.ts"],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: "InferSelectModel",
      warning: "Drizzle v1 uses $inferSelect instead of InferSelectModel",
      correct: "type User = typeof users.$inferSelect",
    },
    {
      pattern: "InferInsertModel",
      warning: "Drizzle v1 uses $inferInsert instead of InferInsertModel",
      correct: "type NewUser = typeof users.$inferInsert",
    },
  ],
};

export const SHADCN_TEMPLATE: FrameworkTemplate = {
  name: "shadcn",
  displayName: "shadcn/ui",
  version: "latest",
  source: "context7",
  libraryId: "/shadcn-ui/ui",
  category: "ui",
  priority: "P0",
  description:
    "Beautifully designed, accessible UI components using Radix UI and Tailwind CSS. Copy-paste, not npm install.",
  structure: {
    setup: {
      "installation.mdx": {
        query:
          "shadcn/ui installation setup init CLI npx shadcn@latest init components.json configuration",
        topics: ["installation", "init", "CLI", "components.json"],
      },
      "theming.mdx": {
        query:
          "shadcn/ui theming CSS variables dark mode themes colors customization globals.css",
        topics: ["theming", "dark mode", "CSS variables"],
      },
    },
    components: {
      "forms.mdx": {
        query:
          "shadcn/ui form components Input Button Select Textarea Checkbox RadioGroup Switch react-hook-form zod",
        topics: ["forms", "input", "validation"],
      },
      "layout.mdx": {
        query:
          "shadcn/ui layout components Card Dialog Sheet Drawer Tabs Accordion Collapsible Separator",
        topics: ["layout", "card", "dialog", "tabs"],
      },
      "feedback.mdx": {
        query:
          "shadcn/ui feedback components Alert AlertDialog Toast Sonner Tooltip Popover HoverCard",
        topics: ["feedback", "toast", "alert", "tooltip"],
      },
      "data-display.mdx": {
        query:
          "shadcn/ui data display Table DataTable Badge Avatar Calendar Command",
        topics: ["table", "data-table", "badge"],
      },
    },
    patterns: {
      "data-table.mdx": {
        query:
          "shadcn/ui DataTable pattern TanStack Table sorting filtering pagination column definitions",
        topics: ["data-table", "tanstack-table", "pagination"],
      },
      "composition.mdx": {
        query:
          "shadcn/ui component composition patterns extending components cn() utility class merging cva variants",
        topics: ["composition", "cn()", "variants", "cva"],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: "npm install shadcn",
      warning:
        "shadcn/ui is NOT installed via npm. Use the CLI to add components",
      correct: "npx shadcn@latest add button",
    },
    {
      pattern: 'import { Button } from "shadcn',
      warning: "Import from your local components directory, not from shadcn",
      correct: 'import { Button } from "@/components/ui/button"',
    },
  ],
};

export const NEXTJS_TEMPLATE: FrameworkTemplate = {
  name: "nextjs",
  displayName: "Next.js",
  version: "16.x",
  source: "context7",
  libraryId: "/vercel/next.js",
  category: "frontend",
  priority: "P0",
  description:
    "React framework for full-stack web applications with App Router, Server Components, and Server Actions.",
  structure: {
    routing: {
      "app-router.mdx": {
        query:
          "Next.js App Router file-based routing layout page loading error not-found route groups parallel routes intercepting",
        topics: ["app router", "layouts", "pages", "route groups"],
      },
      "navigation.mdx": {
        query:
          "Next.js navigation Link useRouter usePathname useSearchParams redirect permanentRedirect",
        topics: ["navigation", "Link", "useRouter"],
      },
      "middleware.mdx": {
        query:
          "Next.js middleware.ts request matching conditional routing headers cookies rewriting redirecting",
        topics: ["middleware", "matching", "headers"],
      },
    },
    rendering: {
      "server-components.mdx": {
        query:
          "Next.js React Server Components async components data fetching use client use server streaming",
        topics: ["RSC", "server components", "streaming"],
      },
      "server-actions.mdx": {
        query:
          "Next.js Server Actions use server form actions revalidatePath revalidateTag mutations",
        topics: ["server actions", "forms", "revalidation"],
      },
      "caching.mdx": {
        query:
          "Next.js caching fetch cache revalidate unstable_cache generateStaticParams ISR on-demand revalidation",
        topics: ["caching", "revalidation", "ISR"],
      },
    },
    api: {
      "route-handlers.mdx": {
        query:
          "Next.js Route Handlers GET POST PUT DELETE request response NextRequest NextResponse cookies headers",
        topics: ["route handlers", "API routes", "NextRequest"],
      },
    },
    optimization: {
      "images.mdx": {
        query:
          "Next.js Image component next/image optimization sizes fill priority placeholder blur responsive",
        topics: ["images", "optimization", "next/image"],
      },
      "fonts.mdx": {
        query:
          "Next.js Font optimization next/font/google next/font/local variable fonts subsets display",
        topics: ["fonts", "next/font"],
      },
      "metadata.mdx": {
        query:
          "Next.js Metadata API generateMetadata title description openGraph twitter icons manifest",
        topics: ["metadata", "SEO", "generateMetadata"],
      },
    },
  },
  criticalPatterns: [
    {
      pattern: "getServerSideProps",
      warning:
        "getServerSideProps is Pages Router. App Router uses async Server Components",
      correct:
        "export default async function Page() { const data = await fetch(...) }",
    },
    {
      pattern: "getStaticProps",
      warning:
        "getStaticProps is Pages Router. App Router uses fetch with cache options",
      correct: "const data = await fetch(url, { next: { revalidate: 3600 } })",
    },
    {
      pattern: "useRouter from 'next/router'",
      warning: "App Router uses next/navigation, not next/router",
      correct: "import { useRouter } from 'next/navigation'",
    },
  ],
};

// ============================================================================
// Template Registry
// ============================================================================

export const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  hono: HONO_TEMPLATE,
  drizzle: DRIZZLE_TEMPLATE,
  "better-auth": BETTER_AUTH_TEMPLATE,
  zod: ZOD_TEMPLATE,
  "tanstack-query": TANSTACK_QUERY_TEMPLATE,
  "tanstack-router": TANSTACK_ROUTER_TEMPLATE,
  react: REACT_TEMPLATE,
  vite: VITE_TEMPLATE,
  vitest: VITEST_TEMPLATE,
  tailwind: TAILWIND_TEMPLATE,
  elysia: ELYSIA_TEMPLATE,
  "drizzle-v1": DRIZZLE_V1_TEMPLATE,
  shadcn: SHADCN_TEMPLATE,
  nextjs: NEXTJS_TEMPLATE,
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

export function getTemplatesByCategory(
  category: FrameworkTemplate["category"]
): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES).filter(
    (t) => t.category === category
  );
}

export function getTemplatesByPriority(
  priority: FrameworkTemplate["priority"]
): FrameworkTemplate[] {
  return Object.values(FRAMEWORK_TEMPLATES).filter(
    (t) => t.priority === priority
  );
}
