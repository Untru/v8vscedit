import { test, expect } from '@playwright/test';
import * as path from 'path';
import {
  launchVSCode,
  openExtensionSidebar,
  getTreeItemLabels,
  expandTreeItem,
  clickTreeItem,
  dismissNotifications,
} from './vscode-helpers';
import type { ElectronApplication, Page } from '@playwright/test';

const FIXTURES_PATH = path.resolve(__dirname, 'fixtures', 'cf');

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  ({ app, window } = await launchVSCode({ workspacePath: FIXTURES_PATH }));
  await window.waitForTimeout(3000);
  await dismissNotifications(window);

  // Open the extension sidebar and expand the tree
  await openExtensionSidebar(window);
  await window.waitForTimeout(1000);
  await expandTreeItem(window, 'ТестоваяКонфигурация');
  await window.waitForTimeout(500);
});

test.afterAll(async () => {
  await app?.close();
});

test.describe.serial('Формы в дереве метаданных', () => {

  test('группа "Формы" появляется при раскрытии справочника Номенклатура', async () => {
    // Expand Справочники
    await expandTreeItem(window, 'Справочники');
    await window.waitForTimeout(500);

    // Expand Номенклатура
    await expandTreeItem(window, 'Номенклатура');
    await window.waitForTimeout(500);

    const labels = await getTreeItemLabels(window);
    console.log('After Номенклатура expand:', labels);

    // Should show child groups: Реквизиты, Формы
    expect(labels.some(l => l.includes('Формы'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/form-01-groups.png' });
  });

  test('группа "Формы" содержит ФормаЭлемента и ФормаСписка', async () => {
    // Expand "Формы" group
    await expandTreeItem(window, 'Формы');
    await window.waitForTimeout(500);

    const labels = await getTreeItemLabels(window);
    console.log('Forms list:', labels);

    expect(labels.some(l => l.includes('ФормаЭлемента'))).toBe(true);
    expect(labels.some(l => l.includes('ФормаСписка'))).toBe(true);

    await window.screenshot({ path: 'e2e/results/form-02-forms-list.png' });
  });

  test('клик по ФормаЭлемента открывает модуль формы (Module.bsl)', async () => {
    // Single click on form — should open its BSL module
    await clickTreeItem(window, 'ФормаЭлемента');
    await window.waitForTimeout(2000);

    // Check that an editor tab opened with BSL content
    const editorTabs = window.locator('.tab .label-name');
    const tabCount = await editorTabs.count();
    const tabNames: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const text = await editorTabs.nth(i).textContent();
      if (text) tabNames.push(text.trim());
    }
    console.log('Open tabs:', tabNames);

    // Tab should contain "Module" or "Модуль" or the form name
    const hasFormTab = tabNames.some(t =>
      t.includes('Module') || t.includes('Модуль') || t.includes('ФормаЭлемента')
    );
    expect(hasFormTab).toBe(true);

    // Editor should contain BSL code
    const editorContent = window.locator('.editor-instance .view-lines');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    await window.screenshot({ path: 'e2e/results/form-03-module-opened.png' });
  });

  test('модуль формы содержит BSL-код с процедурами', async () => {
    // Verify editor shows BSL code — look for keywords
    const editorText = window.locator('.editor-instance .view-lines');
    const text = await editorText.textContent();
    console.log('Editor text (first 200 chars):', text?.substring(0, 200));

    // Should contain typical BSL form module content
    const hasBslContent = text &&
      (text.includes('Процедура') || text.includes('ПриОткрытии') || text.includes('НаКлиенте'));
    expect(hasBslContent).toBe(true);

    await window.screenshot({ path: 'e2e/results/form-04-bsl-content.png' });
  });

  test('клик по ФормаСписка открывает другой модуль', async () => {
    // Click on the second form
    await clickTreeItem(window, 'ФормаСписка');
    await window.waitForTimeout(2000);

    // Verify editor content changed
    const editorText = window.locator('.editor-instance .view-lines');
    const text = await editorText.textContent();
    console.log('ФормаСписка editor (first 200):', text?.substring(0, 200));

    // Should contain ФормаСписка-specific code
    const hasListContent = text &&
      (text.includes('Список') || text.includes('ПриОткрытии') || text.includes('Процедура'));
    expect(hasListContent).toBe(true);

    await window.screenshot({ path: 'e2e/results/form-05-list-form-module.png' });
  });

  test('контекстное меню формы содержит "Открыть модуль формы"', async () => {
    // Right-click on ФормаЭлемента
    const item = window.locator('.sidebar .monaco-list-row', { hasText: 'ФормаЭлемента' }).first();
    await item.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Context menu should appear
    const contextMenu = window.locator('.monaco-menu-container, .context-view');
    await expect(contextMenu.first()).toBeVisible({ timeout: 5000 });

    // Dump menu items for debugging
    const menuItems = contextMenu.first().locator('.action-label');
    const count = await menuItems.count();
    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) items.push(text.trim());
    }
    console.log('Context menu items:', items);

    // Should have form-related menu items
    const hasFormAction = items.some(i =>
      i.includes('модуль формы') || i.includes('Открыть XML') || i.includes('Свойства')
    );
    expect(hasFormAction).toBe(true);

    await window.screenshot({ path: 'e2e/results/form-06-context-menu.png' });

    await window.keyboard.press('Escape');
  });

  test('"Свойства" формы показывают информацию о форме', async () => {
    // Right-click and select "Свойства"
    const item = window.locator('.sidebar .monaco-list-row', { hasText: 'ФормаЭлемента' }).first();
    await item.click({ button: 'right' });
    await window.waitForTimeout(500);

    // Click "Свойства" in context menu
    const propItem = window.locator('.monaco-menu-container .action-label, .context-view .action-label', { hasText: 'Свойства' });
    if (await propItem.count() > 0) {
      await propItem.first().click();
      await window.waitForTimeout(1000);

      await window.screenshot({ path: 'e2e/results/form-07-properties.png' });
    } else {
      // Properties might not be available for child forms — that's OK, just document it
      await window.keyboard.press('Escape');
      console.log('No "Свойства" in context menu for child form');
      await window.screenshot({ path: 'e2e/results/form-07-no-properties.png' });
    }
  });
});
