import type { MetadataNode } from '../../../../tree/TreeNode';
import { GenericPropertiesView } from './GenericPropertiesView';

/** Представление корневых свойств конфигурации и расширения. */
export class ConfigurationPropertiesView extends GenericPropertiesView {
  readonly id = 'configuration';

  canRender(node: MetadataNode): boolean {
    return node.nodeKind === 'configuration' || node.nodeKind === 'extension';
  }
}
