import * as fs from 'fs';
import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { uriToFsPath } from '../lspUtils';

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

/** Кэш объектов метаданных по пути корня конфигурации. */
const metaCache = new Map<string, CompletionItem[]>();

/**
 * Возвращает элементы автодополнения: &аннотации, #препроцессор,
 * ключевые слова, локальные символы, объекты метаданных.
 */
export async function provideCompletionItems(
  document: TextDocument,
  position: Position,
  triggerCharacter: string | undefined,
  parserService: BslParserService,
  workspaceRoots: string[],
): Promise<CompletionItem[]> {
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

  const items: CompletionItem[] = CORE_KEYWORDS.map((kw) => ({
    label: kw,
    kind: CompletionItemKind.Keyword,
  }));

  await parserService.ensureInit();
  items.push(...extractLocalSymbols(document, parserService));
  items.push(...await buildMetaItems(workspaceRoots));

  return items;
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

/** Сбрасывает кэш метаданных при изменении файлов конфигурации. */
export function invalidateMetaCache(uri: string): void {
  const fsPath = uriToFsPath(uri);
  for (const key of metaCache.keys()) {
    if (fsPath.startsWith(key)) {
      metaCache.delete(key);
    }
  }
}
