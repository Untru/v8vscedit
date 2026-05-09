import type {
  EnumPropertyValue,
  LocalizedStringValue,
  MetadataReferenceListValue,
  MetadataTypeValue,
  MultiEnumPropertyValue,
  ObjectPropertyItem,
} from '../_types';
import { ensureDefaultQualifiers } from '../MetadataTypeService';
import {
  escapeHtml,
  extractFormNameFromReference,
  getReferencePickerTitle,
} from '../PropertiesViewUtils';

/** Рендерит отдельные контролы свойств без знания о конкретном типе метаданных. */
export class PropertyControlRenderer {
  renderProperty(property: ObjectPropertyItem, isEditLocked: boolean): string {
    const valueHtml = this.renderPropertyValue(property, isEditLocked);
    const noteHtml = this.renderPropertyNote(property);
    if (property.kind === 'metadataReferenceList') {
      const isLocked = isEditLocked || property.readonly === true;
      const actionHtml = isLocked
        ? ''
        : `<button class="icon-btn" type="button" title="${escapeHtml(getReferencePickerTitle(property.key))}" data-reference-add="${escapeHtml(property.key)}">+</button>`;
      return `
        <div class="row">
          <div class="property-label-row">
            <label class="label" title="${escapeHtml(property.key)}">${escapeHtml(property.title)}</label>
            ${actionHtml}
          </div>
          <div class="control">${valueHtml}${noteHtml}</div>
        </div>
      `;
    }
    if (property.kind === 'boolean') {
      return `
        <div class="row boolean-row">
          <label class="label boolean-control" title="${escapeHtml(property.key)}">
            ${valueHtml}
            <span class="boolean-label">${escapeHtml(property.title)}</span>
          </label>
          ${noteHtml}
        </div>
      `;
    }
    return `
      <div class="row">
        <label class="label" title="${escapeHtml(property.key)}">${escapeHtml(property.title)}</label>
        <div class="control">${valueHtml}${noteHtml}</div>
      </div>
    `;
  }

  renderFormReferenceProperty(property: ObjectPropertyItem, isEditLocked: boolean): string {
    const rawValue = typeof property.value === 'string' ? property.value : '';
    const formName = extractFormNameFromReference(rawValue);
    const isLocked = isEditLocked || property.readonly === true;
    const disabledAttr = isLocked ? 'disabled' : '';
    const clearDisabledAttr = isLocked || !formName ? 'disabled' : '';
    const noteHtml = this.renderPropertyNote(property);
    return `
      <div class="row">
        <label class="label" title="${escapeHtml(property.key)}">${escapeHtml(property.title)}</label>
        <div class="control">
          <div class="form-picker-control">
            <input class="input" type="text" value="${escapeHtml(formName)}" placeholder="Используется стандартная форма" readonly />
            <div class="form-picker-actions">
              <button class="icon-btn" type="button" title="Выбрать форму" data-form-pick="${escapeHtml(property.key)}" ${disabledAttr}>...</button>
              <button class="icon-btn" type="button" title="Очистить форму" data-form-clear="${escapeHtml(property.key)}" ${clearDisabledAttr}>×</button>
            </div>
          </div>
          ${noteHtml}
        </div>
      </div>
    `;
  }

