import { test, expect } from '@playwright/test';
import * as path from 'path';
import {
  launchVSCode,
  openExtensionSidebar,
  getTreeItemLabels,
  expandTreeItem,
  dismissNotifications,
  runCommand,
} from './vscode-helpers';
import type { ElectronApplication, Page } from '@playwright/test';

const FIXTURES_PATH = path.resolve(__dirname, 'fixtures', 'cf');

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  ({ app, window } = await launchVSCode({ workspacePath: FIXTURES_PATH }));
  await window.waitForTimeout(3000);
  await dismissNotifications(window);
});

test.afterAll(async () => {
  await app?.close();
});

test.describe.serial('Дерево метаданных', () => {

  test('расширение загружается и sidebar открывается', async () => {
    await openExtensionSidebar(window);
    await window.waitForTimeout(2000);
    await dismissNotifications(window);

    // Tree should have at least the root node
    const rows = window.locator('.sidebar .monaco-list-row');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });

    await window.screenshot({ path: 'e2e/results/01-sidebar-loaded.png' });
  });

  test('конфигурация отображается в корне дерева', async () => {
    const labels = await getTreeItemLabels(window);
    console.log('Tree labels:', labels);

    expect(labels.some(l => l.includes('ТестоваяКонфигурация'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/02-config-root.png' });
  });

  test('раскрытие корневого узла показывает группы метаданных', async () => {
    // Expand root node
    await expandTreeItem(window, 'ТестоваяКонфигурация');
    await window.waitForTimeout(1000);

    const labels = await getTreeItemLabels(window);
    console.log('After expand:', labels);

    // Should have metadata groups
    expect(labels.some(l => l.includes('Справочники'))).toBe(true);
    expect(labels.some(l => l.includes('Документы'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/03-groups.png' });
  });

  test('объект Номенклатура виден в группе Справочники', async () => {
    // Expand "Справочники" if not already
    await expandTreeItem(window, 'Справочники');
    await window.waitForTimeout(500);

    const labels = await getTreeItemLabels(window);
    console.log('Tree with catalogs:', labels);

    expect(labels.some(l => l.includes('Номенклатура'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/04-catalogs.png' });
  });

  test('объект ПриходнаяНакладная виден в группе Документы', async () => {
    await expandTreeItem(window, 'Документы');
    await window.waitForTimeout(500);

    const labels = await getTreeItemLabels(window);
    expect(labels.some(l => l.includes('ПриходнаяНакладная'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/05-documents.png' });
  });

  test('контекстное меню объекта открывается', async () => {
    const item = window.locator('.sidebar .monaco-list-row', { hasText: 'Номенклатура' }).first();
    await item.click({ button: 'right' });
    await window.waitForTimeout(500);

    const contextMenu = window.locator('.monaco-menu-container, .shadow-root-host .monaco-menu');
    await expect(contextMenu.first()).toBeVisible({ timeout: 5000 });

    await window.screenshot({ path: 'e2e/results/06-context-menu.png' });

    await window.keyboard.press('Escape');
  });

  test('команда Обновить не ломает дерево', async () => {
    await runCommand(window, 'Обновить');
    await window.waitForTimeout(3000);
    await dismissNotifications(window);

    const labels = await getTreeItemLabels(window);
    expect(labels.length).toBeGreaterThan(0);

    await window.screenshot({ path: 'e2e/results/07-after-refresh.png' });
  });
});
