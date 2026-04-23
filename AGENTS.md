# AGENTS.md — инструкции для агентов

Документация проекта ведётся в `./docs`. Этот файл — контракт для любого агента, вносящего изменения в расширение.

## Что это за проект

VSCode / Cursor-расширение `v8vscedit` — редактор выгрузки конфигураций и расширений 1С:Предприятие. Две независимые подсистемы:

1. **Навигатор метаданных** — дерево объектов из XML-выгрузки (CF и CFE), свойства, открытие BSL-модулей.
2. **Языковая поддержка BSL** — LSP-клиент (bsl-analyzer внешний или встроенный tree-sitter).

Главное: расширение читает уже выгруженные XML-файлы 1С и обеспечивает удобную навигацию + редактирование BSL-модулей; запись XML сейчас не реализована.

---

## Базовые правила общения

- Отвечать на русском языке.
- Комментарии и документация в коде — только на русском.
- Никаких декоративных эмодзи в коде и ответах.
- Избегать высокоуровневых ответов — давать конкретные решения применительно к проекту.
- Не писать «комментарии-капитаны» (`// импортируем X`, `// возвращаем результат`). Комментарий имеет право на жизнь, если объясняет *почему*, а не *что*.
- Коммиты — на русском.

## Технологический стек

- TypeScript ≥ 5.3, target ES2020, strict.
- VS Code API ≥ 1.85, `vscode-languageclient`/`vscode-languageserver`.
- Webpack 5 (сборка в `dist/`). Три entry: `extension`, `server`, `test/runTests`.
- `web-tree-sitter` + `tree-sitter-bsl` — для встроенного LSP.
- `iconv-lite` — декодирование OEM-866/Win1251 вывода vrunner.
- Тесты — Mocha через `@vscode/test-electron`.

---

## Целевая архитектура

Единый принцип: **одна декларативная таблица типов метаданных → один конвейер, использующий её везде**. Всё поведение — функции и сервисы поверх этой таблицы.

### Раскладка каталогов

