import { getNodeKindLabel, type MetadataNode } from '../../../tree/TreeNode';
import { escapeHtml } from '../PropertiesViewUtils';

export function renderPropertiesHtmlDocument(content: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {
      padding: 16px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .layout {
      max-width: 1180px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .panel {
      display: grid;
      gap: 16px;
    }
    .card {
      padding: 16px;
      border: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
      border-radius: 10px;
      background: var(--vscode-sideBar-background);
    }
    .header {
      display: grid;
      gap: 6px;
    }
    .page-header {
      padding: 4px 0;
    }
    h1,
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }
    .subtitle,
    .message,
    .property-note,
    .counter {
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }
    .subtitle {
      margin: 0;
    }
    .message {
      padding: 12px;
    }
    .grid,
    .form {
      display: grid;
      gap: 12px;
    }
    .section-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
      min-width: 0;
    }
    .section-column {
      display: grid;
      gap: 16px;
      align-content: start;
      min-width: 0;
    }
    .property-section {
      display: inline-block;
      position: relative;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      margin: 10px 0 0;
      padding: 22px 16px 16px;
      border: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
      border-radius: 8px;
      background: var(--vscode-sideBar-background);
    }
    .section-title {
      position: absolute;
      top: -12px;
      left: 14px;
      margin: 0;
      padding: 0 8px;
      background: transparent;
      font-size: 17px;
      line-height: 1.25;
      font-weight: 700;
      z-index: 1;
    }
    .section-title::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 12px;
      height: 2px;
      background: var(--vscode-sideBar-background);
      transform: translateY(-50%);
      z-index: -1;
    }
    .section-header-action {
      position: absolute;
      top: -12px;
      right: 22px;
      z-index: 2;
      box-shadow: 0 0 0 4px var(--vscode-sideBar-background);
    }
    .form-row,
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
    label,
    .label {
      font-weight: 600;
      padding-top: 0;
    }
    .property-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }
    .control {
      min-width: 0;
    }
    .input,
    .textarea,
    .select {
      width: 100%;
      box-sizing: border-box;
      min-height: 34px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 6px;
      padding: 7px 10px;
      font: inherit;
    }
    .textarea {
      min-height: 120px;
      resize: vertical;
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      min-height: 20px;
    }
    .checkbox {
      width: auto;
      min-height: 0;
      margin: 3px 0 0;
      accent-color: var(--vscode-checkbox-selectBackground);
    }
    .boolean-control {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
    }
    .boolean-control .checkbox-row {
      min-height: 0;
    }
    .boolean-label {
      padding: 0;
    }
    .static-text {
      padding: 7px 0;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
    }
    .property-note {
      margin-top: 4px;
      font-size: 12px;
    }
    .tabbar {
      display: inline-flex;
      gap: 4px;
      margin-bottom: 12px;
      padding: 2px;
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border, transparent));
      border-radius: 6px;
      background: var(--vscode-input-background);
    }
    .tab-button {
      min-height: 28px;
      padding: 0 10px;
      border-color: transparent;
      color: var(--vscode-descriptionForeground);
      background: transparent;
    }
    .tab-button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .tab-panel.hidden {
      display: none;
    }
    .form-picker-control {
      position: relative;
      min-width: 0;
    }
    .form-picker-control .input {
      padding-right: 72px;
    }
    .form-picker-actions {
      position: absolute;
      top: 50%;
      right: 6px;
      display: inline-flex;
      gap: 4px;
      transform: translateY(-50%);
    }
    .localized-item {
      margin-top: 4px;
      padding-left: 8px;
      border-left: 2px solid var(--vscode-panel-border);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    button,
    .btn {
      min-height: 34px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid var(--vscode-button-border, transparent);
      font: inherit;
      cursor: pointer;
    }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button:disabled,
    .btn:disabled,
    input:disabled,
    textarea:disabled,
    select:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    .icon-btn {
      width: 24px;
      height: 24px;
      min-width: 24px;
      min-height: 24px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border, transparent));
      border-radius: 6px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font-size: 15px;
      font-weight: 600;
      line-height: 1;
    }
    .reference-list {
      display: grid;
      gap: 6px;
    }
    .reference-row {
      position: relative;
      min-width: 0;
    }
    .reference-value {
      min-height: 34px;
      box-sizing: border-box;
      padding: 7px 36px 7px 10px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 6px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .reference-remove {
      position: absolute;
      top: 50%;
      right: 6px;
      transform: translateY(-50%);
    }
    .reference-table {
      display: grid;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 6px;
      overflow: hidden;
      background: var(--vscode-input-background);
    }
    .reference-table-header,
    .reference-table-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(120px, 0.45fr);
      min-width: 0;
    }
    .reference-table-header {
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      font-weight: 600;
    }
    .reference-table-header + .reference-table-row,
    .reference-table-row + .reference-table-row {
      border-top: 1px solid var(--vscode-input-border, transparent);
    }
    .reference-table-cell,
    .reference-table-header > div {
      min-width: 0;
      padding: 7px 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .reference-table-cell + .reference-table-cell,
    .reference-table-header > div + div {
      border-left: 1px solid var(--vscode-input-border, transparent);
    }
    .type-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }
    .qual-row {
      margin-top: 8px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      align-items: center;
    }
    .empty {
      padding: 12px;
      color: var(--vscode-descriptionForeground);
      border: 1px dashed var(--vscode-panel-border, var(--vscode-input-border, transparent));
      border-radius: 6px;
    }
    @media (max-width: 760px) {
      .form-row,
      .row,
      .qual-row {
        grid-template-columns: 1fr;
      }
      .tabbar {
        display: flex;
      }
      .tab-button {
        flex: 1;
      }
      .section-grid {
        display: flex;
        flex-direction: column;
      }
      .section-column {
        display: contents;
      }
      .reference-table-header,
      .reference-table-row {
        grid-template-columns: minmax(0, 1fr) minmax(96px, 0.55fr);
      }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

export function renderPropertiesState(title: string, message: string, subtitle?: string): string {
  return `
    <div class="layout single">
      <main>
        <section class="panel">
          <section class="card header">
            <h1>${escapeHtml(title)}</h1>
            ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
          </section>
          <section class="card">
            <div class="message">${escapeHtml(message)}</div>
          </section>
        </section>
      </main>
    </div>
  `;
}

export function renderNoPropertiesState(node: MetadataNode): string {
  return renderPropertiesState(
    node.textLabel,
    'Для выбранного объекта отсутствуют свойства',
    getNodeKindLabel(node.nodeKind)
  );
}

export function renderPropertiesScript(isEditLocked: boolean): string {
  return `
    const vscode = acquireVsCodeApi();
    const isEditLocked = ${isEditLocked ? 'true' : 'false'};
    const isValidMetadataName = (value) => /^[\\p{L}][\\p{L}\\p{Nd}_]*$/u.test(value);
    const lastValidByKey = new Map();
    const submitOnEnter = (el, key, kind) => {
      if (el.tagName === 'TEXTAREA') return;
      el.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
          return;
        }
        if (key === 'Name' && el.type !== 'checkbox') {
          const current = String(el.value ?? '');
          if (!isValidMetadataName(current)) {
            event.preventDefault();
            el.value = String(lastValidByKey.get(key) ?? '');
            vscode.postMessage({ type: 'invalidName' });
            return;
          }
          lastValidByKey.set(key, current);
        }
        event.preventDefault();
        el.dataset.skipNextBlurSubmit = 'true';
        postPropertyChange(el, key, kind);
        if (typeof el.blur === 'function') {
          el.blur();
        }
      });
    };
    const collectQualifiers = () => ({
      stringLength: document.getElementById('qStringLength')?.value,
      stringAllowedLength: document.getElementById('qStringAllowedLength')?.value,
      numberDigits: document.getElementById('qNumberDigits')?.value,
      numberFractionDigits: document.getElementById('qNumberFractionDigits')?.value,
      numberAllowedSign: document.getElementById('qNumberAllowedSign')?.value,
      dateFractions: document.getElementById('qDateFractions')?.value,
    });
    document.querySelectorAll('[data-type-key]').forEach((typeBtn) => {
      typeBtn.addEventListener('click', () => {
        if (isEditLocked) return;
        const key = typeBtn.getAttribute('data-type-key') || 'Type';
        vscode.postMessage({ type: 'openTypePicker', key, qualifiers: key === 'Type' ? collectQualifiers() : {} });
      });
    });
    document.querySelectorAll('[data-tab-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-tab-target') || '';
        if (!target) return;
        document.querySelectorAll('[data-tab-target]').forEach((item) => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
          panel.classList.toggle('hidden', panel.getAttribute('data-tab-panel') !== target);
        });
      });
    });
    document.querySelectorAll('[data-form-pick]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isEditLocked || button.disabled) return;
        const key = button.getAttribute('data-form-pick') || '';
        if (key) vscode.postMessage({ type: 'openFormPicker', key });
      });
    });
    document.querySelectorAll('[data-form-clear]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isEditLocked || button.disabled) return;
        const key = button.getAttribute('data-form-clear') || '';
        if (key) vscode.postMessage({ type: 'clearFormProperty', key });
      });
    });
    document.querySelectorAll('[data-reference-add]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isEditLocked || button.disabled) return;
        const key = button.getAttribute('data-reference-add') || '';
        if (key) vscode.postMessage({ type: 'openMetadataReferencePicker', key });
      });
    });
    document.querySelectorAll('[data-reference-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isEditLocked || button.disabled) return;
        const key = button.getAttribute('data-reference-remove') || '';
        const value = button.getAttribute('data-reference-value') || '';
        if (key && value) vscode.postMessage({ type: 'removeMetadataReference', key, value });
      });
    });
    document.querySelectorAll('[data-subsystem-add]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isEditLocked || button.disabled) return;
        vscode.postMessage({ type: 'openSubsystemMembershipPicker' });
      });
    });
    document.querySelectorAll('[data-subsystem-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        if (isEditLocked || button.disabled) return;
        const value = button.getAttribute('data-subsystem-remove') || '';
        if (value) vscode.postMessage({ type: 'removeSubsystemMembership', value });
      });
    });
    for (const id of ['qStringLength','qStringAllowedLength','qNumberDigits','qNumberFractionDigits','qNumberAllowedSign','qDateFractions']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('change', () => {
        if (isEditLocked) return;
        vscode.postMessage({ type: 'updateTypeQualifiers', key: 'Type', qualifiers: collectQualifiers() });
      });
    }
    const postPropertyChange = (el, key, kind) => {
      const value = el.multiple
        ? Array.from(el.selectedOptions).map((option) => String(option.value ?? ''))
        : el.type === 'checkbox'
        ? Boolean(el.checked)
        : String(el.value ?? '');
      vscode.postMessage({ type: 'propertyChanged', key, kind, value });
    };
    document.querySelectorAll('[data-prop-key]').forEach((el) => {
      const key = el.getAttribute('data-prop-key');
      const kind = el.getAttribute('data-prop-kind') || (el.type === 'checkbox' ? 'boolean' : 'string');
      if (!key || isEditLocked || el.dataset.readonly === 'true') return;
      if (el.type !== 'checkbox') {
        lastValidByKey.set(key, String(el.value ?? ''));
      }
      if (el.type === 'checkbox' || el.tagName === 'SELECT') {
        el.addEventListener('change', () => {
          postPropertyChange(el, key, kind);
        });
        return;
      }
      submitOnEnter(el, key, kind);
      el.addEventListener('blur', () => {
        if (el.dataset.skipNextBlurSubmit === 'true') {
          delete el.dataset.skipNextBlurSubmit;
          return;
        }
        if (key === 'Name' && el.type !== 'checkbox') {
          const current = String(el.value ?? '');
          if (!isValidMetadataName(current)) {
            el.value = String(lastValidByKey.get(key) ?? '');
            vscode.postMessage({ type: 'invalidName' });
            return;
          }
          lastValidByKey.set(key, current);
        }
        postPropertyChange(el, key, kind);
      });
    });
  `;
}
