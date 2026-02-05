# Roadmap

> Passive Docs Index (PDI) - Planejamento de desenvolvimento

## Visão Geral

PDI é um sistema de documentação passiva para assistentes de IA, inspirado no [estudo da Vercel sobre AGENTS.md vs Skills](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals). O objetivo é fornecer contexto de documentação sempre disponível, eliminando a necessidade do agente decidir quando buscar informações.

---

## Status Atual: v0.2.0

| Fase | Status | Descrição |
|------|--------|-----------|
| Fase 1 | ✅ Completa | Especificação e Validação |
| Fase 2 | ✅ Completa | CLI Básico (v0.1.0) |
| Fase 3 | ✅ Completa | Geração de Conteúdo Real (v0.2.0) |
| Fase 4 | 📋 Próxima | Skills e Automação |
| Fase 5 | 🔮 Futuro | Extras e Publicação |

---

## ✅ Fase 1: Especificação e Validação

**Status:** Completa

- [x] Definir formato do índice comprimido
- [x] Definir estrutura de pastas (`.claude-docs/`)
- [x] Especificar comandos CLI
- [x] Definir templates de documentação
- [x] Especificar integração MCP

---

## ✅ Fase 2: CLI Básico (v0.1.0)

**Status:** Completa

### Comandos Implementados
- [x] `pdi init` - Inicializar estrutura no projeto
- [x] `pdi add` - Adicionar frameworks (placeholders)
- [x] `pdi sync` - Sincronizar com package.json
- [x] `pdi status` - Mostrar status atual
- [x] `pdi clean` - Remover docs órfãos
- [x] `pdi list` - Listar templates disponíveis

### Templates
- [x] Hono (backend)
- [x] Drizzle ORM (database)
- [x] Better Auth (autenticação)
- [x] Zod (validação)
- [x] React (frontend)
- [x] TanStack Query (data fetching)
- [x] TanStack Router (routing)
- [x] Vite (build)
- [x] Vitest (testing)
- [x] Tailwind CSS (styling)

---

## ✅ Fase 3: Geração de Conteúdo Real (v0.2.0)

**Status:** Completa

### Cliente Context7 Unificado
- [x] Cliente HTTP via `@upstash/context7-sdk`
- [x] Cliente MCP via `mcp-cli` (fallback)
- [x] Prioridade: HTTP → MCP → Placeholders
- [x] Tratamento automático de redirects de library IDs
- [x] Cache de library IDs resolvidos

### Comandos de Conteúdo
- [x] `pdi add` com busca real via Context7
  - [x] Flag `--offline` para placeholders
  - [x] Modo interativo (seleção visual)
  - [x] Detecção automática do package.json
- [x] `pdi update` - Re-buscar docs atualizados
- [x] `pdi generate internal` - Gerar docs de padrões

### Comandos de Configuração
- [x] `pdi auth` - Configuração de API key
  - [x] Salvar em `~/.config/pdi/config.json`
  - [x] Validação da API key
  - [x] Opções: `--status`, `--logout`
- [x] `pdi doctor` - Diagnóstico completo
  - [x] Verificar autenticação
  - [x] Verificar inicialização
  - [x] Verificar docs instalados
  - [x] Recomendações de ações

### Correções
- [x] Library ID do Tailwind corrigido
- [x] Mensagens de erro mais claras
- [x] Carregamento automático de API key

---

## 📋 Fase 4: Skills e Automação

**Status:** Próxima

### Skills Claude
- [ ] `/pdi-analyze` - Análise do projeto
  - Verificar status de docs
  - Detectar padrões não documentados
  - Sugerir melhorias
- [ ] `/pdi-generate` - Geração assistida
  - Gerar docs via Claude
  - Melhorar descrições com AI
  - Customizar templates

### Automação
- [ ] Hook para `bun install` / `npm install`
  - Sugerir `pdi sync` automaticamente
  - Detectar novos frameworks
- [ ] Integração com Git hooks
  - Pre-commit: verificar índice
  - Post-merge: sugerir atualização

---

## 🔮 Fase 5: Extras

**Status:** Futuro

### Distribuição
- [ ] Publicação no npm
- [ ] Publicação no JSR (Deno)
- [ ] GitHub Actions para CI/CD

### Integrações
- [ ] Plugin para VS Code
  - Visualizar índice
  - Atualizar docs inline
- [ ] Plugin para JetBrains IDEs

### Qualidade
- [ ] Testes automatizados
  - Unit tests
  - Integration tests
  - E2E tests
- [ ] Benchmark de performance
- [ ] Documentação em inglês

### Funcionalidades Adicionais
- [ ] Suporte a monorepos
- [ ] Templates customizados
- [ ] Sincronização com Git remoto
- [ ] Dashboard web

---

## Contribuição

Contribuições são bem-vindas! Veja o arquivo [CONTRIBUTING.md](docs/CONTRIBUTING.md) para mais detalhes.

### Prioridades de Contribuição

1. **Alta:** Testes automatizados
2. **Alta:** Novos templates de frameworks
3. **Média:** Skills Claude
4. **Média:** Integrações com IDEs
5. **Baixa:** Dashboard web

---

## Links

- [Repositório](https://github.com/syx-labs/passive-docs-index)
- [Changelog](CHANGELOG.md)
- [Documentação](README.md)
- [Context7](https://context7.com) - Fonte de documentação
