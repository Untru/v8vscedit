import * as fs from 'fs';
import type { MetadataNode } from '../TreeNode';
import {
  buildTreeNodesForMetaKind,
  rootMetaObjectCanShowProperties,
} from './metaObjectTreeBuilder';
import type { HandlerContext, ObjectHandler, ObjectPropertiesCollection } from './_types';
import { EventSubscriptionPropertyService } from '../../views/properties/EventSubscriptionPropertyService';

// ---------------------------------------------------------------------------
// Объект «Подписка на событие» (EventSubscription). Папка: EventSubscriptions.
// Дескриптор — nodes/objects/EventSubscription.ts.
// ---------------------------------------------------------------------------

const NODE_KIND = 'EventSubscription' as const;
const propertyService = new EventSubscriptionPropertyService();

export const eventSubscriptionHandler: ObjectHandler = {
  buildTreeNodes(ctx: HandlerContext) {
    return buildTreeNodesForMetaKind(ctx, NODE_KIND);
  },

  canShowProperties(node: MetadataNode) {
    return rootMetaObjectCanShowProperties(node, NODE_KIND);
  },

  getProperties(node: MetadataNode): ObjectPropertiesCollection {
    if (node.nodeKind !== NODE_KIND || !node.xmlPath || node.metaContext) {
      return [];
    }
    try {
      const xml = fs.readFileSync(node.xmlPath, 'utf-8');
      return propertyService.buildProperties(xml, node.xmlPath);
    } catch {
      return [];
    }
  },
};