```
src/
├── extension.ts                      # composition root (10 строк): new Container(ctx).activate()
├── container.ts                      # IoC-сборка: создаёт все сервисы, регистрирует команды/watcher/view
│
├── domain/                           # Чистый домен — НЕ импортирует vscode, fs, path из этой папки
│   ├── MetaTypes.ts                  # Единый реестр META_TYPES: Record<MetaKind, MetaTypeDef>
│   ├── MetaKind.ts                   # type MetaKind = keyof typeof META_TYPES
│   ├── ChildTag.ts                   # Перечисление тегов дочерних элементов + CHILD_TAG_CONFIG
│   ├── ModuleSlot.ts                 # Слоты модулей: 'Object'|'Manager'|'Form'|'Command'|…
│   ├── Configuration.ts              # ConfigInfo, ConfigEntry, ChildObjectsMap
│   ├── MetaObject.ts                 # MetaObject, MetaChild (результат парсинга XML объекта)
│   └── Ownership.ts                  # определение «свой/заимствованный» по namePrefix для CFE
│
├── infra/                            # Работа с файловой системой и XML; vscode не импортировать
│   ├── xml/
│   │   ├── ConfigXmlReader.ts        # парсер Configuration.xml → ConfigInfo
│   │   ├── ObjectXmlReader.ts        # парсер XML объекта → MetaObject
│   │   ├── PropertySchema.ts         # декларативные схемы свойств по MetaKind
│   │   └── XmlUtils.ts               # extractSimpleTag, extractSynonym, extractNestingAwareBlock
│   ├── fs/
│   │   ├── ConfigLocator.ts          # рекурсивный поиск Configuration.xml (bывш. ConfigFinder)
│   │   └── MetaPathResolver.ts       # единый resolver: XML + все модули по ModuleSlot
│   └── support/
│       ├── SupportInfoReader.ts      # чтение ParentConfigurations.bin, parse UUID → SupportMode
│       └── SupportInfoService.ts     # кэш по SHA-1 ParentConfigurations.bin
│
├── ui/                               # Всё, что знает про vscode API
│   ├── tree/
│   │   ├── MetadataTreeProvider.ts   # TreeDataProvider: только getTreeItem/getChildren/refresh
│   │   ├── TreeNode.ts               # vscode.TreeItem-обёртка над TreeNodeModel (тонкий)
│   │   ├── TreeNodeModel.ts          # POJO-модель узла (kind, xmlPath, ownership, metaContext, …)
│   │   ├── nodeBuilders/
│   │   │   ├── ConfigRootBuilder.ts      # корневые узлы конфигурации/расширения
│   │   │   ├── GroupBuilder.ts           # группа «Общие», группы типов, «Документы» с подветками
│   │   │   ├── MetaObjectBuilder.ts      # универсальный builder листа и структурного объекта
│   │   │   ├── MetaChildBuilder.ts       # реквизиты, ТЧ+колонки, формы, команды, макеты
│   │   │   └── SubsystemBuilder.ts       # спец-builder для рекурсивной иерархии подсистем
│   │   └── decorations/
│   │       ├── SupportDecorator.ts       # добавляет -supportN суффикс к contextValue
│   │       └── SupportDecorationProvider.ts  # FileDecorationProvider для цвета в Explorer
│   ├── views/
│   │   ├── PropertiesViewProvider.ts     # singleton WebviewPanel (как сейчас)
│   │   └── properties/
│   │       └── PropertyBuilder.ts        # один builder по PropertySchema
│   ├── commands/
│   │   ├── CommandRegistry.ts            # registerAll(ctx, services) — диспатч по классам-командам
│   │   ├── open/
│   │   │   ├── OpenXmlCommand.ts
│   │   │   └── OpenModuleCommand.ts      # один на все слоты модулей
│   │   ├── properties/
│   │   │   └── ShowPropertiesCommand.ts
│   │   ├── support/
│   │   │   └── SupportIndicatorCommands.ts
│   │   └── ext/
│   │       ├── VrunnerRunner.ts          # spawn + декодер кодировок + прогресс
│   │       ├── DecompileExtensionCommand.ts
│   │       ├── CompileExtensionCommand.ts
│   │       ├── UpdateExtensionCommand.ts
│   │       ├── CompileAndUpdateExtensionCommand.ts
│   │       └── ShowConfigActionsCommand.ts
│   ├── vfs/
│   │   ├── OnecFileSystemProvider.ts
│   │   └── OnecUriBuilder.ts
│   └── readonly/
│       └── BslReadonlyGuard.ts           # ReadonlySession для BSL-файлов под замком поддержки
│
├── lsp/                                  # Подсистема языковой поддержки BSL (одна)
│   ├── LspManager.ts
│   ├── analyzer/
│   │   ├── BslAnalyzerService.ts
│   │   └── BslAnalyzerStatusBar.ts
│   └── server/                           # Встроенный LSP-сервер (tree-sitter)
│       ├── server.ts                     # entry для dist/server.js
│       ├── BslContextService.ts
│       ├── BslDocumentContext.ts
│       ├── BslParserService.ts
│       ├── lspUtils.ts
│       └── providers/…                   # semanticTokens, diagnostics, hover, completion, …
│
└── test/
    ├── runTests.ts
    └── suite/…
```

### Центральный контракт — `META_TYPES`

Единственный источник правды по типам метаданных. Всё остальное (иконки, папки выгрузки, дочерние элементы, слоты модулей, группировка в дереве, свойства) описывается здесь.

```typescript
// domain/MetaTypes.ts
export interface MetaTypeDef {
  kind: MetaKind;                  // 'Catalog'
  label: string;                   // 'Справочник'
  pluralLabel: string;             // 'Справочники'
  folder: string;                  // 'Catalogs'
  icon: string;                    // имя SVG без расширения
  group: 'common' | 'top' | 'documents' | 'hidden';
  groupOrder: number;
  childTags?: readonly ChildTag[]; // ['Attribute','TabularSection','Form','Command','Template']
  modules?: readonly ModuleSlot[]; // ['Object','Manager']
  propertySchema?: string;         // ключ в PROPERTY_SCHEMAS
  singleClickCommand?: CommandId;
}
```

Правила:
- **Добавление нового типа метаданных — ТОЛЬКО одна запись в `META_TYPES`.** Если пришлось править что-то ещё — это признак утечки знаний из реестра.
- Никаких параллельных словарей `typeToFolder`, `NODE_DESCRIPTORS`, `HANDLER_REGISTRY`.
- `ConfigXmlReader`, `MetaPathResolver`, `MetaObjectBuilder`, `GroupBuilder`, `PropertyBuilder` — все читают данные из `META_TYPES`.

### Центральный контракт — `MetaPathResolver`

Один класс вместо 9 функций:

