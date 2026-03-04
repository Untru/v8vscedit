import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/** Описание конфигурации / расширения */
export interface ConfigInfo {
  kind: 'cf' | 'cfe';
  name: string;
  synonym: string;
  version: string;
  namePrefix: string;
  /** Объекты по типам: тип → список имён */
  childObjects: Map<string, string[]>;
}

/** Дочерний элемент объекта метаданных */
export interface MetaChild {
  /** Тег XML: Attribute, TabularSection, Form, Command, Template, Dimension, Resource, EnumValue */
  tag: string;
  name: string;
  synonym: string;
  /** Для ТЧ — вложенные реквизиты */
  columns?: MetaChild[];
}

/** Описание объекта метаданных (Справочник, Документ и т.д.) */
export interface ObjectInfo {
  tag: string;
  name: string;
  synonym: string;
  children: MetaChild[];
}

// ---------------------------------------------------------------------------
// Парсинг Configuration.xml
// ---------------------------------------------------------------------------

/**
 * Читает Configuration.xml и возвращает описание конфигурации или расширения.
 * Использует упрощённый regex-парсинг, достаточный для предсказуемой структуры 1С XML.
 */
export function parseConfigXml(configXmlPath: string): ConfigInfo {
  const xml = fs.readFileSync(configXmlPath, 'utf-8');

  const kind: 'cf' | 'cfe' = xml.includes('<ConfigurationExtensionPurpose>') ? 'cfe' : 'cf';

  const name = extractSimpleTag(xml, 'Name') ?? '';
  const synonym = extractSynonym(xml);
  const version = extractSimpleTag(xml, 'Version') ?? '';
  const namePrefix = extractSimpleTag(xml, 'NamePrefix') ?? '';

  const childObjects = parseConfigChildObjects(xml);

  return { kind, name, synonym, version, namePrefix, childObjects };
}

/**
 * Парсит блок <ChildObjects> в Configuration.xml.
 * Формат: <ТипОбъекта>ИмяОбъекта</ТипОбъекта>
 */
function parseConfigChildObjects(xml: string): Map<string, string[]> {
  const result = new Map<string, string[]>();

  const childBlockMatch = xml.match(/<ChildObjects>([\s\S]*?)<\/ChildObjects>/);
  if (!childBlockMatch) {
    return result;
  }

  const block = childBlockMatch[1];
  // Ищем теги без атрибутов с текстовым содержимым (имена объектов)
  const re = /<([A-Za-z][A-Za-z0-9]*)>([^<]+)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const tag = m[1];
    const objName = m[2].trim();
    if (!result.has(tag)) {
      result.set(tag, []);
    }
    result.get(tag)!.push(objName);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Парсинг XML объекта метаданных
// ---------------------------------------------------------------------------

/**
 * Читает XML файл объекта метаданных (Документ, Справочник и т.д.)
 * и возвращает его структуру с дочерними элементами.
 */
export function parseObjectXml(xmlPath: string): ObjectInfo | null {
  let xml: string;
  try {
    xml = fs.readFileSync(xmlPath, 'utf-8');
  } catch {
    return null;
  }

  // Определяем тег корневого объекта (Document, Catalog, etc.)
  const rootTagMatch = xml.match(/<MetaDataObject[^>]*>\s*<([A-Za-z][A-Za-z0-9]*)\s/);
  if (!rootTagMatch) {
    return null;
  }
  const tag = rootTagMatch[1];
  const name = extractSimpleTag(xml, 'Name') ?? '';
  const synonym = extractSynonym(xml);
  const children = parseObjectChildObjects(xml);

  return { tag, name, synonym, children };
}

/**
 * Парсит блок <ChildObjects> объекта метаданных.
 * Извлекает Attribute, TabularSection, Form, Command, Template,
 * Dimension, Resource, EnumValue.
 */
function parseObjectChildObjects(xml: string): MetaChild[] {
  const result: MetaChild[] = [];

  const childBlockMatch = xml.match(/<ChildObjects>([\s\S]*?)<\/ChildObjects>\s*<\/(?:Document|Catalog|InformationRegister|AccumulationRegister|AccountingRegister|CalculationRegister|Enum|Report|DataProcessor|BusinessProcess|Task|ExchangePlan|ChartOfCharacteristicTypes|DocumentJournal|Constant|CommonModule|Role|CommonForm|CommonCommand|CommonPicture|StyleItem|DefinedType|FilterCriterion|Sequence|SessionParameter|FunctionalOption|FunctionalOptionsParameter|ScheduledJob|EventSubscription|HTTPService|WebService|WSReference|XDTOPackage|Interface|Subsystem|Language)[>]/);

  const block = childBlockMatch ? childBlockMatch[1] : extractLastChildObjects(xml);
  if (!block) {
    return result;
  }

  // Простые ссылочные теги: <Form>, <Command>, <Template>
  const simpleRe = /<(Form|Command|Template)>([^<]+)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = simpleRe.exec(block)) !== null) {
    result.push({ tag: m[1], name: m[2].trim(), synonym: '' });
  }

  // Составные элементы с uuid: Attribute, TabularSection, Dimension, Resource, EnumValue
  const complexTags = ['Attribute', 'TabularSection', 'Dimension', 'Resource', 'EnumValue'];
  for (const ctag of complexTags) {
    extractComplexChildren(block, ctag, result);
  }

  return result;
}

