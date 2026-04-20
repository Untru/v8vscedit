import { MetadataNode, NodeKind } from '../MetadataNode';
import { ObjectHandler } from './_types';
import { commonAttributeHandler } from './commonAttribute';
import { commonModuleHandler } from './commonModule';
import { createMetaObjectHandler } from './metaObjectTree';
import { roleHandler } from './role';
import { sessionParameterHandler } from './sessionParameter';
import { structuredMetaChildHandler } from './structuredMetaChildHandler';
import { subsystemHandler } from './subsystem';

/** Типы из верхних групп навигатора (не «Общие») — дерево через metaObjectTree */
const TOP_GROUP_OBJECT_KINDS: NodeKind[] = [
  'Constant',
  'FilterCriterion',
  'EventSubscription',
  'ScheduledJob',
  'Sequence',
  'Catalog',
  'Document',
  'DocumentJournal',
  'Enum',
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

/** Типы только из подгрупп «Общие» (после общих реквизитов — планы обмена и т.п.) */
const COMMON_SUBGROUP_META_KINDS: NodeKind[] = ['ExchangePlan'];

const ALL_META_OBJECT_KINDS: NodeKind[] = [...TOP_GROUP_OBJECT_KINDS, ...COMMON_SUBGROUP_META_KINDS];

const metaObjectHandlersEntries = ALL_META_OBJECT_KINDS.map(
  (kind) => [kind, createMetaObjectHandler(kind)] as const
);

/**
 * Реестр обработчиков по типу объекта из ChildObjects в Configuration.xml.
 * По мере реализации сюда добавляются новые типы (Catalog, Document и т.д.).
 */
const HANDLER_REGISTRY = new Map<string, ObjectHandler>([
  ['Subsystem', subsystemHandler],
  ['CommonModule', commonModuleHandler],
  ['SessionParameter', sessionParameterHandler],
  ['Role', roleHandler],
  ['CommonAttribute', commonAttributeHandler],
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
