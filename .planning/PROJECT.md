# Passive Docs Index (PDI)

## What This Is

PDI é uma CLI que cria índices de documentação comprimidos (~4KB) para assistentes de IA, eliminando o "ponto de decisão" onde o agente precisa decidir se deve buscar documentação. O índice fica sempre disponível no CLAUDE.md, garantindo 100% de taxa de trigger vs 44% com skills. Voltado para desenvolvedores que usam Claude Code e outros assistentes de IA.

## Core Value

Documentação de frameworks sempre disponível no contexto do assistente de IA, sem nenhuma decisão de busca necessária — o índice passivo elimina a taxa de falha de 56% no acionamento de documentação.

## Requirements

### Validated

- ✓ CLI com comandos init, add, sync, status, clean, list — existing
- ✓ Templates para 10 frameworks (Hono, Drizzle, Better Auth, Zod, React, TanStack Query/Router, Vite, Vitest, Tailwind) — existing
- ✓ Integração Context7 HTTP SDK com fallback MCP — existing
- ✓ Formato de índice comprimido com marcadores `<!-- pdi:begin/end -->` — existing
- ✓ Comando `pdi add` com busca real via Context7 e modo offline — existing
- ✓ Comando `pdi update` para re-buscar docs atualizados — existing
- ✓ Comando `pdi generate internal` para docs de padrões do projeto — existing
- ✓ Comando `pdi auth` com configuração de API key — existing
- ✓ Comando `pdi doctor` para diagnóstico completo — existing
- ✓ Cache de library IDs resolvidos e tratamento de redirects — existing

### Active

- [ ] Skill `/pdi-analyze` — Análise do projeto (status de docs, padrões não documentados, sugestões)
- [ ] Skill `/pdi-generate` — Geração assistida de docs via Claude
- [ ] Hook para `bun install`/`npm install` sugerindo `pdi sync` automaticamente
- [ ] Integração com Git hooks (pre-commit: verificar índice, post-merge: sugerir atualização)
- [ ] Testes automatizados (unit, integration, E2E)
- [ ] Publicação no npm
- [ ] Publicação no JSR (Deno)
- [ ] GitHub Actions para CI/CD
- [ ] Plugin VS Code (visualizar índice, atualizar docs inline)
- [ ] Benchmark de performance
- [ ] Documentação em inglês
- [ ] Suporte a monorepos
- [ ] Templates customizados (definidos pelo usuário)

### Out of Scope

- Plugin JetBrains — baixa demanda, foco no ecossistema VS Code/Claude Code
- Dashboard web — complexidade alta, valor baixo para v1
- Sincronização com Git remoto — fora do escopo core da ferramenta

## Context

- Projeto brownfield com CLI funcional (v0.2.0) em TypeScript/Bun
- 10 templates de frameworks já implementados com integração Context7
- Stack: TypeScript 5.7, Commander.js, Chalk, Ora, Bun Test
- Formato de linting: Biome via Ultracite
- Sem testes automatizados atualmente — barreira para contribuições externas
- Alvo: publicação npm para comunidade aberta de desenvolvedores
- Problemas de DX identificados: setup manual demais, docs desatualizam, faltam testes, templates limitados

## Constraints

- **Runtime**: Node.js 18+ (compatibilidade broad, evitar APIs exclusivas de versões recentes)
- **Package Manager**: Bun primário, npm compatível (manter ambos lockfiles)
- **Tamanho do índice**: Máximo ~4KB no CLAUDE.md (escaneável rapidamente pelo AI)
- **Dependências**: Manter leves — CLI deve instalar rápido e ter poucos deps
- **Backward Compat**: Formato de config.json e estrutura .claude-docs/ devem manter compatibilidade com v0.2.0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Context7 como fonte primária de docs | Único provedor com API de documentação para AI, SDK oficial disponível | ✓ Good |
| Formato de índice comprimido custom | Minimizar tokens (~4KB) enquanto mantém referências úteis | ✓ Good |
| Biome via Ultracite para linting | Rápido, unificado (formatter + linter), zero-config | ✓ Good |
| Bun como runtime primário | Performance, built-in test runner, compatível com npm | — Pending |
| Commander.js para CLI | Maduro, bem documentado, ampla adoção | ✓ Good |

---
*Last updated: 2026-02-05 after initialization*
