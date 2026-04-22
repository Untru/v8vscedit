/**
 * Точка входа webview визуального редактора форм.
 * Получает FormModel от extension host и рендерит три панели.
 * Поддерживает drag-and-drop, редактирование свойств, удаление элементов.
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
import {
  renderPropertyPanel,
  setOnPropertyChange,
  setOnDeleteElement,
} from './formPropertyPanel';
import {
  initTreeDragDrop,
  initPreviewDragDrop,
  setOnMoveElement,
} from './dragDrop';

// Получить API VS Code webview
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

let currentModel: FormModel | null = null;
let elementIndex: Map<number, FormElement> = new Map();
let selectedElementId: number | null = null;

// ── DOM-элементы ─────────────────────────────────────────────────────────────

const treeBody = document.getElementById('tree-body')!;
const previewBody = document.getElementById('preview-body')!;
const propertyBody = document.getElementById('property-body')!;

// ── Drag-and-drop ────────────────────────────────────────────────────────────

initTreeDragDrop(treeBody);
initPreviewDragDrop(previewBody);

setOnMoveElement((elementId, targetParentId, insertBeforeId) => {
  vscode.postMessage({
    type: 'moveElement',
    elementId,
    targetParentId,
    insertBeforeId,
  });
});

// ── Редактирование свойств ───────────────────────────────────────────────────

setOnPropertyChange((elementId, propertyName, value) => {
  vscode.postMessage({
    type: 'updateProperty',
    elementId,
    propertyName,
    value,
  });
});

// ── Удаление элементов ──────────────────────────────────────────────────────

setOnDeleteElement((elementId) => {
  vscode.postMessage({
    type: 'deleteElement',
    elementId,
  });
});

// ── Обработка выбора элемента ────────────────────────────────────────────────

function onSelectElement(element: FormElement): void {
  selectedElementId = element.id;
  setTreeSelectedId(element.id);
  setPreviewSelectedId(element.id);

  // Обновить выделение в превью
  document.querySelectorAll('.preview-element.selected').forEach((el: Element) => {
    (el as HTMLElement).classList.remove('selected');
  });
  const previewEl = previewBody.querySelector(
    `[data-element-id="${element.id}"]`
  );
  if (previewEl) (previewEl as HTMLElement).classList.add('selected');

  // Обновить выделение в дереве
  document.querySelectorAll('.tree-node.selected').forEach((el: Element) => {
    (el as HTMLElement).classList.remove('selected');
  });
  const treeEl = treeBody.querySelector(
    `.tree-node[data-element-id="${element.id}"]`
  );
  if (treeEl) (treeEl as HTMLElement).classList.add('selected');

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

      // Восстановить выбранный элемент если он ещё существует
      if (selectedElementId !== null && elementIndex.has(selectedElementId)) {
        const el = elementIndex.get(selectedElementId)!;
        onSelectElement(el);
      } else {
        selectedElementId = null;
        renderPropertyPanel(propertyBody, null);
      }
      break;
    }

    case 'error': {
      propertyBody.innerHTML = `<div class="no-selection" style="color: var(--vscode-errorForeground);">${msg.message}</div>`;
      break;
    }
  }
});

// ── Горячие клавиши ─────────────────────────────────────────────────────────

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (selectedElementId === null || selectedElementId === 0) return;

  if (e.key === 'Delete') {
    e.preventDefault();
    vscode.postMessage({ type: 'deleteElement', elementId: selectedElementId });
  }
});

// Начальное состояние
renderPropertyPanel(propertyBody, null);
