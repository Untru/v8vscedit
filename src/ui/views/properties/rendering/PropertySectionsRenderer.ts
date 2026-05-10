import type { ExchangePlanContentSnapshot } from '../../../../infra/xml/ExchangePlanContentService';
import type { SubsystemMembershipSnapshot, SubsystemMembershipTreeNode } from '../../../../infra/xml/SubsystemXmlService';
import type { ObjectPropertiesCollection } from '../_types';
import { escapeHtml } from '../PropertiesViewUtils';
import { PropertyControlRenderer } from './PropertyControlRenderer';
import type { RenderedPropertySection } from './_types';

/** Собирает секции и колонки панели свойств из отдельных контролов. */
export class PropertySectionsRenderer {
  constructor(private readonly controlRenderer = new PropertyControlRenderer()) {}

  renderPropertiesComponent(
    properties: ObjectPropertiesCollection,
    isEditLocked: boolean,
    extraSections: RenderedPropertySection[] = []
  ): string {
    const sections: RenderedPropertySection[] = [];
    if (properties.length === 0) {
      sections.push({
        order: 10,
        html: '<section class="property-section"><div class="message">Для выбранного объекта отсутствуют свойства.</div></section>',
      });
    } else if (properties.some((property) => property.section)) {
      sections.push(...this.renderPropertySections(properties, isEditLocked));
    } else {
      sections.push({
        order: 10,
        html: `
          <section class="property-section">
            <div class="form">
              ${properties.map((property) => this.controlRenderer.renderProperty(property, isEditLocked)).join('')}
            </div>
          </section>
        `,
      });
    }
    sections.push(...extraSections);
    return this.renderSectionColumns(sections);
  }

  renderSubsystemMembershipSection(
    snapshot: SubsystemMembershipSnapshot,
    isEditLocked: boolean
  ): RenderedPropertySection {
    const disabledAttr = isEditLocked || snapshot.tree.length === 0 ? 'disabled' : '';
    return {
      order: 20,
      html: `
        <section class="property-section">
          <h2 class="section-title">Подсистемы</h2>
          <button class="icon-btn section-header-action" type="button" title="Добавить подсистему" data-subsystem-add ${disabledAttr}>+</button>
          ${isEditLocked ? '<p class="subtitle">Редактирование запрещено текущим состоянием поддержки или хранилища.</p>' : ''}
          ${this.renderSubsystemMembershipComponent(snapshot, isEditLocked)}
        </section>
      `,
    };
  }

  renderExchangePlanContentSection(snapshot: ExchangePlanContentSnapshot): RenderedPropertySection {
    return {
      order: 140,
      preferredColumn: 'right',
      html: `
        <section class="property-section">
          <h2 class="section-title">Обмен данными</h2>
          ${this.renderExchangePlanContentComponent(snapshot)}
        </section>
      `,
    };
  }

  private renderSectionColumns(sections: RenderedPropertySection[]): string {
    const sortedSections = [...sections].sort((left, right) => left.order - right.order);
    const left: string[] = [];
    const right: string[] = [];
    sortedSections.forEach((section, index) => {
      const html = `<div style="order: ${String(index)}">${section.html}</div>`;
      if (section.preferredColumn === 'right') {
        right.push(html);
      } else if (section.preferredColumn === 'left' || index % 2 === 0) {
        left.push(html);
      } else {
        right.push(html);
      }
    });
    return `
      <div class="section-grid">
        <div class="section-column">${left.join('')}</div>
        <div class="section-column">${right.join('')}</div>
      </div>
    `;
  }

  private renderPropertySections(
    properties: ObjectPropertiesCollection,
    isEditLocked: boolean
  ): RenderedPropertySection[] {
    const sections = new Map<string, ObjectPropertiesCollection>();
    for (const property of properties) {
      const sectionName = property.section ?? 'Свойства';
      const section = sections.get(sectionName);
      if (section) {
        section.push(property);
      } else {
        sections.set(sectionName, [property]);
      }
    }

    return Array.from(sections.entries())
      .sort((left, right) => this.getSectionOrder(left[1]) - this.getSectionOrder(right[1]))
      .map(([title, items]) => {
        if (title === 'Формы') {
          return this.renderFormsSection(items, isEditLocked);
        }
        return {
          order: this.getSectionOrder(items),
          preferredColumn: title === 'Ввод на основании' || title === 'Прочее' ? 'right' : undefined,
          html: `
            <section class="property-section">
              <h2 class="section-title">${escapeHtml(title)}</h2>
              <div class="form">
                ${items.map((property) => this.controlRenderer.renderProperty(property, isEditLocked)).join('')}
              </div>
            </section>
          `,
        };
      });
  }

