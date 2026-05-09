import type { MetaKind } from './MetaTypes';

export interface StandardAttributeDef {
  name: string;
  presentation: string;
  /** Значение по умолчанию для отбора в список ввода по строке, если XML ещё не материализован. */
  defaultIndexing?: 'DontIndex' | 'Index' | 'IndexWithAdditionalOrder';
}

const STANDARD_ATTRIBUTE_PRESENTATIONS: Readonly<Record<string, string>> = {
  Ref: 'Ссылка',
  DeletionMark: 'Пометка удаления',
  Owner: 'Владелец',
  IsFolder: 'Это группа',
  Parent: 'Родитель',
  Code: 'Код',
  Description: 'Наименование',
  Predefined: 'Предопределенный',
  PredefinedDataName: 'Имя предопределенных данных',
  Posted: 'Проведен',
  Date: 'Дата',
  Number: 'Номер',
  Period: 'Период',
  Recorder: 'Регистратор',
  LineNumber: 'Номер строки',
  Active: 'Активность',
  RecordType: 'Вид движения',
  Account: 'Счет',
  Started: 'Стартован',
  Completed: 'Завершен',
  HeadTask: 'Головная задача',
  BusinessProcess: 'Бизнес-процесс',
  Executed: 'Выполнена',
  RoutePoint: 'Точка маршрута',
  Order: 'Порядок',
  Type: 'Тип',
  ExchangeDate: 'Дата обмена',
  ThisNode: 'Этот узел',
  ReceivedNo: 'Номер принятого сообщения',
  SentNo: 'Номер отправленного сообщения',
  OffBalance: 'Забалансовый',
  ActionPeriodIsBasic: 'Период действия является базовым',
};

const STANDARD_ATTRIBUTES_BY_KIND: Readonly<Partial<Record<MetaKind, readonly string[]>>> = {
  Catalog: ['PredefinedDataName', 'Predefined', 'Ref', 'DeletionMark', 'IsFolder', 'Owner', 'Parent', 'Description', 'Code'],
  Document: ['Posted', 'Ref', 'DeletionMark', 'Date', 'Number'],
  BusinessProcess: ['Started', 'HeadTask', 'Completed', 'Ref', 'DeletionMark', 'Date', 'Number'],
  Task: ['Executed', 'Description', 'RoutePoint', 'BusinessProcess', 'Ref', 'DeletionMark', 'Date', 'Number'],
  InformationRegister: ['Active', 'LineNumber', 'Recorder', 'Period'],
  AccumulationRegister: ['RecordType', 'Active', 'LineNumber', 'Recorder', 'Period'],
  AccountingRegister: ['Account', 'Active', 'LineNumber', 'Recorder', 'Period'],
  CalculationRegister: ['Active', 'LineNumber', 'Recorder', 'Period'],
  ExchangePlan: ['ExchangeDate', 'ThisNode', 'ReceivedNo', 'SentNo', 'Ref', 'DeletionMark', 'Description', 'Code'],
  ChartOfCharacteristicTypes: ['Ref', 'DeletionMark', 'Description', 'Code'],
  ChartOfAccounts: ['PredefinedDataName', 'Order', 'OffBalance', 'Type', 'Description', 'Code', 'Parent', 'Predefined', 'DeletionMark', 'Ref'],
  ChartOfCalculationTypes: ['PredefinedDataName', 'Predefined', 'Ref', 'DeletionMark', 'ActionPeriodIsBasic', 'Description', 'Code'],
  DocumentJournal: ['Type', 'Ref', 'Date', 'Posted', 'DeletionMark', 'Number'],
  Enum: ['Order', 'Ref'],
};

const DEFAULT_INDEXING_BY_KIND: Readonly<Partial<Record<MetaKind, Readonly<Record<string, StandardAttributeDef['defaultIndexing']>>>>> = {
  Catalog: {
    Code: 'Index',
    Description: 'Index',
  },
  Document: {
    Number: 'Index',
  },
  BusinessProcess: {
    Number: 'Index',
  },
  Task: {
    Description: 'Index',
    Number: 'Index',
  },
  ExchangePlan: {
    Code: 'Index',
    Description: 'Index',
  },
  ChartOfCharacteristicTypes: {
    Code: 'Index',
    Description: 'Index',
  },
  ChartOfAccounts: {
    Code: 'Index',
    Description: 'Index',
  },
  ChartOfCalculationTypes: {
    Code: 'Index',
    Description: 'Index',
  },
  DocumentJournal: {
    Number: 'Index',
  },
};

export function getStandardAttributePresentation(name: string): string {
  return STANDARD_ATTRIBUTE_PRESENTATIONS[name] ?? name;
}

export function getStandardAttributesForKind(kind: string): StandardAttributeDef[] {
  const names = STANDARD_ATTRIBUTES_BY_KIND[kind as MetaKind] ?? [];
  const defaults = DEFAULT_INDEXING_BY_KIND[kind as MetaKind] ?? {};
  return names.map((name) => ({
    name,
    presentation: getStandardAttributePresentation(name),
    defaultIndexing: defaults[name],
  }));
}

export function getDefaultStandardAttributeIndexing(kind: string, name: string): StandardAttributeDef['defaultIndexing'] {
  return DEFAULT_INDEXING_BY_KIND[kind as MetaKind]?.[name];
}
