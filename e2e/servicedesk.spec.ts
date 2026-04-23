/**
 * E2E-тесты на реальной конфигурации ServiceDesk (D:\Для плагина\cf).
 *
 * Проверяем: загрузку дерева, раскрытие групп, контекстное меню,
 * навигацию по справочникам/документам, открытие модулей, Quick Pick.
 */
import { test, expect } from '@playwright/test';
import {
  launchVSCode,
  openExtensionSidebar,
  getTreeItemLabels,
  expandTreeItem,
  clickTreeItem,
  dismissNotifications,
  runCommand,
} from './vscode-helpers';
import type { ElectronApplication, Page } from '@playwright/test';

const CONFIG_PATH = 'D:\\Для плагина\\cf';

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  ({ app, window } = await launchVSCode({ workspacePath: CONFIG_PATH }));
  await window.waitForTimeout(3000);
  await dismissNotifications(window);
});

test.afterAll(async () => {
  await app?.close();
});

test.describe.serial('ServiceDesk — дерево метаданных', () => {

  test('расширение загружается и sidebar открывается', async () => {
    await openExtensionSidebar(window);
    await window.waitForTimeout(3000);
    await dismissNotifications(window);

    const rows = window.locator('.sidebar .monaco-list-row');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });

    await window.screenshot({ path: 'e2e/results/sd-01-sidebar.png' });
  });

  test('конфигурация ServiceDesk отображается в корне', async () => {
    const labels = await getTreeItemLabels(window);
    console.log('Tree labels:', labels);

    expect(labels.some(l => l.includes('ServiceDesk'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-02-config-root.png' });
  });

  test('раскрытие корня показывает группы метаданных', async () => {
    await expandTreeItem(window, 'ServiceDesk');
    await window.waitForTimeout(1500);

    const labels = await getTreeItemLabels(window);
    console.log('Groups:', labels);

    expect(labels.some(l => l.includes('Справочники'))).toBe(true);
    expect(labels.some(l => l.includes('Документы'))).toBe(true);
    expect(labels.some(l => l.includes('Общие'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-03-groups.png' });
  });

  test('группа Справочники содержит Контрагенты', async () => {
    // Кликаем по Справочники и ждем загрузки дочерних элементов
    await expandTreeItem(window, 'Справочники');
    await window.waitForTimeout(2000);

    // Повторная попытка раскрытия, если дерево ленивое
    let labels = await getTreeItemLabels(window);
    if (!labels.some(l => l.includes('Контрагенты'))) {
      await expandTreeItem(window, 'Справочники');
      await window.waitForTimeout(3000);
      labels = await getTreeItemLabels(window);
    }
    console.log('Catalogs:', labels);

    expect(labels.some(l => l.includes('Контрагенты'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-04-catalogs.png' });
  });

  test('группа Документы содержит ОбращениеВПоддержку', async () => {
    await expandTreeItem(window, 'Документы');
    await window.waitForTimeout(1000);

    const labels = await getTreeItemLabels(window);
    console.log('Documents:', labels);

    expect(labels.some(l => l.includes('ОбращениеВПоддержку'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-05-documents.png' });
  });

  test('раскрытие Контрагенты показывает дочерние элементы (Реквизиты, Формы)', async () => {
    await expandTreeItem(window, 'Контрагенты');
    await window.waitForTimeout(1000);

    const labels = await getTreeItemLabels(window);
    console.log('Контрагенты children:', labels);

    // Должны быть группы Реквизиты, Формы и т.д.
    const hasChildren = labels.some(l =>
      l.includes('Реквизиты') || l.includes('Формы') || l.includes('Табличные')
    );
    expect(hasChildren).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-06-catalog-children.png' });
  });

  test('контекстное меню объекта метаданных открывается', async () => {
    const item = window.locator('.sidebar .monaco-list-row', { hasText: 'Контрагенты' }).first();
    await item.click({ button: 'right' });
    await window.waitForTimeout(500);

    const contextMenu = window.locator('.monaco-menu-container, .shadow-root-host .monaco-menu');
    await expect(contextMenu.first()).toBeVisible({ timeout: 5000 });

    await window.screenshot({ path: 'e2e/results/sd-07-context-menu.png' });
    await window.keyboard.press('Escape');
  });
});

test.describe.serial('ServiceDesk — общие модули', () => {

  test('группа Общие → Общие модули доступна', async () => {
    await openExtensionSidebar(window);
    await window.waitForTimeout(500);

    await expandTreeItem(window, 'Общие');
    await window.waitForTimeout(1000);

    const labels = await getTreeItemLabels(window);
    expect(labels.some(l => l.includes('Общие модули'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-08-common.png' });
  });

  test('Общие модули содержит ОбщийМодульСервер', async () => {
    await expandTreeItem(window, 'Общие модули');
    await window.waitForTimeout(2000);

    let labels = await getTreeItemLabels(window);
    if (!labels.some(l => l.includes('ОбщийМодульСервер'))) {
      // Повторная попытка раскрытия
      await expandTreeItem(window, 'Общие модули');
      await window.waitForTimeout(3000);
      labels = await getTreeItemLabels(window);
    }
    console.log('Common modules:', labels.filter(l => l.includes('Модуль') || l.includes('модуль')));

    expect(labels.some(l => l.includes('ОбщийМодульСервер'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/sd-09-common-modules.png' });
  });

  test('клик по ОбщийМодульСервер открывает BSL-модуль', async () => {
    await clickTreeItem(window, 'ОбщийМодульСервер');
    await window.waitForTimeout(3000);

    const editor = window.locator('.editor-instance .view-lines');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const text = await editor.textContent();
    console.log('Module content (first 200):', text?.substring(0, 200));

    // BSL-модуль должен содержать код
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(10);

    await window.screenshot({ path: 'e2e/results/sd-10-module-opened.png' });
  });
});

test.describe.serial('ServiceDesk — Quick Pick и команды', () => {

  test('Ctrl+Alt+M открывает Quick Pick с объектами конфигурации', async () => {
    // Сначала подождем полной загрузки расширения
    await openExtensionSidebar(window);
    await window.waitForTimeout(2000);

    await window.keyboard.press('Control+Alt+M');
    await window.waitForTimeout(2000);

    // Если shortcut не сработал, попробуем через палитру команд
    let quickInput = window.locator('.quick-input-widget');
    let visible = await quickInput.isVisible().catch(() => false);
    if (!visible) {
      await runCommand(window, '1С: Поиск объекта метаданных');
      await window.waitForTimeout(1500);
    }

    quickInput = window.locator('.quick-input-widget');
    await expect(quickInput).toBeVisible({ timeout: 5000 });

    const items = window.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    console.log('Quick Pick items:', count);

    await window.screenshot({ path: 'e2e/results/sd-11-quickpick.png' });
    await window.keyboard.press('Escape');
  });

  test('фильтрация Quick Pick по имени "Контрагенты"', async () => {
    await window.keyboard.press('Control+Alt+M');
    await window.waitForTimeout(500);
    await window.keyboard.type('Контрагенты');
    await window.waitForTimeout(800);

    const items = window.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    console.log('Filtered Quick Pick items:', count);

    expect(count).toBeGreaterThanOrEqual(1);

    await window.screenshot({ path: 'e2e/results/sd-12-quickpick-filter.png' });
    await window.keyboard.press('Escape');
  });

  test('команда Обновить не ломает дерево', async () => {
    await openExtensionSidebar(window);
    await runCommand(window, 'Обновить');
    await window.waitForTimeout(3000);
    await dismissNotifications(window);

    const labels = await getTreeItemLabels(window);
    expect(labels.length).toBeGreaterThan(0);

    await window.screenshot({ path: 'e2e/results/sd-13-after-refresh.png' });
  });
});
