import type { MetaKind } from '../../../../../domain/MetaTypes';
import type { MetadataNode } from '../../../../tree/TreeNode';
import { GenericPropertiesView } from './GenericPropertiesView';
import type { PropertiesRenderContext, RenderedPropertySection } from '../_types';

/**
 * Базовая реализация для конкретного типа метаданных.
 * Каждый `MetaKind` регистрируется отдельным экземпляром, чтобы тип можно было
 * заменить специализированным view без изменений в `PropertiesViewProvider`.
 */
export class MetadataObjectPropertiesView extends GenericPropertiesView {
  readonly id: string;

  constructor(private readonly kind: MetaKind) {
    super();
    this.id = `metadata:${kind}`;
  }

  canRender(node: MetadataNode): boolean {
    return node.nodeKind === this.kind;
  }

  protected override getExtraSections(context: PropertiesRenderContext): RenderedPropertySection[] {
    const sections: RenderedPropertySection[] = [];
    if (context.subsystemSnapshot) {
      sections.push(
        this.sectionsRenderer.renderSubsystemMembershipSection(
          context.subsystemSnapshot,
          context.isEditLocked
        )
      );
    }
    if (context.exchangePlanContentSnapshot) {
      sections.push(
        this.sectionsRenderer.renderExchangePlanContentSection(
          context.exchangePlanContentSnapshot
        )
      );
    }
    return sections;
  }
}
