import type { ExchangePlanContentSnapshot } from '../../../../infra/xml/ExchangePlanContentService';
import type { SubsystemMembershipSnapshot } from '../../../../infra/xml/SubsystemXmlService';
import type { MetadataNode } from '../../../tree/TreeNode';
import type { ObjectPropertiesCollection } from '../_types';

export interface RenderedPropertySection {
  order: number;
  html: string;
  preferredColumn?: 'left' | 'right';
}

export interface PropertiesRenderContext {
  node: MetadataNode;
  properties: ObjectPropertiesCollection;
  isEditLocked: boolean;
  isEditLockedBySupport: boolean;
  isEditLockedByRepository: boolean;
  subsystemSnapshot: SubsystemMembershipSnapshot | null;
  exchangePlanContentSnapshot: ExchangePlanContentSnapshot | null;
}

export interface ObjectPropertiesView {
  readonly id: string;
  canRender(node: MetadataNode): boolean;
  render(context: PropertiesRenderContext): string;
}
