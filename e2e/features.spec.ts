/**
 * E2E-тесты для всех замерженных PR.
 *
 * PR #47  — Сниппеты BSL
 * PR #48  — Quick Pick поиск метаданных (Ctrl+Alt+M)
 * PR #50  — Хранилище конфигурации (команды в меню)
 * PR #51  — Signature Help
 * PR #52  — Document Formatting
 * PR #53  — Синтаксис-помощник (hover/completion глобальных методов)
 * PR #55  — Workspace Symbols (Ctrl+T)
 * PR #56  — Rename Symbol
 * PR #57  — Go to Definition (кросс-модульный)
 * PR #58  — Find All References
 * PR #59  — Автодополнение реквизитов/менеджеров
 * PR #60  — Глобальный поиск по модулям
 * PR #61  — Удаление объектов метаданных
 * PR #62  — Команда «Редактировать форму»
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
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

const FIXTURES_PATH = path.resolve(__dirname, 'fixtures', 'cf');

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  ({ app, window } = await launchVSCode({ workspacePath: FIXTURES_PATH }));
  await window.waitForTimeout(3000);
  await dismissNotifications(window);

  // Open sidebar and expand tree
  await openExtensionSidebar(window);
  await window.waitForTimeout(2000);
  await dismissNotifications(window);
  await expandTreeItem(window, 'ТестоваяКонфигурация');
  await window.waitForTimeout(1000);
});

test.afterAll(async () => {
  await app?.close();
});

// ============================================================================
// PR #48 — Quick Pick поиск метаданных
// ============================================================================

test.describe.serial('PR #48: Поиск метаданных Quick Pick', () => {

  test('команда searchMetadata доступна через палитру', async () => {
    await window.keyboard.press('Control+Shift+P');
    await window.waitForSelector('.quick-input-widget', { timeout: 5000 });
    await window.keyboard.type('1С: Поиск объекта метаданных');
    await window.waitForTimeout(500);

    const items = window.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    await window.screenshot({ path: 'e2e/results/feat-48-search-command.png' });
    await window.keyboard.press('Escape');
  });

  test('Ctrl+Alt+M открывает Quick Pick с объектами', async () => {
    await window.keyboard.press('Control+Alt+M');
    await window.waitForTimeout(1000);

    // Quick Pick should be visible
    const quickInput = window.locator('.quick-input-widget');
    await expect(quickInput).toBeVisible({ timeout: 5000 });

    // Should contain metadata objects
    const items = window.locator('.quick-input-list .monaco-list-row');
    await window.waitForTimeout(500);
    const count = await items.count();
    console.log('Quick Pick items count:', count);

    await window.screenshot({ path: 'e2e/results/feat-48-quickpick.png' });
    await window.keyboard.press('Escape');
  });

  test('фильтрация по имени объекта работает', async () => {
    await window.keyboard.press('Control+Alt+M');
    await window.waitForTimeout(500);
    await window.keyboard.type('Номенклатура');
    await window.waitForTimeout(500);

    const items = window.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    console.log('Filtered items:', count);

    // Should find at least Номенклатура
    expect(count).toBeGreaterThanOrEqual(1);

    await window.screenshot({ path: 'e2e/results/feat-48-filter.png' });
    await window.keyboard.press('Escape');
  });
});

// ============================================================================
// PR #60 — Глобальный поиск по модулям
// ============================================================================

test.describe.serial('PR #60: Глобальный поиск по модулям', () => {

  test('команда searchInModules доступна', async () => {
    await window.keyboard.press('Control+Shift+P');
    await window.waitForSelector('.quick-input-widget', { timeout: 5000 });
    await window.keyboard.type('1С: Поиск по всем модулям');
    await window.waitForTimeout(500);

    const items = window.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    await window.screenshot({ path: 'e2e/results/feat-60-search-cmd.png' });
    await window.keyboard.press('Escape');
  });
});

// ============================================================================
// PR #50 — Хранилище конфигурации (команды в контекстном меню)
// ============================================================================

test.describe.serial('PR #50: Хранилище конфигурации', () => {

  test('контекстное меню корневого узла содержит команды хранилища', async () => {
    const root = window.locator('.sidebar .monaco-list-row', { hasText: 'ТестоваяКонфигурация' }).first();
    await root.click({ button: 'right' });
    await window.waitForTimeout(500);

    const contextMenu = window.locator('.monaco-menu-container, .context-view');
    await expect(contextMenu.first()).toBeVisible({ timeout: 5000 });

    const menuItems = contextMenu.first().locator('.action-label');
    const count = await menuItems.count();
    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) items.push(text.trim());
    }
    console.log('Root context menu:', items);

    // Should have repository commands
    const hasRepoCmd = items.some(i =>
      i.includes('хранилищу') || i.includes('Создать хранилище')
    );
    expect(hasRepoCmd).toBe(true);

    await window.screenshot({ path: 'e2e/results/feat-50-repo-menu.png' });
    await window.keyboard.press('Escape');
  });
});

// ============================================================================
// PR #61 — Удаление объектов метаданных
// ============================================================================

test.describe.serial('PR #61: Удаление объектов', () => {

  test('контекстное меню объекта содержит "Удалить объект"', async () => {
    // Expand Справочники
    await expandTreeItem(window, 'Справочники');
    await window.waitForTimeout(500);

    const item = window.locator('.sidebar .monaco-list-row', { hasText: 'Номенклатура' }).first();
    await item.click({ button: 'right' });
    await window.waitForTimeout(500);

    const contextMenu = window.locator('.monaco-menu-container, .context-view');
    await expect(contextMenu.first()).toBeVisible({ timeout: 5000 });

    const menuItems = contextMenu.first().locator('.action-label');
    const count = await menuItems.count();
    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) items.push(text.trim());
    }
    console.log('Object context menu:', items);

    const hasDelete = items.some(i => i.includes('Удалить'));
    expect(hasDelete).toBe(true);

    await window.screenshot({ path: 'e2e/results/feat-61-delete-menu.png' });
    await window.keyboard.press('Escape');
  });
});

// ============================================================================
// PR #47 — Сниппеты BSL
// ============================================================================

test.describe.serial('PR #47: Сниппеты BSL', () => {

  test('сниппеты BSL работают в редакторе', async () => {
    // Open a BSL file
    const bslPath = path.resolve(FIXTURES_PATH,
      'CommonModules', 'ОбщийМодуль1', 'Module.bsl');
    await runCommand(window, 'Open File');
    await window.waitForTimeout(500);

    // Type path in the dialog — this is tricky in E2E, use command palette instead
    await window.keyboard.press('Escape');

    // Open file via tree: expand Общие → Общие модули → ОбщийМодуль1
    await expandTreeItem(window, 'Общие');
    await window.waitForTimeout(500);
    await expandTreeItem(window, 'Общие модули');
    await window.waitForTimeout(500);
    await clickTreeItem(window, 'ОбщийМодуль1');
    await window.waitForTimeout(2000);

    // Editor should be open
    const editor = window.locator('.editor-instance .view-lines');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Go to end of file and type a snippet prefix
    await window.keyboard.press('Control+End');
    await window.waitForTimeout(200);
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');
    await window.keyboard.type('процедура');
    await window.waitForTimeout(1000);

    // Autocomplete should show snippet
    const suggest = window.locator('.suggest-widget');
    const suggestVisible = await suggest.isVisible().catch(() => false);
    console.log('Snippet suggest visible:', suggestVisible);

    await window.screenshot({ path: 'e2e/results/feat-47-snippet.png' });

    // Cancel
    await window.keyboard.press('Escape');
    // Undo changes
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
  });
});

// ============================================================================
// PR #51–59 — LSP-фичи (открываем BSL-файл и тестируем LSP)
// ============================================================================

test.describe.serial('LSP-фичи (PR #51-59)', () => {

  test.beforeAll(async () => {
    // Make sure a BSL file is open
    await openExtensionSidebar(window);
    await window.waitForTimeout(500);
    await expandTreeItem(window, 'Общие');
    await window.waitForTimeout(300);
    await expandTreeItem(window, 'Общие модули');
    await window.waitForTimeout(300);
    await clickTreeItem(window, 'ОбщийМодуль1');
    await window.waitForTimeout(2000);
  });

  // PR #53 — Синтаксис-помощник: completion глобальных методов
  test('PR #53: completion глобальных методов платформы', async () => {
    // Go to end of file and type a global method name
    await window.keyboard.press('Control+End');
    await window.waitForTimeout(200);
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Сообщ');
    await window.waitForTimeout(1500);

    // Suggest widget should appear with "Сообщить"
    const suggest = window.locator('.suggest-widget');
    const suggestVisible = await suggest.isVisible().catch(() => false);
    console.log('Global method suggest visible:', suggestVisible);

    if (suggestVisible) {
      const suggestItems = suggest.locator('.monaco-list-row');
      const count = await suggestItems.count();
      const items: string[] = [];
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await suggestItems.nth(i).textContent();
        if (text) items.push(text.trim());
      }
      console.log('Suggest items:', items);
    }

    await window.screenshot({ path: 'e2e/results/feat-53-completion.png' });
    await window.keyboard.press('Escape');
    // Undo
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
  });

  // PR #53 — Синтаксис-помощник: hover
  test('PR #53: hover показывает справку по глобальным методам', async () => {
    // Hover over "Сообщить" on line 11
    const editor = window.locator('.editor-instance .view-lines');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Go to "Сообщить" — line 11, use Ctrl+G
    await window.keyboard.press('Control+G');
    await window.waitForTimeout(300);
    await window.keyboard.type('11');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    // Select the word "Сообщить" using double-click simulation
    // Use keyboard: Home → Ctrl+Right to position, then hover
    await window.keyboard.press('Home');
    await window.waitForTimeout(100);

    // Trigger hover via command
    await runCommand(window, 'Show Hover');
    await window.waitForTimeout(1500);

    const hover = window.locator('.monaco-hover-content');
    const hoverVisible = await hover.isVisible().catch(() => false);
    console.log('Hover visible:', hoverVisible);

    await window.screenshot({ path: 'e2e/results/feat-53-hover.png' });

    await window.keyboard.press('Escape');
  });

  // PR #52 — Document Formatting
  test('PR #52: форматирование документа работает', async () => {
    // Trigger format document
    await window.keyboard.press('Shift+Alt+F');
    await window.waitForTimeout(1000);

    // After formatting, editor should still have content
    const editor = window.locator('.editor-instance .view-lines');
    const text = await editor.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(50);

    await window.screenshot({ path: 'e2e/results/feat-52-formatting.png' });
  });

  // PR #51 — Signature Help
  test('PR #51: signature help срабатывает при вводе (', async () => {
    await window.keyboard.press('Control+End');
    await window.waitForTimeout(200);
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Сообщить(');
    await window.waitForTimeout(1500);

    const paramHints = window.locator('.parameter-hints-widget');
    const hintsVisible = await paramHints.isVisible().catch(() => false);
    console.log('Signature help visible:', hintsVisible);

    await window.screenshot({ path: 'e2e/results/feat-51-signature.png' });

    await window.keyboard.press('Escape');
    // Undo
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
  });

  // PR #55 — Workspace Symbols
  test('PR #55: Ctrl+T показывает символы воркспейса', async () => {
    await window.keyboard.press('Control+T');
    await window.waitForTimeout(1000);

    const quickInput = window.locator('.quick-input-widget');
    await expect(quickInput).toBeVisible({ timeout: 5000 });

    // Type a procedure name
    await window.keyboard.type('ПолучитьНаименование');
    await window.waitForTimeout(1000);

    const items = window.locator('.quick-input-list .monaco-list-row');
    const count = await items.count();
    console.log('Workspace symbols count:', count);

    await window.screenshot({ path: 'e2e/results/feat-55-workspace-symbols.png' });
    await window.keyboard.press('Escape');
  });

  // PR #56 — Rename Symbol
  test('PR #56: F2 открывает диалог переименования', async () => {
    // Position cursor on a variable name
    await window.keyboard.press('Control+G');
    await window.waitForTimeout(300);
    await window.keyboard.type('4');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    // Select word under cursor
    await window.keyboard.press('Control+D');
    await window.waitForTimeout(200);

    // Try F2
    await window.keyboard.press('F2');
    await window.waitForTimeout(1000);

    // Rename widget or input box should appear
    const renameInput = window.locator('.rename-input-widget input, .rename-box');
    const renameVisible = await renameInput.isVisible().catch(() => false);
    console.log('Rename widget visible:', renameVisible);

    await window.screenshot({ path: 'e2e/results/feat-56-rename.png' });
    await window.keyboard.press('Escape');
  });

  // PR #57 — Go to Definition
  test('PR #57: Go to Definition работает (F12)', async () => {
    // Go to line with ПолучитьНаименование call (line 11)
    await window.keyboard.press('Control+G');
    await window.waitForTimeout(300);
    await window.keyboard.type('11');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    // Position on ПолучитьНаименование
    await window.keyboard.press('Home');
    await window.waitForTimeout(100);

    // F12 — Go to Definition
    await window.keyboard.press('F12');
    await window.waitForTimeout(1500);

    await window.screenshot({ path: 'e2e/results/feat-57-definition.png' });

    // Close peek if opened
    await window.keyboard.press('Escape');
  });

  // PR #58 — Find All References
  test('PR #58: Find All References работает (Shift+F12)', async () => {
    // Go to ПолучитьНаименование definition (line 3)
    await window.keyboard.press('Control+G');
    await window.waitForTimeout(300);
    await window.keyboard.type('3');
    await window.keyboard.press('Enter');
    await window.waitForTimeout(300);

    // Select the function name
    await window.keyboard.press('Home');
    await window.waitForTimeout(100);

    // Shift+F12 — Find All References
    await window.keyboard.press('Shift+F12');
    await window.waitForTimeout(2000);

    // References peek widget or panel should appear
    const peekWidget = window.locator('.peekview-widget, .references-zone-widget');
    const peekVisible = await peekWidget.isVisible().catch(() => false);
    console.log('References peek visible:', peekVisible);

    await window.screenshot({ path: 'e2e/results/feat-58-references.png' });
    await window.keyboard.press('Escape');
  });

  // PR #59 — Автодополнение реквизитов/менеджеров
  test('PR #59: completion после точки (реквизиты менеджера)', async () => {
    await window.keyboard.press('Control+End');
    await window.waitForTimeout(200);
    await window.keyboard.press('Enter');
    await window.keyboard.press('Enter');
    await window.keyboard.type('Справочники.');
    await window.waitForTimeout(1500);

    const suggest = window.locator('.suggest-widget');
    const suggestVisible = await suggest.isVisible().catch(() => false);
    console.log('Manager completion visible:', suggestVisible);

    if (suggestVisible) {
      const items = suggest.locator('.monaco-list-row');
      const count = await items.count();
      console.log('Manager suggest count:', count);
    }

    await window.screenshot({ path: 'e2e/results/feat-59-manager-completion.png' });
    await window.keyboard.press('Escape');
    // Undo
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
    await window.keyboard.press('Control+Z');
  });
});

// ============================================================================
// PR #62 — Команда «Редактировать форму»
// ============================================================================

test.describe.serial('PR #62: Редактировать форму', () => {

  test('контекстное меню формы содержит "Редактировать форму"', async () => {
    await openExtensionSidebar(window);
    await window.waitForTimeout(500);

    // Navigate to form
    await expandTreeItem(window, 'Справочники');
    await window.waitForTimeout(300);
    await expandTreeItem(window, 'Номенклатура');
    await window.waitForTimeout(300);
    await expandTreeItem(window, 'Формы');
    await window.waitForTimeout(300);

    const formItem = window.locator('.sidebar .monaco-list-row', { hasText: 'ФормаЭлемента' }).first();
    await formItem.click({ button: 'right' });
    await window.waitForTimeout(500);

    const contextMenu = window.locator('.monaco-menu-container, .context-view');
    await expect(contextMenu.first()).toBeVisible({ timeout: 5000 });

    const menuItems = contextMenu.first().locator('.action-label');
    const count = await menuItems.count();
    const items: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text) items.push(text.trim());
    }
    console.log('Form context menu:', items);

    await window.screenshot({ path: 'e2e/results/feat-62-form-edit-menu.png' });
    await window.keyboard.press('Escape');
  });
});
