import type { ObjectHandler, ObjectPropertiesCollection } from './_types';

/**
 * Заглушка для типов в навигаторе без выгрузки в отдельные каталоги
 * (например «Цвета палитры» в конфигураторе как отдельная ветка).
 */
export const emptyMetadataGroupHandler: ObjectHandler = {
  buildTreeNodes() {
    return [];
  },
  canShowProperties() {
    return false;
  },
  getProperties(): ObjectPropertiesCollection {
    return [];
  },
};
