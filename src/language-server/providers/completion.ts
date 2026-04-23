import * as fs from 'fs';
import * as path from 'path';
import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { BslContextService } from '../BslContextService';
import { getDocumentContext } from '../BslDocumentContext';
import { uriToFsPath } from '../lspUtils';
import { GLOBAL_METHODS } from '../data/globalMethods';
import { parseConfigXml } from '../../ConfigParser';

const CORE_KEYWORDS = [
  'Если', 'If', 'Тогда', 'Then', 'ИначеЕсли', 'ElsIf', 'Иначе', 'Else',
  'КонецЕсли', 'EndIf', 'Для', 'For', 'Каждого', 'Each', 'Из', 'In',
  'По', 'To', 'Цикл', 'Do', 'КонецЦикла', 'EndDo', 'Пока', 'While',
  'Попытка', 'Try', 'Исключение', 'Except', 'КонецПопытки', 'EndTry',
  'Возврат', 'Return', 'Прервать', 'Break', 'Продолжить', 'Continue',
  'Перейти', 'Goto', 'Новый', 'New', 'Экспорт', 'Export',
  'Процедура', 'Procedure', 'КонецПроцедуры', 'EndProcedure',
  'Функция', 'Function', 'КонецФункции', 'EndFunction',
  'Перем', 'Var', 'Знач', 'Val',
  'Истина', 'True', 'Ложь', 'False', 'Неопределено', 'Undefined', 'Null',
];

const ANNOTATIONS = [
  'НаКлиенте', 'AtClient',
  'НаСервере', 'AtServer',
  'НаСервереБезКонтекста', 'AtServerNoContext',
  'НаКлиентеНаСервереБезКонтекста', 'AtClientAtServerNoContext',
  'НаКлиентеНаСервере', 'AtClientAtServer',
  'Перед', 'Before',
  'После', 'After',
  'Вместо', 'Instead',
  'ИзменениеИКонтроль', 'ChangeAndValidate',
];

const PREPROCESSOR = [
  '#Область', '#Region',
  '#КонецОбласти', '#EndRegion',
  '#Если', '#If',
  '#ИначеЕсли', '#ElsIf',
  '#Иначе', '#Else',
  '#КонецЕсли', '#EndIf',
  '#Вставка', '#Insert',
  '#КонецВставки', '#EndInsert',
  '#Удаление', '#Delete',
  '#КонецУдаления', '#EndDelete',
];

const META_PREFIXES: Record<string, string> = {
  Catalog: 'Справочники',
  Document: 'Документы',
  Enum: 'Перечисления',
  InformationRegister: 'РегистрыСведений',
  AccumulationRegister: 'РегистрыНакопления',
  AccountingRegister: 'РегистрыБухгалтерии',
  CalculationRegister: 'РегистрыРасчёта',
  Report: 'Отчёты',
  DataProcessor: 'Обработки',
  BusinessProcess: 'БизнесПроцессы',
  Task: 'Задачи',
  ExchangePlan: 'ПланыОбмена',
  ChartOfCharacteristicTypes: 'ПланыВидовХарактеристик',
  ChartOfAccounts: 'ПланыСчетов',
  ChartOfCalculationTypes: 'ПланыВидовРасчётов',
  DocumentJournal: 'ЖурналыДокументов',
  Constant: 'Константы',
  CommonModule: 'ОбщиеМодули',
};

/** Обратный маппинг: русское имя → тип объекта */
const RU_PREFIX_TO_TYPE: Record<string, string> = {};
for (const [type, ru] of Object.entries(META_PREFIXES)) {
  RU_PREFIX_TO_TYPE[ru.toLowerCase()] = type;
}
/** Обратный маппинг: английское имя (pluralized) → тип объекта */
const EN_PREFIX_TO_TYPE: Record<string, string> = {};
for (const type of Object.keys(META_PREFIXES)) {
  EN_PREFIX_TO_TYPE[(type + 's').toLowerCase()] = type;
}

function resolveObjectType(prefix: string): string | null {
  return RU_PREFIX_TO_TYPE[prefix.toLowerCase()] ?? EN_PREFIX_TO_TYPE[prefix.toLowerCase()] ?? null;
}

