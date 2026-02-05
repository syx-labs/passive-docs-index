# Requirements: Passive Docs Index (PDI) v1.0

**Defined:** 2026-02-05
**Core Value:** Documentação de frameworks sempre disponível no contexto do assistente de IA, sem decisão de busca necessária

## v1 Requirements

### Testing & Quality

- [ ] **TEST-01**: Test suite com Bun Test cobrindo core logic (config, templates, index-parser, fs-utils)
- [ ] **TEST-02**: Integration tests para comandos (init, add, sync, status, clean, update)
- [ ] **TEST-03**: Coverage mínimo de 80% no core (`src/lib/`)
- [ ] **TEST-04**: Mocking de I/O externo (file system, Context7 HTTP, MCP CLI) isolado por teste

### CI/CD Pipeline

- [ ] **CICD-01**: GitHub Actions workflow para PR: lint (Biome) + typecheck (tsc) + test + build
- [ ] **CICD-02**: GitHub Actions workflow para publish: npm publish com provenance via OIDC
- [ ] **CICD-03**: npm provenance badges visíveis no npmjs.com
- [ ] **CICD-04**: Package config correto — `engines`, `bin`, `files`, `exports`, `types` validados

### Publishing & Distribution

- [ ] **DIST-01**: Publicação no npm com `passive-docs-index` como package name
- [ ] **DIST-02**: `npx pdi` funciona out of the box (shebang, bin entry, dist/ incluído)
- [ ] **DIST-03**: CHANGELOG gerado com release notes por versão
- [ ] **DIST-04**: Type declarations (.d.ts) incluídas para API programática

### Error Handling

- [ ] **ERR-01**: Todos os comandos CLI envoltos em try/catch com mensagens user-friendly
- [ ] **ERR-02**: Erros de Context7 (network, auth, rate limit) tratados com fallback e mensagem clara
- [ ] **ERR-03**: Erros de config (parse failure, schema inválido) com instruções de correção
- [ ] **ERR-04**: Validação de config em runtime com Zod schema

### Automation

- [ ] **AUTO-01**: Postinstall hook sugerindo `pdi sync` após npm/bun install
- [ ] **AUTO-02**: Freshness checking — detectar quando docs instalados estão desatualizados vs package.json
- [ ] **AUTO-03**: Flag `--check` em comandos relevantes para CI integration (exit code não-zero se problemas)

### Claude Code Integration

- [ ] **CLAUDE-01**: Skill `/pdi-analyze` — análise de status de docs, padrões não documentados, sugestões
- [ ] **CLAUDE-02**: Skill `/pdi-generate` — geração assistida de docs via Claude
- [ ] **CLAUDE-03**: Skill `/pdi-sync` — sincronização interativa via Claude
- [ ] **CLAUDE-04**: Hook `PostToolUse` — sugerir `pdi sync` após comandos de install
- [ ] **CLAUDE-05**: Hook `SessionStart` — injetar contexto PDI no início de sessão
- [ ] **CLAUDE-06**: Plugin packaging — bundle skills + hooks + .mcp.json num plugin instalável

### Custom Templates

- [ ] **TMPL-01**: Template registry com resolução: user-local > project > npm > built-in
- [ ] **TMPL-02**: Formato YAML para templates customizados com schema validável
- [ ] **TMPL-03**: Comando `pdi template create` para scaffolding de template customizado
- [ ] **TMPL-04**: Documentação de como criar e contribuir templates

### Monorepo Support

- [ ] **MONO-01**: Detectar workspaces (npm, pnpm, bun) automaticamente
- [ ] **MONO-02**: Scope de config e docs por package em monorepo
- [ ] **MONO-03**: Comando `pdi sync` rodando cross-package em monorepo

### VS Code Extension

- [ ] **VSCE-01**: TreeView mostrando frameworks indexados com status
- [ ] **VSCE-02**: Command palette integration (add, sync, status)
- [ ] **VSCE-03**: Status bar com indicador de saúde dos docs
- [ ] **VSCE-04**: Consume API programática via @pdi/core (sem subprocess)

### Documentation

- [ ] **DOCS-01**: README traduzido para inglês (README.md em EN, README.pt-BR.md mantido)
- [ ] **DOCS-02**: CONTRIBUTING.md com guia de contribuição
- [ ] **DOCS-03**: Documentação de API programática

## v2 Requirements

### Ecosystem Expansion

- **ECO-01**: Integração llms.txt para compatibilidade cross-AI-tool
- **ECO-02**: Plugin JetBrains IDEs
- **ECO-03**: Publicação no JSR (Deno)
- **ECO-04**: Global template registry / marketplace hospedado

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full documentation hosting/rendering | PDI é indexer, não plataforma de docs (Mintlify, Docusaurus existem) |
| Real-time MCP server próprio | Context7 já serve esse propósito, integrado como fallback |
| Web dashboard | Usuários de Claude Code trabalham no terminal, VS Code extension cobre necessidades visuais |
| Auto-generating code from docs | PDI fornece contexto; o AI gera código — cruzar essa fronteira muda o produto |
| Multi-AI-assistant support (Copilot, Cursor) | Claude Code-first; llms.txt pode prover compat leve no v2 |
| Per-file watch mode | Docs mudam raramente; event-driven sync (postinstall, hooks) é suficiente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| CICD-01 | — | Pending |
| CICD-02 | — | Pending |
| CICD-03 | — | Pending |
| CICD-04 | — | Pending |
| DIST-01 | — | Pending |
| DIST-02 | — | Pending |
| DIST-03 | — | Pending |
| DIST-04 | — | Pending |
| ERR-01 | — | Pending |
| ERR-02 | — | Pending |
| ERR-03 | — | Pending |
| ERR-04 | — | Pending |
| AUTO-01 | — | Pending |
| AUTO-02 | — | Pending |
| AUTO-03 | — | Pending |
| CLAUDE-01 | — | Pending |
| CLAUDE-02 | — | Pending |
| CLAUDE-03 | — | Pending |
| CLAUDE-04 | — | Pending |
| CLAUDE-05 | — | Pending |
| CLAUDE-06 | — | Pending |
| TMPL-01 | — | Pending |
| TMPL-02 | — | Pending |
| TMPL-03 | — | Pending |
| TMPL-04 | — | Pending |
| MONO-01 | — | Pending |
| MONO-02 | — | Pending |
| MONO-03 | — | Pending |
| VSCE-01 | — | Pending |
| VSCE-02 | — | Pending |
| VSCE-03 | — | Pending |
| VSCE-04 | — | Pending |
| DOCS-01 | — | Pending |
| DOCS-02 | — | Pending |
| DOCS-03 | — | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 0
- Unmapped: 39 ⚠️

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after research synthesis*