  private renderPropertyValue(property: ObjectPropertyItem, isEditLocked: boolean): string {
    if (property.key === '_note') {
      return `<div class="static-text">${escapeHtml(typeof property.value === 'string' ? property.value : '')}</div>`;
    }

    const isEditable = !isEditLocked && !property.readonly;
    const disabledAttr = isEditable ? '' : 'disabled data-readonly="true"';
    const readonlyAttr = isEditable ? '' : 'readonly data-readonly="true"';
    switch (property.kind) {
      case 'boolean':
        return `<div class="checkbox-row"><input class="checkbox" data-prop-key="${escapeHtml(property.key)}" type="checkbox" ${property.value === true ? 'checked' : ''} ${disabledAttr} /></div>`;
      case 'enum': {
        const enumValue = property.value as EnumPropertyValue;
        const options = enumValue.allowedValues
          .map((option) => {
            return `<option value="${escapeHtml(option.value)}" ${option.value === enumValue.current ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
          })
          .join('');
        return `<select class="select" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="string" ${disabledAttr}>${options}</select>`;
      }
      case 'multiEnum': {
        const multiValue = property.value as MultiEnumPropertyValue;
        const selected = new Set(multiValue.selected);
        const options = multiValue.allowedValues
          .map((option) => {
            return `<option value="${escapeHtml(option.value)}" ${selected.has(option.value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
          })
          .join('');
        const size = Math.min(Math.max(multiValue.allowedValues.length, 2), 8);
        return `<select class="select" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="multiEnum" multiple size="${String(size)}" ${disabledAttr}>${options}</select>`;
      }
      case 'localizedString': {
        const localized = property.value as LocalizedStringValue;
        const renderValue = localized.presentation;
        if (property.key === 'Explanation' || property.key === 'ExtendedExplanation') {
          return `<textarea class="textarea" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="localizedString" ${readonlyAttr}>${escapeHtml(renderValue)}</textarea>`;
        }
        return `<input class="input" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="localizedString" type="text" value="${escapeHtml(renderValue)}" ${readonlyAttr} />`;
      }
      case 'metadataType':
        return this.renderMetadataTypeControl(property, isEditLocked || property.readonly === true);
      case 'metadataReferenceList':
        return this.renderListControl(property, isEditLocked || property.readonly === true);
      case 'string': {
        if (typeof property.value !== 'string') {
          return `<input class="input" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="string" type="text" value="" ${readonlyAttr} />`;
        }
        const strVal = property.value;
        if (strVal.includes('\n')) {
          return `<textarea class="textarea" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="string" ${readonlyAttr}>${escapeHtml(strVal)}</textarea>`;
        }
        return `<input class="input" data-prop-key="${escapeHtml(property.key)}" data-prop-kind="string" type="text" value="${escapeHtml(strVal)}" ${readonlyAttr} />`;
      }
    }
  }

  private renderListControl(property: ObjectPropertyItem, isLocked: boolean): string {
    const value = property.value as MetadataReferenceListValue;
    if (value.items.length === 0) {
      return '<div class="empty">Список пуст.</div>';
    }
    return `
      <div class="reference-list">
        ${value.items.map((item) => this.renderListRow(property, item, isLocked)).join('')}
      </div>
    `;
  }

  private renderListRow(
    property: ObjectPropertyItem,
    item: MetadataReferenceListValue['items'][number],
    isLocked: boolean
  ): string {
    const removeHtml = isLocked
      ? ''
      : `<button class="icon-btn reference-remove" type="button" title="Удалить из списка" data-reference-remove="${escapeHtml(property.key)}" data-reference-value="${escapeHtml(item.canonical)}">×</button>`;
    return `
      <div class="reference-row">
        <div class="reference-value" title="${escapeHtml(item.canonical)}">${escapeHtml(item.display)}</div>
        ${removeHtml}
      </div>
    `;
  }

  private renderMetadataTypeControl(property: ObjectPropertyItem, isLocked: boolean): string {
    const value = property.key === 'Type'
      ? ensureDefaultQualifiers(property.value as MetadataTypeValue)
      : property.value as MetadataTypeValue;
    const disabledAttr = isLocked ? 'disabled' : '';
    return `
      <div class="type-control">
        <div class="type-row">
          <input class="input" data-type-presentation="${escapeHtml(property.key)}" type="text" value="${escapeHtml(value.presentation)}" readonly />
          <button class="btn" data-type-key="${escapeHtml(property.key)}" ${disabledAttr}>Выбрать</button>
        </div>
        ${property.key === 'Type' ? this.renderTypeQualifiers(value, isLocked) : ''}
      </div>
    `;
  }

  private renderTypeQualifiers(value: MetadataTypeValue, isEditLocked: boolean): string {
    const disabledAttr = isEditLocked ? 'disabled' : '';
    const blocks: string[] = [];
    if (value.stringQualifiers) {
      blocks.push(`
        <div class="qual-row">
          <label>Длина</label>
          <input class="input" id="qStringLength" type="number" value="${String(value.stringQualifiers.length ?? '')}" ${disabledAttr} />
          <label>Допустимая длина</label>
          <select class="select" id="qStringAllowedLength" ${disabledAttr}>
            <option value="Variable" ${value.stringQualifiers.allowedLength !== 'Fixed' ? 'selected' : ''}>Переменная</option>
            <option value="Fixed" ${value.stringQualifiers.allowedLength === 'Fixed' ? 'selected' : ''}>Фиксированная</option>
          </select>
        </div>
      `);
    }
    if (value.numberQualifiers) {
      blocks.push(`
        <div class="qual-row">
          <label>Разрядов</label>
          <input class="input" id="qNumberDigits" type="number" value="${String(value.numberQualifiers.digits ?? '')}" ${disabledAttr} />
          <label>Дробных</label>
          <input class="input" id="qNumberFractionDigits" type="number" value="${String(value.numberQualifiers.fractionDigits ?? '')}" ${disabledAttr} />
          <label>Знак</label>
          <select class="select" id="qNumberAllowedSign" ${disabledAttr}>
            <option value="Any" ${value.numberQualifiers.allowedSign !== 'Nonnegative' ? 'selected' : ''}>Любой</option>
            <option value="Nonnegative" ${value.numberQualifiers.allowedSign === 'Nonnegative' ? 'selected' : ''}>Неотрицательный</option>
          </select>
        </div>
      `);
    }
    if (value.dateQualifiers) {
      blocks.push(`
        <div class="qual-row">
          <label>Состав даты</label>
          <select class="select" id="qDateFractions" ${disabledAttr}>
            <option value="Date" ${value.dateQualifiers.dateFractions === 'Date' ? 'selected' : ''}>Дата</option>
            <option value="DateTime" ${value.dateQualifiers.dateFractions !== 'Date' ? 'selected' : ''}>ДатаВремя</option>
          </select>
        </div>
      `);
    }
    return blocks.join('');
  }

  private renderPropertyNote(property: ObjectPropertyItem): string {
    if (property.inherited) {
      return '<div class="property-note">Значение из основной конфигурации. Переопределение через панель свойств пока недоступно.</div>';
    }
    if (property.readonly && property.key !== '_note') {
      return '<div class="property-note">Служебное свойство доступно только для чтения.</div>';
    }
    return '';
  }
}
