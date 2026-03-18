# Провайдеры языка BSL

Детали реализации каждого из семи языковых провайдеров LSP-сервера. Все провайдеры принимают `BslParserService` и `TextDocument` (из `vscode-languageserver-textdocument`), вызывают `parserService.parse(text, uri, version)` для получения AST.

Общий контекст — [bsl-language-support.md](./bsl-language-support.md).

---

## semanticTokens.ts

Файл: `src/language-server/providers/semanticTokens.ts`

Возвращает LSP-кодированный массив семантических токенов (`number[]`).

### LspSemanticTokensBuilder

Собственный построитель вместо VS Code `SemanticTokensBuilder`:

```typescript
push(line, char, length, tokenTypeIndex, tokenModifiers): void
build(): number[]  // flat array, 5 чисел на токен, отсортировано по (line, char)
```

Дельта-кодирование LSP: `[deltaLine, deltaChar, length, typeIdx, modBitmask]`.

### Типы токенов (BSL_TOKEN_TYPES)

```
comment, string, keyword, number, operator,
function, method, variable, parameter, property,
class, annotation, preprocessor
```

### Алгоритм walkNode()

Рекурсивный обход AST с `emitted: Set<number>` для дедупликации по `node.id`.

**Листовые узлы** — эмитируются и рекурсия останавливается:

| Тип AST-узла | Токен |
|---|---|
| `line_comment` | `comment` |
| `string` | `string` |
| `string_content` внутри `multiline_string` | `string` (каждый отдельно) |
| `number`, `date` | `number` |
| Любой из `KEYWORD_TYPES` (35 типов) | `keyword` |
| Любой из `PREPROC_TYPES` | `preprocessor` |
| `annotation` | `annotation` |
| `operator` | `operator` |
| `property` | `property` |
| `identifier` (не захваченный выше) | `variable` |

**Структурные узлы** — именуют поля, затем рекурсируют в дочерние:

| Тип AST-узла | Именованное поле | Токен |
|---|---|---|
| `procedure_definition` / `function_definition` | `name` | `function` + `declaration` |
| `method_call` | `name` | `method` |
| `parameter` | `name` | `parameter` + `declaration` |
| `var_definition` / `var_statement` | `var_name` (множество) | `variable` + `declaration` |
| `new_expression` | `type` | `class` |

---

## diagnostics.ts

Файл: `src/language-server/providers/diagnostics.ts`

Вычисляет диагностики через ERROR-узлы tree-sitter. Возвращает `Diagnostic[]`.

Дебаунс 500 мс управляется в `server.ts`, не в провайдере.

**Правила фильтрации:**
- Не рекурсирует внутрь ERROR-узла — предотвращает каскад ложных ошибок
- Однострочные ERROR-узлы длиной ≤ 1 символ игнорируются (артефакты восстановления парсера)

---

## symbols.ts

Файл: `src/language-server/providers/symbols.ts`

Возвращает `DocumentSymbol[]` для Outline и хлебных крошек.

**Алгоритм:**
1. Проходит `root.namedChildren` (только верхний уровень)
2. Отбирает `procedure_definition` и `function_definition`
3. Аннотация-сиблинг перед функцией → `detail`
4. Дочерние символы — локальные переменные из `var_statement` / `var_definition`

---

## folding.ts

Файл: `src/language-server/providers/folding.ts`

Два прохода по AST:

**collectBlockRanges()** — рекурсивный обход для структурных блоков (`BLOCK_TYPES`):
```
procedure_definition, function_definition, try_statement,
if_statement, while_statement, for_statement, for_each_statement
```

**collectRegionRanges()** — стековый алгоритм для пар `#Область` / `#КонецОбласти`.

---

## hover.ts

Файл: `src/language-server/providers/hover.ts`

Показывает сигнатуру процедуры/функции при наведении.

**Алгоритм:**
1. `getWordAtPosition(text, position, /[\wа-яА-ЯёЁ_]+/)` из `lspUtils.ts`
2. Ищет определение в `root.namedChildren` (case-insensitive)
3. Возвращает `{ kind: 'markdown', value: '```bsl\n...\n```' }`

Включает параметры с `Знач`, дефолтными значениями и аннотацию-сиблинг.

---

## completion.ts

Файл: `src/language-server/providers/completion.ts`

Триггеры: `&`, `#`. Также активируется при обычном вводе.

**Режим `&`** — 20 аннотаций (двуязычные): `&НаКлиенте`, `&AtClient`, ...

**Режим `#`** — 14 директив препроцессора: `#Область`, `#Region`, ...
`insertText` = значение без символа `#`.

**Обычный ввод — три источника:**
1. Ключевые слова BSL (32 слова, двуязычные)
2. Локальные символы из AST: процедуры/функции + переменные
3. Объекты метаданных из `Configuration.xml` (18 типов, RU+EN варианты)

Метаданные читаются через `fs.promises.readFile` (без VS Code API).
Кэш `metaCache` инвалидируется при изменении `Configuration.xml` через `onDidChangeWatchedFiles`.

---

## definition.ts

Файл: `src/language-server/providers/definition.ts`

Переход к определению процедуры/функции (F12 / Ctrl+Click).

### Четырёхступенчатый поиск

1. **Текущий документ** — `findInText(text, uri, name)` без обращения к ФС
2. **Кэш** `definitionCache: Map<name.toLowerCase(), Location>` — быстрый ответ
3. **Открытые документы** `documents.all()` — без чтения файлов
4. **Файловая система** — `findBslFiles(root)` рекурсивно (глубина 10, без `node_modules`)

`findBslFiles()` использует `fs.promises.readdir` — нет зависимости от VS Code API.

### Инвалидация кэша

`invalidateDefinitionCache()` вызывается при любом изменении BSL-файла (`onDidChangeWatchedFiles`).

Поиск ведётся только по `procedure_definition` и `function_definition` на корневом уровне AST.
