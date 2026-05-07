import { getNodeKindLabel, type MetadataNode } from '../../../../tree/TreeNode';
import { escapeHtml } from '../../PropertiesViewUtils';
import { renderPropertiesScript } from '../PropertiesWebviewHtml';
import { PropertySectionsRenderer } from '../PropertySectionsRenderer';
import type { ObjectPropertiesView, PropertiesRenderContext, RenderedPropertySection } from '../_types';

/** Общий fallback для узлов, у которых ещё нет собственного представления. */
export class GenericPropertiesView implements ObjectPropertiesView {
  readonly id: string = 'generic';

  constructor(protected readonly sectionsRenderer = new PropertySectionsRenderer()) {}

  canRender(_node: MetadataNode): boolean {
    void _node;
    return true;
  }

  render(context: PropertiesRenderContext): string {
    return `
      <div class="layout">
        <main>
          <section class="panel">
            ${this.renderHeaderCard(context)}
            ${this.sectionsRenderer.renderPropertiesComponent(
              context.properties,
              context.isEditLocked,
              this.getExtraSections(context)
            )}
          </section>
        </main>
      </div>
      <script>${renderPropertiesScript(context.isEditLocked)}</script>
    `;
  }

  protected getExtraSections(_context: PropertiesRenderContext): RenderedPropertySection[] {
    void _context;
    return [];
  }

  protected renderHeaderCard(context: PropertiesRenderContext): string {
    return `
      <header class="header page-header">
        <h1>${escapeHtml(context.node.textLabel)}</h1>
        <p class="subtitle">${escapeHtml(getNodeKindLabel(context.node.nodeKind))}</p>
        ${context.isEditLockedBySupport ? '<p class="subtitle">Редактирование запрещено поддержкой</p>' : ''}
        ${context.isEditLockedByRepository ? '<p class="subtitle">Редактирование запрещено: объект не захвачен в хранилище</p>' : ''}
      </header>
    `;
  }
}
