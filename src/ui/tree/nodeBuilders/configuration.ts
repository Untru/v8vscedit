import * as fs from 'fs';
import { buildConfigurationProperties } from '../../views/properties/PropertyBuilder';
import type { MetadataNode } from '../TreeNode';
import type { ObjectHandler, ObjectPropertiesCollection } from './_types';

/** Свойства корня выгрузки: основной конфигурации или расширения. */
export const configurationHandler: ObjectHandler = {
  buildTreeNodes() {
    return [];
  },
  canShowProperties(node: MetadataNode): boolean {
    return (node.nodeKind === 'configuration' || node.nodeKind === 'extension') && Boolean(node.xmlPath);
  },
  getProperties(node: MetadataNode): ObjectPropertiesCollection {
    if (!node.xmlPath) {
      return [];
    }
    try {
      return buildConfigurationProperties(fs.readFileSync(node.xmlPath, 'utf-8'));
    } catch {
      return [];
    }
  },
};
