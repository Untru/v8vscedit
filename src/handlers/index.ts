import { MetadataNode, NodeKind } from '../MetadataNode';
import { ObjectHandler } from './_types';
import { accountingRegisterHandler } from './accountingRegister';
import { accumulationRegisterHandler } from './accumulationRegister';
import { businessProcessHandler } from './businessProcess';
import { calculationRegisterHandler } from './calculationRegister';
import { catalogHandler } from './catalog';
import { chartOfAccountsHandler } from './chartOfAccounts';
import { chartOfCalculationTypesHandler } from './chartOfCalculationTypes';
import { chartOfCharacteristicTypesHandler } from './chartOfCharacteristicTypes';
import { commonAttributeHandler } from './commonAttribute';
import { commonModuleHandler } from './commonModule';
import { constantHandler } from './constant';
import { dataProcessorHandler } from './dataProcessor';
import { documentHandler } from './document';
import { documentJournalHandler } from './documentJournal';
import { enumHandler } from './enum';
import { eventSubscriptionHandler } from './eventSubscription';
import { exchangePlanHandler } from './exchangePlan';
import { filterCriterionHandler } from './filterCriterion';
import { informationRegisterHandler } from './informationRegister';
import { reportHandler } from './report';
import { roleHandler } from './role';
import { scheduledJobHandler } from './scheduledJob';
import { sequenceHandler } from './sequence';
import { sessionParameterHandler } from './sessionParameter';
import { structuredMetaChildHandler } from './structuredMetaChildHandler';
import { subsystemHandler } from './subsystem';
import { taskHandler } from './task';

/**
 * Реестр обработчиков по типу объекта из ChildObjects в Configuration.xml.
 * Каждый тип из верхних групп навигатора — отдельный модуль в этой папке.
 */
const HANDLER_REGISTRY = new Map<string, ObjectHandler>([
  ['Subsystem', subsystemHandler],
  ['CommonModule', commonModuleHandler],
  ['SessionParameter', sessionParameterHandler],
  ['Role', roleHandler],
  ['CommonAttribute', commonAttributeHandler],
  ['Catalog', catalogHandler],
  ['Document', documentHandler],
  ['Enum', enumHandler],
  ['ExchangePlan', exchangePlanHandler],
  ['Constant', constantHandler],
  ['FilterCriterion', filterCriterionHandler],
  ['EventSubscription', eventSubscriptionHandler],
  ['ScheduledJob', scheduledJobHandler],
  ['Sequence', sequenceHandler],
  ['DocumentJournal', documentJournalHandler],
  ['Report', reportHandler],
  ['DataProcessor', dataProcessorHandler],
  ['ChartOfCharacteristicTypes', chartOfCharacteristicTypesHandler],
  ['ChartOfAccounts', chartOfAccountsHandler],
  ['ChartOfCalculationTypes', chartOfCalculationTypesHandler],
  ['InformationRegister', informationRegisterHandler],
  ['AccumulationRegister', accumulationRegisterHandler],
  ['AccountingRegister', accountingRegisterHandler],
  ['CalculationRegister', calculationRegisterHandler],
  ['BusinessProcess', businessProcessHandler],
  ['Task', taskHandler],
]);

/** Возвращает обработчик для указанного типа объекта или undefined */
export function getObjectHandler(objectType: string): ObjectHandler | undefined {
  return HANDLER_REGISTRY.get(objectType);
}

/** Возвращает обработчик для типа узла дерева, если он зарегистрирован */
export function getNodeHandler(nodeKind: NodeKind): ObjectHandler | undefined {
  return HANDLER_REGISTRY.get(nodeKind);
}

/** Возвращает обработчик для конкретного узла дерева, если он зарегистрирован */
export function getHandlerForNode(node: MetadataNode): ObjectHandler | undefined {
  if (node.metaContext && structuredMetaChildHandler.canShowProperties?.(node)) {
    return structuredMetaChildHandler;
  }
  return getNodeHandler(node.nodeKind);
}
