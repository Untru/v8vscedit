/**
 * Точка входа webview визуального редактора форм.
 * Получает FormModel от extension host и рендерит три панели.
 */

import type { FormModel, FormElement } from '../FormModel';
import {
  renderElementTree,
  setOnSelectElement as setTreeOnSelect,
  expandToDepth,
  setSelectedElementId as setTreeSelectedId,
} from './formElementTree';
import {
  renderFormPreview,
  setOnSelectElement as setPreviewOnSelect,
  setSelectedElementId as setPreviewSelectedId,
} from './formPreview';
import { renderPropertyPanel } from './formPropertyPanel';

// Получить API VS Code webview
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

let currentModel: FormModel | null = null;
let elementIndex: Map<number, FormElement> = new Map();

// ── DOM-элементы ─────────────────────────────────────────────────────────────

const treeBody = document.getElementById('tree-body')!;
const previewBody = document.getElementById('preview-body')!;
const propertyBody = document.getElementById('property-body')!;

// ── Обработка выбора элемента ────────────────────────────────────────────────

function onSelectElement(element: FormElement): void {
  setTreeSelectedId(element.id);
  setPreviewSelectedId(element.id);

  // Обновить выделение в превью
  document.querySelectorAll('.preview-element.selected').forEach((el) => {
    el.classList.remove('selected');
  });
  const previewEl = previewBody.querySelector(
    `[data-element-id="${element.id}"]`
  );
  if (previewEl) previewEl.classList.add('selected');

  // Обновить выделение в дереве
  document.querySelectorAll('.tree-node.selected').forEach((el) => {
    el.classList.remove('selected');
  });
  const treeEl = treeBody.querySelector(
    `.tree-node[data-element-id="${element.id}"]`
  );
  if (treeEl) treeEl.classList.add('selected');

  // Обновить свойства
  renderPropertyPanel(propertyBody, element);

  // Сообщить extension host
  vscode.postMessage({ type: 'selectElement', elementId: element.id });
}

setTreeOnSelect(onSelectElement);
setPreviewOnSelect(onSelectElement);

// ── Индексация элементов ─────────────────────────────────────────────────────

function buildIndex(element: FormElement): void {
  elementIndex.set(element.id, element);
  for (const child of element.children) {
    buildIndex(child);
  }
}

// ── Обработка сообщений от extension host ────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case 'formLoaded': {
      currentModel = msg.model as FormModel;
      elementIndex = new Map();
      buildIndex(currentModel.root);

      // Раскрыть дерево до 2 уровня
      expandToDepth(currentModel.root, 2);

      // Рендер
      renderElementTree(treeBody, currentModel.root);
      renderFormPreview(previewBody, currentModel.root);
      renderPropertyPanel(propertyBody, null);
      break;
    }
  }
});

// Запросить данные
renderPropertyPanel(propertyBody, null);
