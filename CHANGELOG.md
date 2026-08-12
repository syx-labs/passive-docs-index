# Changelog

## 0.3.0

### Minor Changes

- [`72dbef3`](https://github.com/syx-labs/passive-docs-index/commit/72dbef3fd7fa32cb08e08ee513b827f42271ece6) Thanks [@syx-labs](https://github.com/syx-labs)! - Add structured error handling and automation capabilities

  **Error Handling (Phase 4):**

  - Structured error hierarchy with `PDIError`, `ConfigError`, `Context7Error`, and `NotInitializedError`
  - Configuration validation via Zod schemas with clear, actionable error messages
  - Centralized `handleCommandError` for consistent CLI error formatting
  - Context7 API error classification (rate limits, auth failures, network errors)

  **Automation (Phase 5):**

  - npm registry client for checking published package versions
  - Freshness checking via semver comparison (local vs. registry)
  - `pdi status --check` for CI exit codes and `pdi status --format json` for machine-readable output
  - Postinstall hook for automatic `pdi generate` on package install

## 0.2.1

### Patch Changes

- [`5f86286`](https://github.com/syx-labs/passive-docs-index/commit/5f86286fe0478ebc7ffdad035b2f46699e56a5bd) Thanks [@syx-labs](https://github.com/syx-labs)! - chore: verify automated release pipeline with OIDC provenance

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Planned

- Hook para `npm install` / `bun install`
- Skills Claude (`/pdi-analyze`, `/pdi-generate`)
- Plugin para VS Code
- Testes automatizados
- Publicação no npm

## [0.2.0] - 2026-02-02

### Added

- **Cliente Context7 Unificado** - Busca documentação real via HTTP ou MCP
  - Integração com `@upstash/context7-sdk` para uso standalone
  - Fallback para MCP quando dentro do Claude Code
  - Prioridade: HTTP API → MCP → Placeholders offline
- **Comando `pdi auth`** - Configuração interativa de API key
  - Salva em `~/.config/pdi/config.json`
  - Validação da API key em tempo real
  - Opções `--status` e `--logout`
- **Comando `pdi doctor`** - Diagnóstico completo do projeto
  - Verifica autenticação (HTTP vs MCP)
  - Verifica inicialização e docs instalados
  - Lista recomendações de ações
- **Comando `pdi update`** - Re-buscar docs para frameworks instalados
- **Comando `pdi generate internal`** - Gerar docs de padrões internos
  - Detecta: two-schema pattern, feature gating, ESM imports, path aliases
- **Modo interativo para `pdi add`** - Seleção visual de frameworks
  - Frameworks detectados no package.json aparecem pré-selecionados
  - Indica quais já estão instalados
- **Tratamento automático de redirects** - Resolve library IDs movidos
- **Carregamento automático de API key** - Lê de `~/.config/pdi/` no startup

### Changed

- `pdi add` agora busca documentação real do Context7 por padrão
- Mensagens de erro mais claras para MCP vs HTTP
- Default do `pdi auth` agora é "Both" (salva + mostra export)

### Fixed

- Library ID do Tailwind CSS corrigido (`/tailwindlabs/tailwindcss.com`)
- Extração de conteúdo do MCP para arrays de content blocks

### Technical

- Novo módulo `src/lib/context7-client.ts` (cliente unificado)
- Novo módulo `src/lib/mcp-client.ts` (cliente MCP low-level)
- Dependência `@upstash/context7-sdk` adicionada
- Dependência `prompts` para interatividade

## [0.1.0] - 2026-02-02

### Added

- CLI inicial com comandos: `init`, `add`, `sync`, `status`, `clean`, `list`
- Formato de índice comprimido para CLAUDE.md
- Parser e gerador do índice
- Detecção automática de dependências do package.json
- Templates para 10 frameworks:
  - Backend: Hono
  - Database: Drizzle ORM
  - Auth: Better Auth
  - Validation: Zod
  - Frontend: React, TanStack Query, TanStack Router
  - Build: Vite
  - Testing: Vitest
  - Styling: Tailwind CSS
- Integração com Context7 MCP para fallback
- Geração de arquivos placeholder .mdx
- Configuração via config.json
- Atualização automática do CLAUDE.md
- Documentação completa em português

### Technical

- TypeScript strict mode
- Bun como runtime e bundler
- ESM modules
- Commander.js para CLI
- Chalk para output colorido
- Ora para spinners

---

## Tipos de Mudanças

- **Added**: novas funcionalidades
- **Changed**: mudanças em funcionalidades existentes
- **Deprecated**: funcionalidades que serão removidas em breve
- **Removed**: funcionalidades removidas
- **Fixed**: correções de bugs
- **Security**: correções de vulnerabilidades
