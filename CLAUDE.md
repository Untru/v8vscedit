# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**v8vscedit** — VS Code extension for editing 1C:Enterprise configurations and extensions. Provides a metadata tree navigator for XML-exported configs and a BSL language server (syntax highlighting, autocomplete, hover, go-to-definition).

## Build & Development Commands

```bash
npm run build          # Production webpack bundle (extension.js + server.js)
npm run watch          # Dev mode with file watching
npm run compile        # TypeScript compile only (no webpack)
npm test               # Build dev + run tests in VS Code test electron
```

To package and install locally:
```bash
npx @vscode/vsce package --allow-missing-repository
code --install-extension v8vscedit-*.vsix --force
```

Debug: press F5 in VS Code — launches Extension Development Host (configured in `.vscode/launch.json`).

## Architecture

The extension has two independent subsystems running in separate processes:

### 1. Metadata Navigator (client-side)

Entry point: `src/extension.ts` → `activate()`.

Core flow: `ConfigFinder` recursively searches workspace for `Configuration.xml` files → `ConfigParser` extracts metadata via regex (no DOM) → `MetadataTreeProvider` builds a lazy-loaded tree of `MetadataNode` items.

**Data-driven design** — no switch/case on metadata type. Instead:
- **Node descriptors** (`src/nodes/`) define icon, folder name, allowed children for each of 50+ `NodeKind` types. All registered in `NODE_DESCRIPTORS` map.
- **Object handlers** (`src/handlers/`) implement `ObjectHandler` interface (buildTreeNodes, getProperties). One file per metadata type, all registered in `HANDLER_REGISTRY`.

Adding a new metadata type = add a descriptor in `nodes/`, a handler in `handlers/`, and register both.

### 2. BSL Language Server (separate process)

Entry point: `src/language-server/server.ts`. Webpack bundles it as `dist/server.js`.

Uses **tree-sitter** (WASM) for parsing BSL. `BslParserService` wraps the parser with a cache keyed by URI+version. `BslContextService` loads common modules from `Configuration.xml` for cross-file completion/definition.

LSP providers live in `src/language-server/providers/`: semanticTokens, diagnostics, symbols, folding, hover, completion, definition.

The client-side `LspManager` (`src/services/LspManager.ts`) manages the server lifecycle and supports switching between built-in LSP, external bsl-analyzer, or off.

### Key Modules

| Module | Purpose |
|--------|---------|
| `ConfigParser.ts` | Regex-based XML parsing (extractSimpleTag, extractSynonym, parseConfigXml, parseObjectXml) |
| `ModulePathResolver.ts` | Resolves MetadataNode → .bsl file path (object/manager/form/command modules) |
| `OnecFileSystemProvider.ts` | Virtual `onec://` filesystem — enforces readonly for support-locked objects |
| `SupportInfoService.ts` | Parses `ParentConfigurations.bin` to determine support mode (own/locked/editable) |
| `CommandRegistry.ts` | Registers 8 module-open commands + config action commands |

### Metadata Groups

Defined in `MetadataGroups.ts`:
- `COMMON_SUBGROUPS` (23 types) — shown under "Общие" group (Subsystem, CommonModule, Role, etc.)
- `TOP_GROUPS` (17 types) — top-level groups (Catalog, Document, Register types, etc.)

## Testing

Tests use Mocha (TDD UI) + `@vscode/test-electron`. Test files in `src/test/suite/`. Tests require an `example/` directory with test configurations (gitignored).

## Extension Settings

Three user-configurable settings:
- `v8vscedit.lsp.mode` — `"built-in"` | `"bsl-analyzer"` | `"off"`
- `v8vscedit.bslAnalyzer.autoUpdate` — auto-check for updates
- `v8vscedit.bslAnalyzer.path` — custom binary path

## Language Support

BSL language ID with extensions `.bsl`, `.os`. Word pattern includes Cyrillic (`[\wа-яА-Я_]`). Indent rules handle Russian keywords (Процедура/КонецПроцедуры, Если/КонецЕсли, etc.).
