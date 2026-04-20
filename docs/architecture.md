# Архитектура расширения 1С: Редактор конфигураций

## Назначение

VSCode-расширение (`v8vscedit`) предоставляет два независимых функциональных блока для работы с 1С:Предприятие:

1. **[Навигатор метаданных](./metadata-navigator.md)** — дерево объектов конфигураций и расширений из XML-выгрузки
2. **[Языковая поддержка BSL](./bsl-language-support.md)** — подсветка, автодополнение, навигация по коду `.bsl` через LSP-сервер

## Структура модулей

```
src/
├── extension.ts                  # Точка входа — activate() / deactivate() + запуск LSP-клиента
│
├── ConfigFinder.ts               # Поиск Configuration.xml в воркспейсе
│
├── MetadataTreeProvider.ts       # TreeDataProvider — построение дерева метаданных
├── MetadataNode.ts               # TreeItem-узел дерева, тип NodeKind
├── MetadataGroups.ts             # Конфигурация групп верхнего уровня (TOP_GROUPS, COMMON_SUBGROUPS)
├── CommandRegistry.ts            # Регистрация 8 команд навигатора + FileSystemWatcher
├── ModulePathResolver.ts         # Резолвинг путей к BSL-модулям объектов конфигурации
│
├── ConfigParser.ts               # Regex-парсинг Configuration.xml и объектных XML
│
├── nodes/                        # Дескрипторы узлов (один файл = один тип объекта)
│   ├── index.ts                  # Реестр NODE_DESCRIPTORS: Record<NodeKind, NodeDescriptor>
│   ├── _types.ts                 # Интерфейс NodeDescriptor, ChildTag, CommandId, CHILD_TAG_CONFIG
│   ├── _base.ts                  # Фабрика buildNode() — создаёт MetadataNode по дескриптору
│   ├── root/                     # configuration, extension
│   ├── groups/                   # group-common, group-type
│   ├── common/                   # Общие объекты (CommonModule, Role, CommonForm, ...)
│   ├── objects/                  # Объекты верхнего уровня (Catalog, Document, ...)
│   ├── children/                 # Дочерние элементы (Attribute, TabularSection, Form, ...)
│   └── presentation/
│       ├── icon.ts               # getIconUris() — URI иконок light/dark
│       └── iconMap.ts            # getIconName() — имя SVG по NodeKind
│
├── language/                     # (legacy) Старые провайдеры через VS Code API — не используются
│
└── language-server/              # LSP-сервер языковой поддержки BSL
    ├── server.ts                 # Точка входа сервера: connection, TextDocuments, регистрация обработчиков
    ├── BslParserService.ts       # tree-sitter парсер (без vscode API), кэш по URI+версии
    ├── lspUtils.ts               # Утилиты: nodeToRange, getWordAtPosition, uriToFsPath
    └── providers/
        ├── semanticTokens.ts     # Семантические токены (LSP SemanticTokens, дельта-кодирование)
        ├── diagnostics.ts        # Диагностики через ERROR-узлы tree-sitter
        ├── symbols.ts            # Символы документа (Outline, хлебные крошки)
        ├── folding.ts            # Сворачивание блоков и #Область
        ├── hover.ts              # Подсказки при наведении (сигнатуры функций)
        ├── completion.ts         # Автодополнение (&, #, ключевые слова, метаданные)
        └── definition.ts         # Переход к определению (текущий файл → открытые → ФС)
```

## Граф зависимостей

```
extension.ts
  ├── ConfigFinder.ts
  ├── MetadataTreeProvider.ts
  │     ├── ConfigParser.ts
  │     ├── MetadataNode.ts
  │     ├── MetadataGroups.ts
  │     ├── ModulePathResolver.ts (resolveObjectXmlPath)
  │     ├── nodes/presentation/icon.ts
  │     ├── nodes/_base.ts
  │     ├── nodes/index.ts  ← все ~50 дескрипторов
  │     └── nodes/_types.ts
  ├── CommandRegistry.ts
  │     └── ModulePathResolver.ts (все get*Path функции)
  └── LanguageClient (vscode-languageclient/node)
        └── [dist/server.js] — отдельный Node.js процесс
              ├── BslParserService.ts
              └── providers/* (7 провайдеров)
```

## Точка входа

`activate()` в `extension.ts` выполняет:

1. Создаёт `MetadataTreeProvider` с пустым списком конфигураций
2. Регистрирует `TreeView` и команды навигатора (`registerCommands`)
3. Запускает `findConfigurations(rootPath)` → заполняет дерево метаданных
4. Создаёт и запускает `LanguageClient` → порождает дочерний процесс `dist/server.js`

`deactivate()` останавливает LSP-клиент (и сервер) через `client.stop()`.

## Ключевые архитектурные решения

| Решение | Обоснование |
|---|---|
| LSP-сервер в отдельном процессе | Изоляция: краш сервера не роняет VS Code; мультиредакторность |
| `src/language-server/` в монорепо | Один `package.json`, единый `webpack.config.js` с двумя `entry` |
| Webpack `entry: { extension, server }` | `dist/extension.js` — клиент, `dist/server.js` — сервер; WASM копируется один раз |
| Кэш деревьев по URI+версии | Несколько провайдеров запрашивают одно дерево за одну сессию — возвращается кэш |
| Regex-парсинг XML вместо DOM | XML-выгрузка 1С имеет предсказуемую структуру; DOM-парсер — лишняя зависимость |
| Ленивая загрузка узлов дерева | `childrenLoader()` вызывается только при раскрытии узла |
| `emitted: Set<number>` в SemanticTokensProvider | Предотвращает двойную эмиссию при пересечении структурных и листовых узлов AST |

## Подробная документация

- [Навигатор метаданных](./metadata-navigator.md) — дерево, дескрипторы, команды, path resolver
- [Языковая поддержка BSL](./bsl-language-support.md) — LSP-сервер, парсер, провайдеры
- [Парсинг XML конфигурации](./metadata-parser.md) — алгоритмы разбора Configuration.xml и объектных XML
- [Провайдеры BSL](./bsl-providers.md) — детали каждого языкового провайдера