  private renderFormsSection(
    items: ObjectPropertiesCollection,
    isEditLocked: boolean
  ): RenderedPropertySection {
    const mainItems = items.filter((property) => property.key.startsWith('Default'));
    const auxiliaryItems = items.filter((property) => property.key.startsWith('Auxiliary'));
    const restItems = items.filter((property) => !property.key.startsWith('Default') && !property.key.startsWith('Auxiliary'));
    if (restItems.length > 0) {
      auxiliaryItems.push(...restItems);
    }
    return {
      order: this.getSectionOrder(items),
      html: `
        <section class="property-section">
          <h2 class="section-title">Формы</h2>
          <div class="tabbar" role="tablist" aria-label="Формы">
            <button class="tab-button active" type="button" role="tab" aria-selected="true" data-tab-target="forms-main">Основные</button>
            <button class="tab-button" type="button" role="tab" aria-selected="false" data-tab-target="forms-aux">Дополнительные</button>
          </div>
          <div class="tab-panel" data-tab-panel="forms-main">
            <div class="form">
              ${mainItems.length > 0 ? mainItems.map((property) => this.controlRenderer.renderFormReferenceProperty(property, isEditLocked)).join('') : '<div class="empty">Нет основных форм.</div>'}
            </div>
          </div>
          <div class="tab-panel hidden" data-tab-panel="forms-aux">
            <div class="form">
              ${auxiliaryItems.length > 0 ? auxiliaryItems.map((property) => this.controlRenderer.renderFormReferenceProperty(property, isEditLocked)).join('') : '<div class="empty">Нет дополнительных форм.</div>'}
            </div>
          </div>
        </section>
      `,
    };
  }

  private getSectionOrder(properties: ObjectPropertiesCollection): number {
    return properties.reduce((order, property) => Math.min(order, property.sectionOrder ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  }

  private renderSubsystemMembershipComponent(
    snapshot: SubsystemMembershipSnapshot,
    isEditLocked: boolean
  ): string {
    const disabledAttr = isEditLocked ? 'disabled' : '';
    if (snapshot.tree.length === 0) {
      return '<div class="empty">В конфигурации нет подсистем.</div>';
    }
    const selected = this.flattenSubsystemMembershipTree(snapshot.tree).filter((node) => node.checked);
    if (selected.length === 0) {
      return '<div class="empty">Объект не входит ни в одну подсистему.</div>';
    }
    return `
      <div class="reference-list">
        ${selected.map((node) => `
          <div class="reference-row">
            <div class="reference-value" title="${escapeHtml(node.name)}">${escapeHtml(node.label)}</div>
            <button class="icon-btn reference-remove" type="button" title="Убрать из подсистемы" data-subsystem-remove="${escapeHtml(node.xmlPath)}" ${disabledAttr}>×</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderExchangePlanContentComponent(snapshot: ExchangePlanContentSnapshot): string {
    if (snapshot.items.length === 0) {
      return '<div class="empty">Объект не входит ни в один план обмена.</div>';
    }
    return `
      <div class="reference-table" role="table" aria-label="Обмен данными">
        <div class="reference-table-header" role="row">
          <div role="columnheader">План обмена</div>
          <div role="columnheader">Авторегистрация</div>
        </div>
        ${snapshot.items.map((item) => `
          <div class="reference-table-row" role="row">
            <div class="reference-table-cell" role="cell" title="${escapeHtml(item.exchangePlanName)}">${escapeHtml(item.exchangePlanLabel)}</div>
            <div class="reference-table-cell" role="cell" title="${escapeHtml(item.autoRecord)}">${escapeHtml(item.autoRecordLabel)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private flattenSubsystemMembershipTree(tree: SubsystemMembershipTreeNode[]): SubsystemMembershipTreeNode[] {
    const result: SubsystemMembershipTreeNode[] = [];
    const walk = (nodes: SubsystemMembershipTreeNode[]): void => {
      for (const node of nodes) {
        result.push(node);
        walk(node.children);
      }
    };
    walk(tree);
    return result;
  }
}
