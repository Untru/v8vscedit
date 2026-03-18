# Языковая поддержка BSL

## Назначение

Обеспечивает полноценную языковую поддержку для файлов `.bsl` и `.os` в VSCode: семантическую подсветку синтаксиса, навигацию, автодополнение и диагностику ошибок на основе парсера [tree-sitter-bsl](https://github.com/nicotine-plus/tree-sitter-bsl).

Реализована как **LSP-сервер** (`src/language-server/`) — отдельный Node.js процесс, взаимодействующий с VS Code через [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

## Архитектура: клиент и сервер

```
VS Code Extension Process (dist/extension.js)
    │
    │  IPC (vscode-languageclient)
    │
LSP Server Process (dist/server.js)
    ├── BslParserService  (web-tree-sitter WASM)
    └── providers/
        ├── semanticTokens  →  textDocument/semanticTokens
        ├── diagnostics     →  textDocument/publishDiagnostics
        ├── symbols         →  textDocument/documentSymbol
        ├── folding         →  textDocument/foldingRange
        ├── hover           →  textDocument/hover
        ├── completion      →  textDocument/completion
        └── definition      →  textDocument/definition
```

**Клиент** (`extension.ts`) создаёт `LanguageClient`, который:
- Порождает дочерний процесс `dist/server.js` через IPC
- Автоматически маршрутизирует все LSP-запросы VS Code к серверу
- Синхронизирует открытые документы и изменения файлов

## Парсер (BslParserService)

Сервис на базе `web-tree-sitter`. Кэширует деревья по URI + номеру версии документа.

### Инициализация

`ensureInit()` — ленивая инициализация с кэшированным промисом. Вызывается в `onInitialized` сервера до открытия первого файла.

WASM-файлы расположены рядом с `server.js` в `dist/`:
```typescript
const tsWasm = path.join(__dirname, 'tree-sitter.wasm');
await Parser.init({ locateFile: () => tsWasm });
const lang = await Language.load(path.join(__dirname, 'tree-sitter-bsl.wasm'));
```

### Кэш и инвалидация

```typescript
parse(text: string, uri: string, version: number): Tree
```

- **Кэш** `Map<uri, { version, tree }>` — несколько провайдеров за одну сессию запроса делят одно дерево
- **Инвалидация** при закрытии документа и при изменении BSL-файлов (`onDidChangeWatchedFiles`)
- **version = -1** — разовый парсинг без кэширования (используется при кросс-файловом поиске)

## Регистрация capabilities

В `onInitialize` сервер объявляет поддерживаемые возможности:

```typescript
{
  textDocumentSync: TextDocumentSyncKind.Incremental,
  completionProvider: { triggerCharacters: ['&', '#'] },
  hoverProvider: true,
  definitionProvider: true,
  documentSymbolProvider: true,
  foldingRangeProvider: true,
  semanticTokensProvider: { legend: { ... }, full: true },
}
```

## Диагностика

Вычисляется в `computeDiagnostics()` через ERROR-узлы tree-sitter.

Дебаунс 500 мс реализован в `server.ts` (не в провайдере) — таймеры хранятся в `diagTimers: Map<uri, NodeJS.Timeout>`.

Алгоритм:
1. ERROR-узел найден → проверяем что не тривиальный (≤1 символ)
2. **Не рекурсируем внутрь** ERROR-узла — предотвращает каскад ложных ошибок
3. При закрытии документа → `sendDiagnostics({ diagnostics: [] })`

## Семантические токены

`provideSemanticTokens()` обходит AST и возвращает LSP-кодированный массив.

### LspSemanticTokensBuilder

Собственный построитель дельта-кодирования (LSP требует flat uint32 array):

```
[deltaLine, deltaChar, length, tokenTypeIndex, tokenModifiersEncoded]  ×N
```

Токены накапливаются в произвольном порядке, **сортируются** по (line, char) в `build()` — это корректно обрабатывает любой порядок обхода дерева.

13 типов токенов: `comment`, `string`, `keyword`, `number`, `operator`, `function`, `method`, `variable`, `parameter`, `property`, `class`, `annotation`, `preprocessor`.

## Автодополнение

`provideCompletionItems()` использует `workspaceRoots` (из `InitializeParams.workspaceFolders`) для поиска `Configuration.xml` и извлечения имён объектов метаданных.

Чтение XML через `fs.promises.readFile` — нет зависимости от VS Code API.

Кэш метаданных (`metaCache: Map<rootPath, CompletionItem[]>`) инвалидируется через `invalidateMetaCache()` при `onDidChangeWatchedFiles` для `Configuration.xml`.

## Переход к определению

`provideDefinition()` ищет определение в три этапа:

1. **Текущий документ** — поиск в AST без обращения к ФС
2. **Кэш** `definitionCache: Map<name, Location>` — быстрый ответ для известных символов
3. **Открытые документы** (`documents.all()`) — без чтения файлов
4. **Файловая система** — рекурсивный обход `workspaceRoots`, `findBslFiles()` (глубина 10, без `node_modules`)

Кэш сбрасывается при любом изменении BSL-файла (`invalidateDefinitionCache()`).

## Сборка

`webpack.config.js` объявляет два `entry`:

```javascript
entry: {
  extension: './src/extension.ts',   // → dist/extension.js
  server:    './src/language-server/server.ts',  // → dist/server.js
}
```

WASM-файлы копируются в `dist/` один раз через `CopyWebpackPlugin` и доступны обоим бандлам.

## Язык BSL (language-configuration.json)

- Расширения файлов: `.bsl`, `.os`
- Строчный комментарий: `//`
- Автозакрытие: `()`, `[]`, `""`
- Паттерн слова: `[\wа-яА-Я_][\wа-яА-Я_0-9]*` (поддержка кириллицы)
- Увеличение отступа: `Тогда`, `Then`, `Цикл`, `Do`, `Попытка`, `Процедура`, `Функция`
- Уменьшение отступа: `КонецЕсли`, `КонецЦикла`, `Иначе`, `ИначеЕсли` и EN-аналоги

## Семантические токены — цвета по умолчанию

| Тип токена | Цвет | Применение |
|---|---|---|
| `annotation:bsl` | `#C678DD` (фиолетовый) | `&НаКлиенте`, `&Перед`, ... |
| `preprocessor:bsl` | `#A07850` (коричневый) | `#Область`, `#Если`, ... |
| `function:bsl` | `#DCDCAA` (жёлтый) | Имена процедур и функций |
| `parameter:bsl` | `#9CDCFE` (голубой) | Параметры процедур и функций |

## Подробная документация провайдеров

Детали реализации каждого провайдера — в [bsl-providers.md](./bsl-providers.md).