/**
 * Извлекает последний блок <ChildObjects> в документе
 * (для случаев когда regexp с lookahead не сработал).
 */
function extractLastChildObjects(xml: string): string | null {
  const all: string[] = [];
  const re = /<ChildObjects>([\s\S]*?)<\/ChildObjects>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    all.push(m[1]);
  }
  // Берём последний блок — он принадлежит корневому объекту
  return all.length > 0 ? all[all.length - 1] : null;
}

/**
 * Извлекает дочерние элементы с атрибутом uuid из блока XML.
 * Для TabularSection также рекурсивно извлекает вложенные Attribute.
 */
function extractComplexChildren(block: string, tag: string, result: MetaChild[]): void {
  const openRe = new RegExp(`<${tag}\\s+uuid="[^"]*">`, 'g');
  const closeTag = `</${tag}>`;

  let m: RegExpExecArray | null;
  while ((m = openRe.exec(block)) !== null) {
    const startContent = m.index + m[0].length;
    const endIdx = block.indexOf(closeTag, startContent);
    if (endIdx === -1) {
      continue;
    }
    const inner = block.substring(startContent, endIdx);
    const name = extractSimpleTag(inner, 'Name') ?? '';
    const synonym = extractSynonym(inner);

    if (tag === 'TabularSection') {
      const columns: MetaChild[] = [];
      extractComplexChildren(inner, 'Attribute', columns);
      result.push({ tag, name, synonym, columns });
    } else {
      result.push({ tag, name, synonym });
    }
  }
}

// ---------------------------------------------------------------------------
// Утилиты парсинга XML
// ---------------------------------------------------------------------------

/** Извлекает текст первого вхождения тега без атрибутов */
export function extractSimpleTag(xml: string, tagName: string): string | undefined {
  const re = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

/** Извлекает синоним из <Synonym><v8:item><v8:content>...</v8:content> */
export function extractSynonym(xml: string): string {
  const synMatch = xml.match(/<Synonym>([\s\S]*?)<\/Synonym>/);
  if (!synMatch) {
    return '';
  }
  const contentMatch = synMatch[1].match(/<v8:content>([^<]*)<\/v8:content>/);
  return contentMatch ? contentMatch[1].trim() : '';
}

// ---------------------------------------------------------------------------
// Вспомогательные функции для поиска XML-файла объекта
// ---------------------------------------------------------------------------

/**
 * Возвращает путь к XML-файлу объекта по каталогу конфигурации, типу и имени.
 * Например: Documents/ев_Заказ/ев_Заказ.xml или Documents/ев_Заказ.xml
 */
export function resolveObjectXmlPath(
  configRoot: string,
  objectType: string,
  objectName: string
): string | null {
  // Маппинг тегов ChildObjects на папки выгрузки
  const typeToFolder: Record<string, string> = {
    Catalog: 'Catalogs',
    Document: 'Documents',
    Enum: 'Enums',
    InformationRegister: 'InformationRegisters',
    AccumulationRegister: 'AccumulationRegisters',
    AccountingRegister: 'AccountingRegisters',
    CalculationRegister: 'CalculationRegisters',
    Report: 'Reports',
    DataProcessor: 'DataProcessors',
    BusinessProcess: 'BusinessProcesses',
    Task: 'Tasks',
    ExchangePlan: 'ExchangePlans',
    ChartOfCharacteristicTypes: 'ChartsOfCharacteristicTypes',
    ChartOfAccounts: 'ChartsOfAccounts',
    ChartOfCalculationTypes: 'ChartsOfCalculationTypes',
    DocumentJournal: 'DocumentJournals',
    Constant: 'Constants',
    CommonModule: 'CommonModules',
    Role: 'Roles',
    CommonForm: 'CommonForms',
    CommonCommand: 'CommonCommands',
    CommonPicture: 'CommonPictures',
    StyleItem: 'StyleItems',
    DefinedType: 'DefinedTypes',
    Subsystem: 'Subsystems',
    ScheduledJob: 'ScheduledJobs',
    EventSubscription: 'EventSubscriptions',
    HTTPService: 'HTTPServices',
    WebService: 'WebServices',
    Language: 'Languages',
    FilterCriterion: 'FilterCriteria',
    Sequence: 'Sequences',
    SessionParameter: 'SessionParameters',
    FunctionalOption: 'FunctionalOptions',
    FunctionalOptionsParameter: 'FunctionalOptionsParameters',
    XDTOPackage: 'XDTOPackages',
    Interface: 'Interfaces',
  };

  const folder = typeToFolder[objectType];
  if (!folder) {
    return null;
  }

  // Вариант 1: <Folder>/<Name>/<Name>.xml
  const deepPath = path.join(configRoot, folder, objectName, `${objectName}.xml`);
  if (fs.existsSync(deepPath)) {
    return deepPath;
  }

  // Вариант 2: <Folder>/<Name>.xml
  const flatPath = path.join(configRoot, folder, `${objectName}.xml`);
  if (fs.existsSync(flatPath)) {
    return flatPath;
  }

  return null;
}
