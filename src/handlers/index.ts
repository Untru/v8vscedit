import { ObjectHandler } from './_types';
import { commonModuleHandler } from './commonModule';

/**
 * Реестр обработчиков по типу объекта из ChildObjects в Configuration.xml.
 * По мере реализации сюда добавляются новые типы (Catalog, Document и т.д.).
 */
const HANDLER_REGISTRY = new Map<string, ObjectHandler>([
  ['CommonModule', commonModuleHandler],
]);

/** Возвращает обработчик для указанного типа объекта или undefined */
export function getObjectHandler(objectType: string): ObjectHandler | undefined {
  return HANDLER_REGISTRY.get(objectType);
}