```typescript
class MetaPathResolver {
  resolveXml(kind: MetaKind, name: string, root: string): string | null;
  resolveModule(node: TreeNodeModel, slot: ModuleSlot): string | null;
  ensureCommonModuleFile(node: TreeNodeModel): string | null;
  getObjectLocation(xmlPath: string): ObjectLocation;
}
```

Карта слотов модулей (`Object→Ext/ObjectModule.bsl` и т.п.) — внутри класса как данные.

### Слои и правила зависимостей

```
domain          ←   никто (самый низ)
infra           ←   domain
ui              ←   domain, infra
lsp             ←   infra (на чтение файлов), domain (опционально)
container/ext   ←   всё
```

Запреты:
- `domain/**` не импортирует `vscode`, `fs`, `path`.
- `infra/**` не импортирует `vscode`.
- `ui/**` не содержит regex-парсинга XML и вычислений путей — только вызовы `infra/*`.
- LSP-сервер (`lsp/server/*`) не импортирует ничего из `ui/**` — он работает в отдельном процессе.

### Composition root

```typescript
// extension.ts
export function activate(ctx: vscode.ExtensionContext): void {
  container = new Container(ctx);
  container.activate();
}
export function deactivate(): Promise<void> | undefined {
  return container?.deactivate();
}
```

`Container` — единственное место создания всех сервисов. Он:
1. Создаёт `OutputChannel` и все сервисы домена/инфры.
2. Регистрирует `OnecFileSystemProvider`, `TreeView`, `SupportDecorationProvider`, `FileSystemWatcher`.
3. Вызывает `CommandRegistry.registerAll(ctx, services)`.
4. Стартует `LspManager`.

---

## Инвариант изменений — как добавлять функциональность

Для каждого сценария указано, какие файлы трогать. Если требуется править что-то сверх списка — это признак, что задача решается в другом слое.

### Новый тип метаданных

1. Добавить запись в `META_TYPES` (`domain/MetaTypes.ts`).
2. Если у объекта есть специфический модуль — добавить `ModuleSlot` в `domain/ModuleSlot.ts` и в карту слотов внутри `infra/fs/MetaPathResolver.ts`.
3. Если нужен набор свойств — добавить схему в `PROPERTY_SCHEMAS` (`infra/xml/PropertySchema.ts`).
4. Иконку положить в `src/icons/{light,dark}/<icon>.svg` (имя — ровно то, что указано в `icon` записи `META_TYPES`).
5. При нестандартной логике сборки узла (например, рекурсия подсистем) — добавить builder в `ui/tree/nodeBuilders/<имя>.ts` и подключить в диспетчере `metaObjectTreeBuilder.ts`. Иначе — ничего.
6. Добавить тест `ObjectXmlReader` на реальный пример из `example/`.

### Новый слот модуля (`ModuleSlot`)

Нужен, когда появляется новый BSL-файл объекта (например, `VariantChangeModule` у отчёта).

1. Добавить литерал в `domain/ModuleSlot.ts`.
2. Зарегистрировать путь в карте слотов внутри `infra/fs/MetaPathResolver.ts` (`Ext/<Имя>.bsl`).
3. Если нужна команда «Открыть модуль …» — добавить `OpenModuleCommandId` и команду в `ui/commands/CommandRegistry.ts`.
4. Подвязать к типам: расширить поле `modules` в нужных записях `META_TYPES`.

### Новый тип дочернего элемента (`ChildTag`)

Нужен, когда в XML объекта появляется новый вложенный тег (например, `AddressingAttribute` у задачи).

1. Добавить значение в `domain/ChildTag.ts` + `CHILD_TAG_CONFIG` (иконка, лейбл, порядок сортировки).
2. Если элемент идёт внутри собственного контейнера ТЧ-подобного типа — расширить `ObjectXmlReader.parseChildren`.
3. В нужных записях `META_TYPES` добавить тег в `childTags`.

### Новая схема свойств объекта

1. Добавить объект-схему в `infra/xml/PropertySchema.ts → PROPERTY_SCHEMAS` (ключ = значение `propertySchema` в `META_TYPES`).
2. Если появляется новый `PropertyValueKind` (например, ссылка на другой объект) — расширить `ui/views/properties/_types.ts` и добавить рендер в `PropertyBuilder.ts`.
3. Регулярки для парсинга свойств — только в `infra/xml/`, не в UI.

### Новая команда

