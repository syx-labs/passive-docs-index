# Requirements: Passive Docs Index (PDI) v1.0

**Defined:** 2026-02-05
**Core Value:** Documentacao de frameworks sempre disponivel no contexto do assistente de IA, sem decisao de busca necessaria

## v1 Requirements

### Testing & Quality

- [x] **TEST-01**: Test suite com Bun Test cobrindo core logic (config, templates, index-parser, fs-utils)
- [x] **TEST-02**: Integration tests para comandos (init, add, sync, status, clean, update)
- [x] **TEST-03**: Coverage minimo de 80% no core (`src/lib/`)
- [x] **TEST-04**: Mocking de I/O externo (file system, Context7 HTTP, MCP CLI) isolado por teste

### CI/CD Pipeline

- [ ] **CICD-01**: GitHub Actions workflow para PR: lint (Biome) + typecheck (tsc) + test + build
- [ ] **CICD-02**: GitHub Actions workflow para publish: npm publish com provenance via OIDC
- [ ] **CICD-03**: npm provenance badges visiveis no npmjs.com
- [ ] **CICD-04**: Package config correto -- `engines`, `bin`, `files`, `exports`, `types` validados

### Publishing & Distribution

- [ ] **DIST-01**: Publicacao no npm com `passive-docs-index` como package name
- [ ] **DIST-02**: `npx pdi` funciona out of the box (shebang, bin entry, dist/ incluido)
- [ ] **DIST-03**: CHANGELOG gerado com release notes por versao
- [ ] **DIST-04**: Type declarations (.d.ts) incluidas para API programatica

### Error Handling

- [ ] **ERR-01**: Todos os comandos CLI envoltos em try/catch com mensagens user-friendly
- [ ] **ERR-02**: Erros de Context7 (network, auth, rate limit) tratados com fallback e mensagem clara
- [ ] **ERR-03**: Erros de config (parse failure, schema invalido) com instrucoes de correcao
- [ ] **ERR-04**: Validacao de config em runtime com Zod schema

### Automation

- [ ] **AUTO-01**: Postinstall hook sugerindo `pdi sync` apos npm/bun install
- [ ] **AUTO-02**: Freshness checking -- detectar quando docs instalados estao desatualizados vs package.json
- [ ] **AUTO-03**: Flag `--check` em comandos relevantes para CI integration (exit code nao-zero se problemas)

### Claude Code Integration

- [ ] **CLAUDE-01**: Skill `/pdi-analyze` -- analise de status de docs, padroes nao documentados, sugestoes
- [ ] **CLAUDE-02**: Skill `/pdi-generate` -- geracao assistida de docs via Claude
- [ ] **CLAUDE-03**: Skill `/pdi-sync` -- sincronizacao interativa via Claude
- [ ] **CLAUDE-04**: Hook `PostToolUse` -- sugerir `pdi sync` apos comandos de install
- [ ] **CLAUDE-05**: Hook `SessionStart` -- injetar contexto PDI no inicio de sessao
- [ ] **CLAUDE-06**: Plugin packaging -- bundle skills + hooks + .mcp.json num plugin instalavel

### Custom Templates

- [ ] **TMPL-01**: Template registry com resolucao: user-local > project > npm > built-in
- [ ] **TMPL-02**: Formato YAML para templates customizados com schema validavel
- [ ] **TMPL-03**: Comando `pdi template create` para scaffolding de template customizado
- [ ] **TMPL-04**: Documentacao de como criar e contribuir templates

### Monorepo Support

- [ ] **MONO-01**: Detectar workspaces (npm, pnpm, bun) automaticamente
- [ ] **MONO-02**: Scope de config e docs por package em monorepo
- [ ] **MONO-03**: Comando `pdi sync` rodando cross-package em monorepo

### VS Code Extension

- [ ] **VSCE-01**: TreeView mostrando frameworks indexados com status
- [ ] **VSCE-02**: Command palette integration (add, sync, status)
- [ ] **VSCE-03**: Status bar com indicador de saude dos docs
- [ ] **VSCE-04**: Consume API programatica via @pdi/core (sem subprocess)

### Documentation

- [ ] **DOCS-01**: README traduzido para ingles (README.md em EN, README.pt-BR.md mantido)
- [ ] **DOCS-02**: CONTRIBUTING.md com guia de contribuicao
- [ ] **DOCS-03**: Documentacao de API programatica

## v2 Requirements

### Ecosystem Expansion

- **ECO-01**: Integracao llms.txt para compatibilidade cross-AI-tool
- **ECO-02**: Plugin JetBrains IDEs
- **ECO-03**: Publicacao no JSR (Deno)
- **ECO-04**: Global template registry / marketplace hospedado

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full documentation hosting/rendering | PDI e indexer, nao plataforma de docs (Mintlify, Docusaurus existem) |
| Real-time MCP server proprio | Context7 ja serve esse proposito, integrado como fallback |
| Web dashboard | Usuarios de Claude Code trabalham no terminal, VS Code extension cobre necessidades visuais |
| Auto-generating code from docs | PDI fornece contexto; o AI gera codigo -- cruzar essa fronteira muda o produto |
| Multi-AI-assistant support (Copilot, Cursor) | Claude Code-first; llms.txt pode prover compat leve no v2 |
| Per-file watch mode | Docs mudam raramente; event-driven sync (postinstall, hooks) e suficiente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| TEST-04 | Phase 1 | Complete |
| CICD-01 | Phase 2 | Pending |
| CICD-02 | Phase 3 | Pending |
| CICD-03 | Phase 3 | Pending |
| CICD-04 | Phase 3 | Pending |
| DIST-01 | Phase 3 | Pending |
| DIST-02 | Phase 3 | Pending |
| DIST-03 | Phase 3 | Pending |
| DIST-04 | Phase 3 | Pending |
| ERR-01 | Phase 4 | Pending |
| ERR-02 | Phase 4 | Pending |
| ERR-03 | Phase 4 | Pending |
| ERR-04 | Phase 4 | Pending |
| AUTO-01 | Phase 5 | Pending |
| AUTO-02 | Phase 5 | Pending |
| AUTO-03 | Phase 5 | Pending |
| CLAUDE-01 | Phase 6 | Pending |
| CLAUDE-02 | Phase 6 | Pending |
| CLAUDE-03 | Phase 6 | Pending |
| CLAUDE-04 | Phase 6 | Pending |
| CLAUDE-05 | Phase 6 | Pending |
| CLAUDE-06 | Phase 7 | Pending |
| TMPL-01 | Phase 8 | Pending |
| TMPL-02 | Phase 8 | Pending |
| TMPL-03 | Phase 8 | Pending |
| TMPL-04 | Phase 8 | Pending |
| MONO-01 | Phase 9 | Pending |
| MONO-02 | Phase 9 | Pending |
| MONO-03 | Phase 9 | Pending |
| VSCE-01 | Phase 9 | Pending |
| VSCE-02 | Phase 9 | Pending |
| VSCE-03 | Phase 9 | Pending |
| VSCE-04 | Phase 9 | Pending |
| DOCS-01 | Phase 10 | Pending |
| DOCS-02 | Phase 10 | Pending |
| DOCS-03 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after Phase 1 completion*
