import { MetadataNode } from '../MetadataNode';

/**
 * Контекст, передаваемый обработчику при построении узлов навигатора.
 */
export interface HandlerContext {
  /** Корневой каталог конфигурации (содержит Configuration.xml) */
  configRoot: string;
  /** Тип конфигурации */
  configKind: 'cf' | 'cfe';
  /** Префикс имён собственных объектов расширения */
  namePrefix: string;
  /** Имена объектов из ChildObjects в Configuration.xml */
  names: string[];
}

/**
 * Обработчик типа объекта метаданных.
 * Отвечает за формирование узлов навигатора, отображение и редактирование свойств.
 */
export interface ObjectHandler {
  /** Строит узлы объектов для группы в навигаторе */
  buildTreeNodes(ctx: HandlerContext): MetadataNode[];
}