1. Класс (или функция) в `ui/commands/...` с явным `readonly id: string` и обработчиком.
2. Регистрация в `CommandRegistry.registerAll(ctx, services)`.
3. `package.json → contributes.commands` — title/category/icon.
4. Если команда должна появляться в контекстном меню узла дерева — `contributes.menus.view/item/context` c предикатом `when: viewItem =~ /…/`. Контекст-значения задаются в `TreeNode` через `contextValue` и формируются из `MetaKind` + опциональных суффиксов (`-supportN`, `-own`, `-borrowed`).
5. Если нужна горячая клавиша — `contributes.keybindings`.

### Новый builder узла дерева

Нужен только когда тип имеет нестандартное поведение (рекурсия, группировка, спец-дети).

1. Создать `ui/tree/nodeBuilders/<имя>.ts` с функцией `build<Имя>(ctx: HandlerContext): MetadataNode[]` или `build<Имя>Children(node): MetadataNode[]`.
2. Зарегистрировать в диспетчере `ui/tree/nodeBuilders/metaObjectTreeBuilder.ts` (или напрямую в `MetadataTreeProvider` для корневых групп).
3. Любые XML-чтения — через `parseObjectXml` / `ObjectXmlReader`, никаких прямых регулярок.
4. `MetadataTreeProvider` остаётся тонким — он только делегирует в builder.

### Новая декорация узла (цвет / бейдж / суффикс контекста)

1. Если декорация зависит от состояния файла (поддержка, блокировка, «свой/заимствованный») — создать класс в `ui/tree/decorations/` по образцу `SupportDecorationProvider.ts`, реализовать `vscode.FileDecorationProvider`.
2. Зарегистрировать провайдер в `Container.wireTreeView`.
3. Для суффикса `contextValue` (чтобы команды появлялись в меню) — расширять формирование `contextValue` только в `TreeNode`, а признак пробрасывать через POJO-поле узла.

### Новый view / webview-панель

1. Класс в `ui/views/<Имя>ViewProvider.ts` — работа со своим `WebviewPanel`, без прямых XML/FS-вызовов.
2. Данные готовит отдельный сервис в `ui/views/.../` (как `MetadataXmlPropertiesService`).
3. Создание и команда «открыть панель» — через `Container`, не из команд напрямую.

### Новый сервис инфраструктуры

1. Класс в `infra/<подпапка>/<Имя>Service.ts` без `vscode`-импортов. Логгер принимать через параметр конструктора (`Logger`).
2. Если сервис нужен UI — создать его в `Container.bootstrap` и прокинуть как зависимость в потребителей.
3. Добавить тест в `src/test/suite/<имя>.test.ts` на пример из `example/`.

### Новый LSP-провайдер (completion / hover / signature / …)

1. Файл в `src/lsp/server/providers/<имя>.ts` — чистая логика провайдера, без зависимостей от `vscode` (сервер работает через `vscode-languageserver`).
2. Регистрация обработчика в `src/lsp/server/server.ts`.
3. Если требуются дополнительные поля в парсере BSL — расширять `BslParserService` и `BslContextService`, не провайдер.
4. Для режима `bsl-analyzer` дополнительно проверить, что `LspManager` не перехватывает эти возможности.

### Новая настройка расширения

1. Блок в `package.json → contributes.configuration.properties` с префиксом `v8vscedit.<область>.<ключ>`, обязательный `description` на русском, тип и default.
2. Чтение — только через `vscode.workspace.getConfiguration('v8vscedit')` и только в UI-слое или `Container`. В `domain/` и `infra/` настройки пробрасываются параметрами.
3. Если настройка влияет на поведение во время работы — подписаться на `workspace.onDidChangeConfiguration` в `Container`.

### Новый watcher / реакция на файловую систему

1. Регистрация `FileSystemWatcher` — только в `Container` или выделенном файле в `ui/support/` (как `SupportWatcher.ts`).
2. Обработчик делегирует в сервис (`SupportInfoService.invalidate`, `MetadataTreeProvider.refresh`), не выполняет работу напрямую.

### Новая внешняя интеграция (vrunner и прочие CLI)

1. Код запуска процесса — в `ui/commands/ext/` (после миграции `CommandRegistry`), пока — в `CommandRegistry.ts`.
2. Декодирование OEM/Win1251 вывода — через `iconv-lite`, централизованно.
3. Прогресс/отмена — через `vscode.window.withProgress`. Длительные операции не блокируют extension host.

### Новое виртуальное имя файла (`onec://`)

1. Шаблон URI собирать только в `ui/vfs/OnecUriBuilder.ts`. Ни один другой слой не должен строить `onec://…` руками.
2. Обработка чтения — в `OnecFileSystemProvider.readFile`; там же определяется, какой модуль возвращать по `uri.path`.
3. Русские человекочитаемые части пути (`CommonModules → Общие модули`) — только в словарях `OnecUriBuilder`.