/** Стандартные методы менеджеров по типу объекта */
const MANAGER_METHODS: Record<string, { name: string; detail: string; isFunction: boolean }[]> = {
  Catalog: [
    { name: 'СоздатьЭлемент', detail: 'Создать новый элемент справочника', isFunction: true },
    { name: 'СоздатьГруппу', detail: 'Создать новую группу справочника', isFunction: true },
    { name: 'НайтиПоКоду', detail: 'Найти элемент по коду', isFunction: true },
    { name: 'НайтиПоНаименованию', detail: 'Найти элемент по наименованию', isFunction: true },
    { name: 'НайтиПоРеквизиту', detail: 'Найти элемент по значению реквизита', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку элементов', isFunction: true },
    { name: 'ВыбратьИерархически', detail: 'Получить иерархическую выборку', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
    { name: 'ПолучитьДанныеВыбора', detail: 'Данные для поля выбора', isFunction: true },
    { name: 'ПолучитьСсылку', detail: 'Получить ссылку по UUID', isFunction: true },
  ],
  Document: [
    { name: 'СоздатьДокумент', detail: 'Создать новый документ', isFunction: true },
    { name: 'НайтиПоНомеру', detail: 'Найти документ по номеру', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку документов', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
    { name: 'ПолучитьДанныеВыбора', detail: 'Данные для поля выбора', isFunction: true },
    { name: 'ПолучитьСсылку', detail: 'Получить ссылку по UUID', isFunction: true },
  ],
  InformationRegister: [
    { name: 'СоздатьМенеджерЗаписи', detail: 'Создать менеджер записи', isFunction: true },
    { name: 'СоздатьНаборЗаписей', detail: 'Создать набор записей', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку записей', isFunction: true },
    { name: 'ПолучитьПоследнее', detail: 'Получить последнее значение ресурса', isFunction: true },
    { name: 'ПолучитьПервое', detail: 'Получить первое значение', isFunction: true },
    { name: 'Получить', detail: 'Получить значение ресурса', isFunction: true },
    { name: 'СрезПоследних', detail: 'Получить срез последних', isFunction: true },
    { name: 'СрезПервых', detail: 'Получить срез первых', isFunction: true },
  ],
  AccumulationRegister: [
    { name: 'СоздатьНаборЗаписей', detail: 'Создать набор записей', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку записей', isFunction: true },
    { name: 'Остатки', detail: 'Получить остатки', isFunction: true },
    { name: 'Обороты', detail: 'Получить обороты', isFunction: true },
    { name: 'ОстаткиИОбороты', detail: 'Получить остатки и обороты', isFunction: true },
  ],
  Enum: [
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку перечисления', isFunction: true },
  ],
  Report: [
    { name: 'Создать', detail: 'Создать экземпляр отчёта', isFunction: true },
  ],
  DataProcessor: [
    { name: 'Создать', detail: 'Создать экземпляр обработки', isFunction: true },
  ],
  ChartOfCharacteristicTypes: [
    { name: 'СоздатьЭлемент', detail: 'Создать новый элемент', isFunction: true },
    { name: 'СоздатьГруппу', detail: 'Создать новую группу', isFunction: true },
    { name: 'НайтиПоКоду', detail: 'Найти элемент по коду', isFunction: true },
    { name: 'НайтиПоНаименованию', detail: 'Найти элемент по наименованию', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
    { name: 'ПолучитьДанныеВыбора', detail: 'Данные для поля выбора', isFunction: true },
  ],
  AccountingRegister: [
    { name: 'СоздатьНаборЗаписей', detail: 'Создать набор записей', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку записей', isFunction: true },
  ],
  CalculationRegister: [
    { name: 'СоздатьНаборЗаписей', detail: 'Создать набор записей', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку записей', isFunction: true },
  ],
  ExchangePlan: [
    { name: 'СоздатьЭлемент', detail: 'Создать новый узел плана обмена', isFunction: true },
    { name: 'НайтиПоКоду', detail: 'Найти узел по коду', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
    { name: 'ЭтотУзел', detail: 'Получить ссылку на этот узел', isFunction: true },
  ],
  BusinessProcess: [
    { name: 'СоздатьБизнесПроцесс', detail: 'Создать новый бизнес-процесс', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
  ],
  Task: [
    { name: 'СоздатьЗадачу', detail: 'Создать новую задачу', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
  ],
  ChartOfAccounts: [
    { name: 'НайтиПоКоду', detail: 'Найти счёт по коду', isFunction: true },
    { name: 'Выбрать', detail: 'Получить выборку', isFunction: true },
    { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
  ],
  Constant: [
    { name: 'Получить', detail: 'Получить значение константы', isFunction: true },
    { name: 'Установить', detail: 'Установить значение константы', isFunction: false },
  ],
};

/** Дефолтные методы менеджера (общие для типов без специальных методов) */
const DEFAULT_MANAGER_METHODS = [
  { name: 'ПустаяСсылка', detail: 'Получить пустую ссылку', isFunction: true },
  { name: 'ПолучитьДанныеВыбора', detail: 'Данные для поля выбора', isFunction: true },
];

/** Кэш объектов метаданных по пути корня конфигурации. */
const metaCache = new Map<string, CompletionItem[]>();

/**
 * Возвращает элементы автодополнения: &аннотации, #препроцессор,
 * ключевые слова, локальные символы, общие модули и объекты метаданных.
 */
export async function provideCompletionItems(
  document: TextDocument,
  position: Position,
  triggerCharacter: string | undefined,
  parserService: BslParserService,
  workspaceRoots: string[],
  contextService?: BslContextService,
): Promise<CompletionItem[]> {
  if (contextService) {
    await contextService.ensureInitialized();
  }

  const lines = document.getText().split('\n');
  const linePrefix = (lines[position.line] ?? '').slice(0, position.character);

  if (triggerCharacter === '&' || /&\w*$/.test(linePrefix)) {
    return ANNOTATIONS.map((ann) => ({
      label: ann,
      kind: CompletionItemKind.Keyword,
      insertText: ann,
    }));
  }

  if (triggerCharacter === '#' || /^\s*#\w*$/.test(linePrefix)) {
    return PREPROCESSOR.map((kw) => ({
      label: kw,
      kind: CompletionItemKind.Keyword,
      insertText: kw.startsWith('#') ? kw.slice(1) : kw,
    }));
  }

  // Триггер '.' — ищем имя модуля перед точкой
  if (triggerCharacter === '.' || /[\wа-яА-ЯёЁ_]+\.$/.test(linePrefix)) {
    // 1. Общие модули: МодульИмя.{cursor}
    if (contextService) {
      const dotItems = await buildDotCompletions(linePrefix, contextService);
      if (dotItems.length > 0) {
        return dotItems;
      }
    }

    // 2. Цепочка: Справочники.Номенклатура.{cursor} → методы менеджера
    const chainMatch = /([\wа-яА-ЯёЁ_]+)\.([\wа-яА-ЯёЁ_]+)\.$/u.exec(linePrefix);
    if (chainMatch) {
      const prefix = chainMatch[1];
      const objectName = chainMatch[2];
      const managerItems = buildManagerMethodItems(prefix, objectName);
      if (managerItems.length > 0) {
        return managerItems;
      }
    }

    // 3. Одиночная точка: Справочники.{cursor} → список объектов этого типа
    const singleDotMatch = /([\wа-яА-ЯёЁ_]+)\.$/u.exec(linePrefix);
    if (singleDotMatch) {
      const prefix = singleDotMatch[1];
      const typeItems = buildTypedObjectItems(prefix, workspaceRoots);
      if (typeItems.length > 0) {
        return typeItems;
      }
    }

    // 4. Fallback — все объекты метаданных (Справочники.Xxx)
    return buildMetaItems(workspaceRoots);
  }

  const items: CompletionItem[] = CORE_KEYWORDS.map((kw) => ({
    label: kw,
    kind: CompletionItemKind.Keyword,
  }));

  for (const m of GLOBAL_METHODS) {
    items.push({
      label: m.nameRu,
      kind: m.isFunction ? CompletionItemKind.Function : CompletionItemKind.Method,
      detail: m.description,
      documentation: m.category,
    });
    items.push({
      label: m.nameEn,
      kind: m.isFunction ? CompletionItemKind.Function : CompletionItemKind.Method,
      detail: m.description,
      documentation: m.category,
    });
  }

  await parserService.ensureInit();
  items.push(...extractLocalSymbols(document, parserService));
  items.push(...await buildMetaItems(workspaceRoots));

  // Добавляем общие модули с учётом контекста документа и директивы курсора
  if (contextService) {
    items.push(...await buildCommonModuleItems(document, position, contextService, parserService));
  }

  return items;
}

/**
 * Строит подсказки после '.' — экспортные методы общего модуля.
 * Парсит слово перед точкой: ИмяМодуля.{cursor}
 */
async function buildDotCompletions(
  linePrefix: string,
  contextService: BslContextService,
): Promise<CompletionItem[]> {
  // Ищем слово непосредственно перед точкой
  const match = /([а-яА-ЯёЁa-zA-Z_][\wа-яА-ЯёЁ_]*)\.$/u.exec(linePrefix);
  if (!match) {
    return [];
  }
  const moduleName = match[1];

  const info = contextService.getModuleByName(moduleName);
  if (!info) {
    return [];
  }

  const methods = await contextService.getExportMethods(info.name);
  if (methods.length === 0) {
    return [];
  }

  return methods.map((m) => ({
    label: m.name,
    kind: m.isFunction ? CompletionItemKind.Function : CompletionItemKind.Method,
    detail: `${m.isFunction ? 'Функция' : 'Процедура'} (${m.params})`,
    documentation: `${info.name}.${m.name}(${m.params})`,
  }));
}

/**
 * Строит элементы автодополнения для общих модулей с учётом контекста:
 * - Не-глобальные доступные модули → CompletionItemKind.Module (имя модуля)
 * - Методы глобальных доступных модулей → CompletionItemKind.Function (без префикса)
 * Контекст определяется по свойствам модуля + директиве компиляции текущей функции.
 */
async function buildCommonModuleItems(
  document: TextDocument,
  position: Position,
  contextService: BslContextService,
  parserService: BslParserService,
): Promise<CompletionItem[]> {
  const ctx = await getDocumentContext(document.uri, document.getText(), position, contextService, parserService);
  const items: CompletionItem[] = [];

  for (const mod of contextService.getModules()) {
    if (!isModuleAvailableInContext(mod, ctx)) {
      continue;
    }

    if (mod.global) {
      // Глобальный модуль: предлагаем экспортные методы без префикса
      const methods = await contextService.getExportMethods(mod.name);
      for (const method of methods) {
        items.push({
          label: method.name,
          kind: method.isFunction ? CompletionItemKind.Function : CompletionItemKind.Method,
          detail: `${mod.name} — ${method.isFunction ? 'Функция' : 'Процедура'} (${method.params})`,
          documentation: `Глобальный модуль: ${mod.synonymRu || mod.name}`,
        });
      }
    } else {
      // Не-глобальный: предлагаем имя модуля
      items.push({
        label: mod.name,
        kind: CompletionItemKind.Module,
        detail: mod.synonymRu || mod.name,
        documentation: buildModuleDocumentation(mod),
      });
    }
  }

  return items;
}

/**
 * Проверяет, доступен ли общий модуль в контексте текущего документа.
 *
 * Правила доступности:
 * - Серверный контекст: Server=true или ServerCall=true (ServerCall исполняется на сервере)
 * - Управляемый клиент: ClientManagedApplication=true или ServerCall=true (вызов с клиента)
 *
 * ClientOrdinaryApplication НЕ используется — это отдельный несовместимый контекст
 * обычного (толстого) клиента, который в современной разработке не смешивается
 * с управляемым приложением.
 */
function isModuleAvailableInContext(
  mod: { server: boolean; clientManagedApplication: boolean; serverCall: boolean; configKind: 'cf' | 'cfe'; configRoot: string },
  ctx: { isServer: boolean; isClient: boolean; configKind: 'cf' | 'cfe' | null; configRoot: string | null },
): boolean {
  // Общие модули расширений не должны попадать в подсказки файлов основной конфигурации.
  if (ctx.configKind === 'cf' && mod.configKind === 'cfe') {
    return false;
  }
  // В файлах расширений показываем только:
  // - модули основной конфигурации (cf)
  // - модули того же расширения (cfe с совпадающим корнем конфигурации)
  if (ctx.configKind === 'cfe' && mod.configKind === 'cfe') {
    if (!ctx.configRoot || ctx.configRoot !== mod.configRoot) {
      return false;
    }
  }
  // Сервер видит: серверные модули и ServerCall-модули (они тоже исполняются на сервере)
  if (ctx.isServer && (mod.server || mod.serverCall)) {
    return true;
  }
  // Управляемый клиент видит: клиентские модули и ServerCall-модули (вызываются с клиента)
  if (ctx.isClient && (mod.clientManagedApplication || mod.serverCall)) {
    return true;
  }
  return false;
}

/** Формирует строку документации для модуля в подсказке. */
function buildModuleDocumentation(mod: {
  server: boolean;
  clientManagedApplication: boolean;
  serverCall: boolean;
  privileged: boolean;
}): string {
  const flags: string[] = [];
  if (mod.server) {
    flags.push('Сервер');
  }
  if (mod.clientManagedApplication) {
    flags.push('Клиент');
  }
  if (mod.serverCall) {
    flags.push('ВызовСервера');
  }
  if (mod.privileged) {
    flags.push('Привилегированный');
  }
  return flags.join(', ');
}

function extractLocalSymbols(document: TextDocument, parserService: BslParserService): CompletionItem[] {
  const items: CompletionItem[] = [];
  let root: Node;
  try {
    root = parserService.parse(document.getText(), document.uri, document.version).rootNode;
  } catch {
    return items;
  }

  const visit = (node: Node): void => {
    if (node.type === 'procedure_definition' || node.type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const params = buildParamsString(node);
        items.push({
          label: nameNode.text,
          kind: CompletionItemKind.Function,
          detail: `${node.type === 'procedure_definition' ? 'Процедура' : 'Функция'} (${params})`,
        });
      }
    } else if (node.type === 'var_definition' || node.type === 'var_statement') {
      for (const child of node.namedChildren) {
        if (child?.type === 'var_name') {
          items.push({ label: child.text, kind: CompletionItemKind.Variable });
        }
      }
    }
    for (const child of node.namedChildren) {
      if (child) {
        visit(child);
      }
    }
  };

  visit(root);
  return items;
}

function buildParamsString(node: Node): string {
  const paramsNode = node.childForFieldName('parameters');
  if (!paramsNode) {
    return '';
  }
  const parts: string[] = [];
  for (const param of paramsNode.namedChildren) {
    if (!param || param.type !== 'parameter') {
      continue;
    }
    const nameNode = param.childForFieldName('name');
    if (nameNode) {
      parts.push(nameNode.text);
    }
  }
  return parts.join(', ');
}

async function buildMetaItems(workspaceRoots: string[]): Promise<CompletionItem[]> {
  const items: CompletionItem[] = [];
  for (const root of workspaceRoots) {
    if (!metaCache.has(root)) {
      metaCache.set(root, await parseConfigMeta(root));
    }
    const cached = metaCache.get(root);
    if (cached) {
      items.push(...cached);
    }
  }
  return items;
}

async function parseConfigMeta(rootPath: string): Promise<CompletionItem[]> {
  const configPath = `${rootPath}/Configuration.xml`;
  let text: string;
  try {
    text = await fs.promises.readFile(configPath, 'utf-8');
  } catch {
    return [];
  }

  const items: CompletionItem[] = [];
  for (const [typeName, ruPrefix] of Object.entries(META_PREFIXES)) {
    const enPrefix = typeName + 's';
    const re = new RegExp(`<${typeName}>(.*?)<\\/${typeName}>`, 'gs');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const name = match[1].trim();
      if (!name || name.includes('<')) {
        continue;
      }
      items.push({ label: `${ruPrefix}.${name}`, kind: CompletionItemKind.Class, detail: typeName });
      items.push({ label: `${enPrefix}.${name}`, kind: CompletionItemKind.Class, detail: typeName });
    }
  }

  return items;
}

/**
 * Строит элементы автодополнения для методов менеджера объекта.
 * Вызывается при цепочке вида: Справочники.Номенклатура.{cursor}
 */
function buildManagerMethodItems(
  prefix: string,
  objectName: string,
): CompletionItem[] {
  const objectType = resolveObjectType(prefix);
  if (!objectType) {
    return [];
  }

  const methods = MANAGER_METHODS[objectType] ?? DEFAULT_MANAGER_METHODS;

  return methods.map((m) => ({
    label: m.name,
    kind: m.isFunction ? CompletionItemKind.Function : CompletionItemKind.Method,
    detail: m.detail,
    documentation: `${prefix}.${objectName}.${m.name}()`,
  }));
}

/**
 * Строит элементы автодополнения для списка объектов конкретного типа.
 * Вызывается при: Справочники.{cursor} → список справочников из Configuration.xml
 */
function buildTypedObjectItems(prefix: string, workspaceRoots: string[]): CompletionItem[] {
  const objectType = resolveObjectType(prefix);
  if (!objectType) {
    return [];
  }

  const items: CompletionItem[] = [];
  for (const root of workspaceRoots) {
    const configPath = path.join(root, 'Configuration.xml');
    let configInfo;
    try {
      configInfo = parseConfigXml(configPath);
    } catch {
      continue;
    }

    const names = configInfo.childObjects.get(objectType) ?? [];
    for (const name of names) {
      items.push({
        label: name,
        kind: CompletionItemKind.Class,
        detail: `${prefix}.${name}`,
      });
    }
  }
  return items;
}

/** Сбрасывает кэш метаданных при изменении файлов конфигурации. */
export function invalidateMetaCache(uri: string): void {
  const fsPath = uriToFsPath(uri);
  for (const key of metaCache.keys()) {
    if (fsPath.startsWith(key)) {
      metaCache.delete(key);
    }
  }
}
