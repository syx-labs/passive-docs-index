# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Planned
- Comando `pdi generate internal` completo
- Hook para `npm install` / `bun install`
- Skills Claude (`/pdi-analyze`, `/pdi-generate`)
- Plugin para VS Code

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