### Новый тест

1. Файл в `src/test/suite/<имя>.test.ts`, Mocha (`suite` / `test`).
2. Использовать `example/cf` и `example/cfe/EVOLC` как фикстуры. Не создавать временные XML — правила тестирования опираются на реальные файлы.
3. Для тестов домена и `infra` — никаких mock-ов VS Code. Для UI — `@vscode/test-electron`.

---

## Запреты и анти-паттерны

1. **Никаких regex-парсеров XML вне `infra/xml/`.** Вся работа с XML идёт через `ConfigXmlReader`/`ObjectXmlReader`.
2. **Нет дублирующих реестров типов.** Если видишь `Record<string, string>` с `Catalog: 'Catalogs'` где-то вне `META_TYPES` — это баг архитектуры.
3. **Нет массивов команд в `package.json`, не покрытых `CommandRegistry`.** Все команды — в `ui/commands/`.
4. **`MetadataTreeProvider` не знает про типы метаданных.** Он делегирует в builder'ы.
5. **`MetadataNode`/`TreeNode` не хранит XML-логику.** Только отображение и ссылку на `TreeNodeModel`.
6. **Не импортировать `vscode` в `domain/` и `infra/`.** Проверка: `import.*vscode` в этих папках запрещён.
7. **Сервисы не создаются через `new` в командах/builder'ах.** Только через `Container`.
8. **Не использовать `any`.** Если неизбежно — комментарий `// any: <причина>`.

---

## Рабочий процесс

### Запуск и отладка

```bash
npm install
npm run watch        # webpack --mode development --watch
```

В VSCode/Cursor открыть корень проекта, нажать `F5` — откроется Extension Development Host с расширением. `Ctrl+Shift+F5` — перезапуск после изменения кода.

### Сборка

```bash
npm run compile      # tsc -p ./  (быстрая проверка типов)
npm run build        # webpack production
```

Перед любым коммитом: `npm run compile` должен проходить без ошибок.

### Тесты

```bash
npm test
```

Тесты лежат в `src/test/suite/`. Покрываются минимум:
- `ConfigLocator` — поиск конфигураций в `example/`.
- `ConfigXmlReader` — парсинг `Configuration.xml`.
- `ObjectXmlReader` — парсинг XML объектов (реквизиты, ТЧ, формы).
- `MetaPathResolver` — резолв XML и всех модулей.
- `PropertyBuilder` — корректность свойств для ключевых типов.

При добавлении нового типа метаданных **обязательно** добавлять тест `ObjectXmlReader` на реальный пример из `example/`.

### Отладка LSP

- Канал «BSL LSP Trace» (`traceOutputChannel`) показывает все JSON-RPC-сообщения.
- Канал «1С Редактор» — лог самого расширения.
- Канал «BSL Analyzer» (при `v8vscedit.lsp.mode=bsl-analyzer`) — stdout/stderr внешнего сервера.

---

## Фактическое состояние миграции на целевую архитектуру

Весь legacy-код удалён и перемещён в целевые папки. Раскладка `src/` полностью соответствует разделу «Целевая архитектура» выше. **Любой новый код пишется сразу в правильном слое.**

### Готово (весь проект)

- `domain/` — `MetaTypes.ts` (единый реестр), `ChildTag.ts`, `ModuleSlot.ts`, `MetaObject.ts`, `Configuration.ts`, `Ownership.ts`, `index.ts`.
- `infra/xml/` — `XmlUtils.ts`, `ConfigXmlReader.ts`, `ObjectXmlReader.ts`, `PropertySchema.ts`, `index.ts` (публичный API c функциями `parseConfigXml`, `parseObjectXml`, `resolveObjectXmlPath`).
- `infra/fs/` — `ConfigLocator.ts` (+ `findConfigurations`), `MetaPathResolver.ts` (+ 9 функций-обёрток для path), `ObjectLocation.ts`.
- `infra/support/` — `Logger.ts`, `SupportInfoService.ts`.
- `ui/tree/` — `TreeNode.ts` (бывший `MetadataNode.ts`), `MetadataTreeProvider.ts`, `MetadataGroups.ts`, `nodes/` (декларативные дескрипторы из `META_TYPES`), `presentation/`, `nodeBuilders/` (все builder-ы типов), `decorations/SupportDecorationProvider.ts`.
- `ui/views/` — `PropertiesViewProvider.ts`, `properties/` (`PropertyBuilder.ts`, `MetadataXmlPropertiesService.ts`, `PropertiesSelectionService.ts`, `_types.ts`).
- `ui/vfs/` — `OnecFileSystemProvider.ts`, `OnecUriBuilder.ts`.
- `ui/commands/` — `CommandRegistry.ts`.
- `ui/readonly/` — `BslReadonlyGuard.ts`.
- `ui/support/` — `SupportIndicatorCommands.ts`, `SupportWatcher.ts`.
- `lsp/` — `LspManager.ts`, `analyzer/`, `server/` (перенос `src/language-server/*`, webpack entry обновлён).
- `Container.ts` — композиционный корень; `extension.ts` — тонкий активатор.
- Legacy-папки `src/handlers/`, `src/nodes/`, `src/services/`, `src/views/`, `src/language-server/`, `src/language/` удалены.
- Дубликаты карты `typeToFolder` устранены — единственный источник `META_TYPES`.

