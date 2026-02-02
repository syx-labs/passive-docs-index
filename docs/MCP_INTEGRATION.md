# Integração com MCP (Model Context Protocol)

PDI integra com servidores MCP para buscar documentação quando os docs locais são insuficientes.

## Visão Geral

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Docs Locais    │────▶│    AI Agent      │────▶│   MCP Server     │
│ (.claude-docs/)  │     │ (Claude, etc.)   │     │   (Context7)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        ▲                        │                        │
        │                        ▼                        │
        │                 ┌──────────────┐                │
        │                 │  CLAUDE.md   │                │
        │                 │   (índice)   │                │
        │                 └──────────────┘                │
        │                                                 │
        └─────────────────────────────────────────────────┘
                     Fallback: populate docs
```

## Fluxo de Decisão

1. AI lê o índice no `CLAUDE.md`
2. Se o tópico está nos docs locais → lê o arquivo `.mdx`
3. Se não está ou precisa de mais detalhes → usa MCP (Context7)
4. Opcionalmente, sugere `pdi sync` para atualizar docs locais

## Context7

### Sobre

Context7 é um servidor MCP que fornece documentação de bibliotecas populares.

### Tools Disponíveis

#### `resolve-library-id`

Resolve o nome de uma biblioteca para seu ID no Context7.

```json
{
  "tool": "mcp__plugin_context7_context7__resolve-library-id",
  "params": {
    "libraryName": "hono"
  }
}
```

Resposta:
```json
{
  "libraryId": "/honojs/hono"
}
```

#### `query-docs`

Busca documentação sobre um tópico específico.

```json
{
  "tool": "mcp__plugin_context7_context7__query-docs",
  "params": {
    "context7CompatibleLibraryID": "/honojs/hono",
    "topic": "middleware pattern and built-in middlewares",
    "tokens": 10000
  }
}
```

### IDs de Bibliotecas Conhecidas

| Framework | Library ID |
|-----------|------------|
| Hono | `/honojs/hono` |
| Drizzle ORM | `/drizzle-team/drizzle-orm` |
| Better Auth | `/better-auth/better-auth` |
| Zod | `/colinhacks/zod` |
| React | `/facebook/react` |
| TanStack Query | `/tanstack/query` |
| TanStack Router | `/tanstack/router` |
| Vite | `/vitejs/vite` |
| Vitest | `/vitest-dev/vitest` |
| Tailwind CSS | `/tailwindlabs/tailwindcss` |

## Instruções para AI

O comentário de fallback no `CLAUDE.md` instrui a AI:

```markdown
<!-- MCP Fallback Protocol -->
<!--
When local docs in .claude-docs/ don't answer your question:
1. Query Context7: mcp__plugin_context7_context7__query-docs
2. Use the libraryId from the mappings below
3. If information is valuable, suggest: "Consider running `pdi sync` to update local docs"

Library IDs:
- hono: /honojs/hono
- drizzle: /drizzle-team/drizzle-orm
- better-auth: /better-auth/better-auth

Only use MCP for:
- Edge cases not covered in local docs
- Very recent API changes
- Integration patterns between libraries
- Bug workarounds
-->
```

## Configuração

No `config.json`:

```json
{
  "mcp": {
    "fallbackEnabled": true,
    "preferredProvider": "context7",
    "providers": {
      "context7": {
        "resolveLibraryId": "mcp__plugin_context7_context7__resolve-library-id",
        "queryDocs": "mcp__plugin_context7_context7__query-docs"
      }
    },
    "libraryMappings": {
      "hono": "/honojs/hono",
      "drizzle": "/drizzle-team/drizzle-orm"
    },
    "cacheHours": 168
  }
}
```

### Opções

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| `fallbackEnabled` | Habilitar fallback MCP | `true` |
| `preferredProvider` | Provedor MCP preferido | `"context7"` |
| `libraryMappings` | Mapeamento framework → libraryId | `{}` |
| `cacheHours` | Tempo de cache (em horas) | `168` (1 semana) |

## Uso Programático

```typescript
import {
  generateResolveLibraryCall,
  generateQueryDocsCall,
  processContext7Response,
} from 'passive-docs-index';

// Gerar chamada para resolver library ID
const resolveCall = generateResolveLibraryCall('hono');
// { tool: "mcp__...__resolve-library-id", params: { libraryName: "hono" } }

// Gerar chamada para buscar docs
const queryCall = generateQueryDocsCall('/honojs/hono', 'middleware patterns', {
  maxTokens: 5000,
});

// Processar resposta do Context7
const content = processContext7Response(rawContent, {
  framework: 'Hono',
  version: '4.x',
  category: 'patterns',
  file: 'middleware.mdx',
  libraryId: '/honojs/hono',
});
```

## Populando Docs via MCP

O PDI cria placeholders que podem ser populados via Context7:

```markdown
---
# Part of Passive Docs Index for hono@4.x
# Source: Context7 (/honojs/hono)
---

# Middleware

> This is a placeholder document. Ask Claude to populate it using Context7 MCP.

## Query for Context7

Library ID: /honojs/hono
Query: Hono middleware pattern app.use built-in middlewares cors logger
```

Para popular, peça ao Claude:

```
Please use Context7 to fetch documentation about Hono middleware patterns
and update the file at .claude-docs/frameworks/hono/patterns/middleware.mdx
```

## Fallback Hierarchy

1. **Docs locais** (`.claude-docs/`) - Primeira escolha
2. **Context7 MCP** - Quando docs locais insuficientes
3. **Web Search** (Firecrawl) - Último recurso
4. **Pre-training** - Evitar para APIs específicas

## Boas Práticas

1. **Mantenha docs locais atualizados**: Use `pdi sync` regularmente
2. **Use MCP para edge cases**: Docs locais cobrem 80% dos casos
3. **Sugira atualização**: Quando MCP fornece info útil, sugira `pdi sync`
4. **Cache**: Context7 tem cache interno, evite queries repetidas
