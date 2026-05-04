import { ChildTag, CHILD_TAG_CONFIG as DOMAIN_CHILD_TAG_CONFIG } from '../../../domain/ChildTag';
import { OpenModuleCommandId } from '../../../domain/ModuleSlot';
import { NodeKind } from '../TreeNode';

/**
 * Описание статических свойств типа узла дерева.
 *
 * Используется для:
 * - выбора SVG-иконки;
 * - описания доступных дочерних тегов;
 * - назначения команд по клику и в контекстном меню.
 */
export interface NodeDescriptor {
  /** Имя SVG-иконки без пути и расширения */
  icon: string;
  /** Имя папки в выгрузке конфигурации (Catalogs, Documents, ...), если применимо */
  folderName?: string;
  /** Поддерживаемые дочерние теги XML */
  children?: ReadonlyArray<ChildTag>;
  /** Команда по одиночному клику по узлу, если задана */
  singleClickCommand?: OpenModuleCommandId;
}

/** Идентификаторы поддерживаемых команд навигатора берутся из доменного реестра слотов модулей. */
export type CommandId = OpenModuleCommandId;

/** Конфигурация отображения дочернего тега */
export interface ChildTagConfig {
  /** Имя тега в XML */
  tag: ChildTag;
  /** Заголовок группы в дереве */
  label: string;
  /** Тип узла для элементов данного тега */
  kind: NodeKind;
}

/**
 * Справочник по дочерним тегам: заголовок группы и тип узла.
 * Используется при построении дочерних узлов объектов.
 */
export const CHILD_TAG_CONFIG: Readonly<Record<ChildTag, ChildTagConfig>> = DOMAIN_CHILD_TAG_CONFIG;