### Известные технические долги

1. **`CommandRegistry.ts` — один файл**, пока не разбит на `open/`, `properties/`, `support/`, `ext/` как предусмотрено архитектурой. Разделение — при следующем изменении команд.
2. **`TreeNode.ts` не разделён на `TreeNodeModel` (POJO) + vscode-обёртку.** Сейчас один класс совмещает данные и отображение.
3. **`MetadataGroups.ts`** — отдельный файл, хотя данные группировки должны полностью жить в `META_TYPES.group/groupOrder`.
4. **Миграция XML-парсинга на `fast-xml-parser`.** Внутри `infra/xml/*` — регулярки. Замена должна пройти без изменения публичного API `ConfigXmlReader`/`ObjectXmlReader`.
5. **Редактирование XML.** Пока реализовано только чтение. После миграции на настоящий XML-парсер — добавить `ObjectXmlWriter` для панели свойств.
6. **Built-in LSP.** Сейчас в ограниченном состоянии; основной режим — `bsl-analyzer`.
7. **Сильная типизация дерева.** `TreeNodeModel` → discriminated union по `kind` вместо общего интерфейса.
8. **`ui/views/properties/_types.ts`** — пока re-export из `ui/tree/nodeBuilders/_types.ts`. Нужно окончательно отделить типы панели свойств от `ObjectHandler`.

---

## Инструкции агентам

- **Перед любым изменением читать `AGENTS.md` целиком.** Архитектурные правила выше — не рекомендации, а контракт.
- **Инкрементальность.** Менять не более одного слоя за коммит. Сломанный промежуточный коммит недопустим — `npm run compile` должен проходить после каждого коммита.
- **Документация.** Публичные типы и функции — JSDoc на русском, объясняющий *зачем*. Мёртвые классы удалять, не помечать «deprecated».
- **При затруднении** — проверить, не решается ли задача изменением таблицы `META_TYPES` или `PROPERTY_SCHEMAS`. В 90% случаев — да.
- **Никакой автоинициативы** при встрече с legacy-кодом, не связанным с текущей задачей. Но если правишь функцию, которая лежит не по архитектуре — перенести её в правильный слой.

### Правила работы с архитектурой

- **Новый код — только в целевых папках.** Создание новых файлов в `src/` на верхнем уровне запрещено (кроме `Container.ts` и `extension.ts`).
- Каталоги `src/handlers/`, `src/nodes/`, `src/services/`, `src/views/`, `src/language-server/` больше не существуют — не создавать их снова.
- При переименовании/переносе файла: перенести `git mv`, обновить импорты во всех потребителях, проверить `npm run compile`.
- Запрещено создавать параллельные версии сервисов («v2»). Либо миграция завершена, либо файл не трогается.

### Sanity-чек после изменений

1. `npm run compile` — 0 ошибок.
2. `npm run build` — webpack собирается без ошибок.
3. `rg "typeToFolder\s*:" src` — 0 результатов (карта папок только в `META_TYPES`).
4. `rg "import .* from 'vscode'" src/domain src/infra` — 0 результатов.
5. `rg "require\(|readFileSync" src/domain` — 0 результатов (`domain/` — чистый).
6. `Get-ChildItem src -Directory` — в списке не должно быть ни одной из папок: `handlers`, `services`, `views`, `language`, `language-server`, `nodes`. Корректные подкаталоги первого уровня: `domain`, `infra`, `lsp`, `ui`, `test` и файлы `Container.ts`, `extension.ts`.
