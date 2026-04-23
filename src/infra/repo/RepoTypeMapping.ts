import { MetaKind } from '../../domain/MetaTypes';

/**
 * Маппинг MetaKind → имя типа 1С для параметра -Objects команды DESIGNER.
 * Формат: «ТипОбъекта.ИмяОбъекта», например «Справочник.Номенклатура».
 * Включены только объекты верхнего уровня, которые можно захватить в хранилище.
 */
export const NODE_KIND_TO_1C_TYPE: Partial<Record<MetaKind, string>> = {
  Subsystem: 'Подсистема',
  CommonModule: 'ОбщийМодуль',
  Role: 'Роль',
  CommonForm: 'ОбщаяФорма',
  CommonCommand: 'ОбщаяКоманда',
  CommandGroup: 'ГруппаКоманд',
  CommonPicture: 'ОбщаяКартинка',
  CommonTemplate: 'ОбщийМакет',
  XDTOPackage: 'ПакетXDTO',
  StyleItem: 'ЭлементСтиля',
  DefinedType: 'ОпределяемыйТип',
  Constant: 'Константа',
  Catalog: 'Справочник',
  Document: 'Документ',
  DocumentNumerator: 'НумераторДокументов',
  Enum: 'Перечисление',
  InformationRegister: 'РегистрСведений',
  AccumulationRegister: 'РегистрНакопления',
  AccountingRegister: 'РегистрБухгалтерии',
  CalculationRegister: 'РегистрРасчета',
  Report: 'Отчет',
  DataProcessor: 'Обработка',
  BusinessProcess: 'БизнесПроцесс',
  Task: 'Задача',
  ExchangePlan: 'ПланОбмена',
  ChartOfCharacteristicTypes: 'ПланВидовХарактеристик',
  ChartOfAccounts: 'ПланСчетов',
  ChartOfCalculationTypes: 'ПланВидовРасчета',
  DocumentJournal: 'ЖурналДокументов',
  ScheduledJob: 'РегламентноеЗадание',
  EventSubscription: 'ПодпискаНаСобытие',
  HTTPService: 'HTTPСервис',
  WebService: 'WebСервис',
  FilterCriterion: 'КритерийОтбора',
  Sequence: 'Последовательность',
  SessionParameter: 'ПараметрСеанса',
  CommonAttribute: 'ОбщийРеквизит',
  FunctionalOption: 'ФункциональнаяОпция',
  FunctionalOptionsParameter: 'ПараметрФункциональныхОпций',
  SettingsStorage: 'ХранилищеНастроек',
  Style: 'Стиль',
  WSReference: 'WSСсылка',
  ExternalDataSource: 'ВнешнийИсточникДанных',
  IntegrationService: 'СервисИнтеграции',
  Language: 'Язык',
};

/**
 * Обратный маппинг: русское имя типа 1С → MetaKind.
 * Используется при парсинге отчёта ConfigurationRepositoryReport.
 */
export const TYPE_1C_TO_NODE_KIND: Map<string, MetaKind> = new Map(
  Object.entries(NODE_KIND_TO_1C_TYPE).map(([kind, type]) => [type, kind as MetaKind])
);
