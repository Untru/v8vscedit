/**
 * Панель свойств выбранного элемента формы (правая панель webview).
 */

import type { FormElement } from '../FormModel';

/** Рендер панели свойств */
export function renderPropertyPanel(
  container: HTMLElement,
  element: FormElement | null
): void {
  container.innerHTML = '';

  if (!element) {
    const placeholder = document.createElement('div');
    placeholder.className = 'no-selection';
    placeholder.textContent = 'Выберите элемент формы';
    container.appendChild(placeholder);
    return;
  }

  // Основные свойства
  appendPropertyGroup(container, 'Основные', [
    ['Имя', element.name],
    ['Тип', element.type],
    ['ID', String(element.id)],
  ]);

  // Данные
  const dataProps: [string, string][] = [];
  if (element.dataPath) dataProps.push(['Путь к данным', element.dataPath]);
  if (element.title) dataProps.push(['Заголовок', element.title]);
  if (dataProps.length > 0) {
    appendPropertyGroup(container, 'Данные', dataProps);
  }

  // Отображение
  const displayProps: [string, string][] = [];
  if (element.showTitle !== undefined) {
    displayProps.push(['Показывать заголовок', element.showTitle ? 'Да' : 'Нет']);
  }
  if (element.visible !== undefined) {
    displayProps.push(['Видимость', element.visible ? 'Да' : 'Нет']);
  }
  if (element.readOnly !== undefined) {
    displayProps.push(['Только чтение', element.readOnly ? 'Да' : 'Нет']);
  }
  if (element.group) {
    displayProps.push(['Группировка', element.group]);
  }
  if (element.horizontalStretch !== undefined) {
    displayProps.push([
      'Растягивание по горизонтали',
      element.horizontalStretch ? 'Да' : 'Нет',
    ]);
  }
  if (element.verticalStretch !== undefined) {
    displayProps.push([
      'Растягивание по вертикали',
      element.verticalStretch ? 'Да' : 'Нет',
    ]);
  }
  if (element.width) displayProps.push(['Ширина', String(element.width)]);
  if (element.height) displayProps.push(['Высота', String(element.height)]);
  if (displayProps.length > 0) {
    appendPropertyGroup(container, 'Отображение', displayProps);
  }

  // Прочие свойства (rawProperties)
  const rawEntries = Object.entries(element.rawProperties);
  if (rawEntries.length > 0) {
    appendPropertyGroup(
      container,
      'Прочие',
      rawEntries.map(([k, v]) => [k, v])
    );
  }
}

function appendPropertyGroup(
  container: HTMLElement,
  title: string,
  props: [string, string][]
): void {
  const group = document.createElement('div');
  group.className = 'property-group';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'property-group-title';
  titleDiv.textContent = title;
  group.appendChild(titleDiv);

  for (const [name, value] of props) {
    const row = document.createElement('div');
    row.className = 'property-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'property-name';
    nameSpan.textContent = name;
    row.appendChild(nameSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'property-value';
    valueSpan.textContent = value;
    valueSpan.title = value;
    row.appendChild(valueSpan);

    group.appendChild(row);
  }

  container.appendChild(group);
}
