/**
 * Дерево элементов формы (левая панель webview).
 */

import type { FormElement } from '../FormModel';

/** Иконки для типов элементов */
const TYPE_ICONS: Record<string, string> = {
  UsualGroup: '📂',
  InputField: '📝',
  LabelField: '🏷️',
  LabelDecoration: '🏷️',
  Button: '🔘',
  Table: '📊',
  Pages: '📑',
  Page: '📄',
  CheckBoxField: '☑️',
  RadioButtonField: '🔘',
  AutoCommandBar: '🔧',
  CommandBar: '🔧',
  CommandBarButton: '▶️',
  PictureField: '🖼️',
  PictureDecoration: '🖼️',
  Separator: '➖',
  ContextMenu: '📋',
};

/** Состояние дерева (раскрытые узлы) */
const expandedNodes = new Set<number>();

/** Текущий выбранный элемент */
let selectedElementId: number | null = null;

/** Callback при выборе элемента */
let onSelectCallback: ((element: FormElement) => void) | null = null;

export function setOnSelectElement(
  callback: (element: FormElement) => void
): void {
  onSelectCallback = callback;
}

export function getSelectedElementId(): number | null {
  return selectedElementId;
}

export function setSelectedElementId(id: number | null): void {
  selectedElementId = id;
}

/** Рендер дерева элементов в контейнер */
export function renderElementTree(
  container: HTMLElement,
  root: FormElement
): void {
  container.innerHTML = '';

  // Корневой узел не показываем, показываем его children
  for (const child of root.children) {
    container.appendChild(renderTreeNode(child, 0));
  }
}

function renderTreeNode(element: FormElement, depth: number): HTMLElement {
  const wrapper = document.createElement('div');

  // Сам узел
  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'tree-node';
  nodeDiv.dataset.elementId = String(element.id);
  nodeDiv.draggable = true;
  if (element.id === selectedElementId) {
    nodeDiv.classList.add('selected');
  }

  // Стрелка раскрытия
  const toggle = document.createElement('span');
  toggle.className = 'toggle';
  if (element.children.length > 0) {
    const expanded = expandedNodes.has(element.id);
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expandedNodes.has(element.id)) {
        expandedNodes.delete(element.id);
      } else {
        expandedNodes.add(element.id);
      }
      // Перерисовать поддерево
      const childrenDiv = wrapper.querySelector(
        ':scope > .tree-children'
      ) as HTMLElement | null;
      if (childrenDiv) {
        childrenDiv.classList.toggle('collapsed');
      }
      toggle.textContent = expandedNodes.has(element.id) ? '▾' : '▸';
    });
  } else {
    toggle.classList.add('empty');
  }
  nodeDiv.appendChild(toggle);

  // Иконка
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.textContent = TYPE_ICONS[element.type] ?? '◻️';
  nodeDiv.appendChild(icon);

  // Название
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = element.name || element.type;
  nodeDiv.appendChild(label);

  // Клик — выбор
  nodeDiv.addEventListener('click', () => {
    // Снять выделение со старого
    const prev = document.querySelector('.tree-node.selected');
    if (prev) prev.classList.remove('selected');

    selectedElementId = element.id;
    nodeDiv.classList.add('selected');
    onSelectCallback?.(element);
  });

  wrapper.appendChild(nodeDiv);

  // Дочерние элементы
  if (element.children.length > 0) {
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    if (!expandedNodes.has(element.id)) {
      childrenDiv.classList.add('collapsed');
    }
    for (const child of element.children) {
      childrenDiv.appendChild(renderTreeNode(child, depth + 1));
    }
    wrapper.appendChild(childrenDiv);
  }

  return wrapper;
}

/** Раскрыть все группы до определённой глубины */
export function expandToDepth(root: FormElement, maxDepth: number): void {
  expandedNodes.clear();
  walkExpand(root, 0, maxDepth);
}

function walkExpand(
  element: FormElement,
  depth: number,
  maxDepth: number
): void {
  if (depth < maxDepth && element.children.length > 0) {
    expandedNodes.add(element.id);
    for (const child of element.children) {
      walkExpand(child, depth + 1, maxDepth);
    }
  }
}
