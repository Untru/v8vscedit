import { MetadataNode, NodeKind } from '../MetadataNode';
import { ObjectHandler } from './_types';
import { catalogHandler } from './catalog';
import { commonAttributeHandler } from './commonAttribute';
import { commonModuleHandler } from './commonModule';
import { documentHandler } from './document';
import { enumHandler } from './enum';
import { exchangePlanHandler } from './exchangePlan';
import { createMetaObjectHandler } from './metaObjectTree';
import { roleHandler } from './role';
import { sessionParameterHandler } from './sessionParameter';
import { structuredMetaChildHandler } from './structuredMetaChildHandler';
import { subsystemHandler } from './subsystem';

/** Типы из верхних групп навигатора без отдельного файла-обработчика — через createMetaObjectHandler */
const TOP_GROUP_OBJECT_KINDS: NodeKind[] = [
  'Constant',
  'FilterCriterion',
  'EventSubscription',
  'ScheduledJob',
  'Sequence',
  'DocumentJournal',
  'Report',
  'DataProcessor',
  'ChartOfCharacteristicTypes',
  'ChartOfAccounts',
  'ChartOfCalculationTypes',
  'InformationRegister',
  'AccumulationRegister',
  'AccountingRegister',
  'CalculationRegister',
  'BusinessProcess',
  'Task',
];

const metaObjectHandlersEntries = TOP_GROUP_OBJECT_KINDS.map(
  (kind) => [kind, createMetaObjectHandler(kind)] as const
);

/**
 * Реестр обработчиков по типу объекта из ChildObjects в Configuration.xml.
 * Справочник, документ, план обмена — отдельные модули (catalog, document, exchangePlan).
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
  ...metaObjectHandlersEntries,
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
