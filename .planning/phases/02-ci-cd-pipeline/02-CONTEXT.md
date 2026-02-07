# Phase 2: CI/CD Pipeline - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

GitHub Actions workflow that automatically validates every push and PR with lint, typecheck, and tests. Includes branch protection rules and CI feedback (badges, annotations, coverage reports). Publishing and release automation are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Estratégia de triggers
- Roda em push para `main` e em PRs que apontam para `main`
- Draft PRs NÃO disparam CI — só ready-for-review
- Path filtering ativo: ignorar `*.md`, `.planning/`, e paths que não afetam código
- Branch principal: `main`

### Caching e performance
- Cache básico de dependências Bun (sem otimizações extras)
- Versão do Bun: `latest` (sempre mais recente, sem fixar)
- Sem matrix de versões — uma versão única
- Job único sequencial: Lint → Typecheck → Test (fail-fast)

### Proteção de branches
- CI obrigatório para merge (sem exigir review approval — projeto solo)
- Push direto para `main` bloqueado — tudo via PR
- Force push para `main` bloqueado — histórico preservado
- Branch protection configurado automaticamente via `gh` CLI (script)

### Feedback e reporting
- Status badge: Shields.io customizado (não o nativo do GitHub)
- Coverage badge: Shields.io no README (além do badge de CI)
- Relatório de coverage como comentário automático no PR com threshold (80%)
- Lint/typecheck errors como inline annotations nos arquivos do PR

### Claude's Discretion
- Escolha de action para coverage report (ex: codecov, custom script)
- Formato exato dos badges Shields.io
- Detalhes de path filtering (quais paths ignorar além de *.md e .planning/)
- Configuração exata do cache Bun

</decisions>

<specifics>
## Specific Ideas

- Coverage threshold é 80% (consistente com check-coverage.ts existente)
- Já existe `scripts/check-coverage.ts` que parseia lcov.info — pode ser reaproveitado no CI
- Biome é o linter do projeto (não ESLint)
- `bun test` é o runner de testes (não Vitest/Jest)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-ci-cd-pipeline*
*Context gathered: 2026-02-05*
