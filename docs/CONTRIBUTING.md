# Guia de Contribuição

Obrigado por considerar contribuir com o Passive Docs Index!

## Configurando o Ambiente

### Pré-requisitos

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 18 (opcional, para testes de compatibilidade)

### Setup

```bash
# Clone o repositório
git clone https://github.com/user/passive-docs-index.git
cd passive-docs-index

# Instale dependências
bun install

# Verifique se tudo está funcionando
bun run typecheck
bun run build
```

## Estrutura do Projeto

```
passive-docs-index/
├── src/
│   ├── cli.ts              # Entrada do CLI
│   ├── index.ts            # Exports da biblioteca
│   ├── commands/           # Comandos do CLI
│   │   ├── init.ts
│   │   ├── add.ts
│   │   ├── sync.ts
│   │   ├── status.ts
│   │   └── clean.ts
│   └── lib/                # Biblioteca core
│       ├── types.ts        # Interfaces TypeScript
│       ├── constants.ts    # Constantes e frameworks conhecidos
│       ├── config.ts       # Gestão de configuração
│       ├── index-parser.ts # Parser do índice comprimido
│       ├── templates.ts    # Templates de frameworks
│       ├── context7.ts     # Integração MCP
│       └── fs-utils.ts     # Utilitários de filesystem
├── docs/                   # Documentação
├── dist/                   # Build output
└── package.json
```

## Fluxo de Desenvolvimento

### 1. Crie uma Branch

```bash
git checkout -b feature/minha-feature
# ou
git checkout -b fix/meu-bugfix
```

### 2. Faça suas Alterações

Siga o estilo de código existente:
- TypeScript strict mode
- ESM modules
- Funções puras quando possível
- Documentação JSDoc para funções públicas

### 3. Teste Localmente

```bash
# Verificar tipos
bun run typecheck

# Build
bun run build

# Testar CLI
bun dist/cli.js --help
bun dist/cli.js init
bun dist/cli.js add hono
```

### 4. Commit

Siga o padrão de commits convencionais:

```
feat: add support for new framework X
fix: correct index parsing for empty categories
docs: update README with new examples
refactor: simplify config loading logic
```

### 5. Crie um Pull Request

- Descreva suas alterações
- Mencione issues relacionadas
- Inclua screenshots se relevante

## Tipos de Contribuição

### Adicionando Novos Frameworks

Veja [TEMPLATES.md](./TEMPLATES.md) para instruções detalhadas.

Checklist:
1. [ ] Adicionar template em `src/lib/templates.ts`
2. [ ] Adicionar padrão de detecção em `src/lib/constants.ts` (KNOWN_FRAMEWORKS)
3. [ ] Testar `pdi add <framework>`
4. [ ] Atualizar README com novo framework

### Corrigindo Bugs

1. Crie uma issue descrevendo o bug
2. Reproduza o problema localmente
3. Escreva um teste (se possível)
4. Implemente a correção
5. Verifique se todos os testes passam

### Melhorias de Documentação

- Corrija typos e erros
- Adicione exemplos
- Melhore clareza
- Traduza para outros idiomas

### Novas Features

Antes de implementar uma feature grande:
1. Abra uma issue para discussão
2. Aguarde feedback
3. Implemente após aprovação

## Estilo de Código

### TypeScript

```typescript
// ✅ Bom
export function parseIndex(content: string): IndexSection[] {
  const sections: IndexSection[] = [];
  // ...
  return sections;
}

// ❌ Evite
export function parseIndex(content) {
  var sections = [];
  // ...
  return sections;
}
```

### Imports

```typescript
// ✅ Use imports ES6 com .js extension
import { readFile } from 'node:fs/promises';
import type { PDIConfig } from './types.js';
import { KNOWN_FRAMEWORKS } from './constants.js';

// ❌ Evite
const fs = require('fs');
import { PDIConfig } from './types';
```

### Comentários

```typescript
// ✅ JSDoc para funções exportadas
/**
 * Parse the compressed index format from a string
 * @param content - Raw index content
 * @returns Parsed index sections
 */
export function parseIndex(content: string): IndexSection[] {

// ✅ Comentários de seção
// ============================================================================
// Config File Operations
// ============================================================================

// ❌ Evite comentários óbvios
// Loop through items
for (const item of items) {
```

### Estrutura de Arquivos

- Um conceito por arquivo
- Exports no final ou inline
- Imports agrupados: node > external > internal

## Testes

```bash
# Executar testes
bun test

# Watch mode
bun test --watch
```

### Escrevendo Testes

```typescript
import { describe, it, expect } from 'bun:test';
import { parseIndex } from '../src/lib/index-parser';

describe('parseIndex', () => {
  it('should parse section header', () => {
    const content = '[Framework Docs]|root:.claude-docs/frameworks';
    const sections = parseIndex(content);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Framework Docs');
    expect(sections[0].root).toBe('.claude-docs/frameworks');
  });
});
```

## Releases

Mantemos um CHANGELOG.md com as mudanças. Ao contribuir, adicione sua mudança na seção "Unreleased".

```markdown
## [Unreleased]

### Added
- Support for framework X (#123)

### Fixed
- Index parsing for special characters (#124)
```

## Perguntas?

- Abra uma issue com a tag `question`
- Discussões no GitHub Discussions

## Código de Conduta

- Seja respeitoso
- Aceite feedback construtivo
- Foque no código, não na pessoa
- Ajude novos contribuidores

Obrigado por contribuir! 🎉
