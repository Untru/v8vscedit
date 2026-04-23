/**
 * Helpers for launching VS Code as Electron app via Playwright.
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface LaunchOptions {
  workspacePath: string;
  extraArgs?: string[];
}

// Selector scoped to the sidebar tree (not notifications or other panels)
const SIDEBAR = '.sidebar .split-view-view';
const TREE_ROW = `${SIDEBAR} .monaco-list-row`;

export async function launchVSCode(opts: LaunchOptions): Promise<{
  app: ElectronApplication;
  window: Page;
}> {
  const vscodePath = await downloadAndUnzipVSCode();

  const extensionDevPath = path.resolve(__dirname, '..');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-e2e-'));
  const extensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-e2e-ext-'));

  const args = [
    `--extensionDevelopmentPath=${extensionDevPath}`,
    `--user-data-dir=${userDataDir}`,
    `--extensions-dir=${extensionsDir}`,
    '--disable-gpu',
    '--new-window',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-telemetry',
    '--disable-workspace-trust',
    opts.workspacePath,
    ...(opts.extraArgs || []),
  ];

  const app = await electron.launch({
    executablePath: vscodePath,
    args,
    timeout: 30_000,
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000);

  // Dismiss any notification toasts
  await dismissNotifications(window);

  return { app, window };
}

/**
 * Dismiss all visible notification toasts.
 */
export async function dismissNotifications(window: Page): Promise<void> {
  const closeButtons = window.locator('.notifications-toasts .codicon-notifications-clear');
  const count = await closeButtons.count();
  for (let i = count - 1; i >= 0; i--) {
    await closeButtons.nth(i).click().catch(() => {});
  }
  // Also try clicking "Never" on Git notification
  const neverBtn = window.locator('.notification-toast button', { hasText: 'Never' });
  if (await neverBtn.count() > 0) {
    await neverBtn.first().click().catch(() => {});
  }
  // Close bsl-analyzer notification if present
  const cancelBtn = window.locator('.notification-toast button', { hasText: 'Cancel' });
  if (await cancelBtn.count() > 0) {
    await cancelBtn.first().click().catch(() => {});
  }
  await window.waitForTimeout(500);
}

/**
 * Open the "Редактор 1С" sidebar panel.
 */
export async function openExtensionSidebar(window: Page): Promise<void> {
  const allIcons = window.locator('.activitybar .action-item .action-label');
  const count = await allIcons.count();
  for (let i = 0; i < count; i++) {
    const title = await allIcons.nth(i).getAttribute('aria-label');
    if (title && title.includes('Редактор 1С')) {
      await allIcons.nth(i).click();
      break;
    }
  }
  await window.waitForTimeout(1000);
}

/**
 * Execute a VS Code command via the command palette.
 */
export async function runCommand(window: Page, command: string): Promise<void> {
  await window.keyboard.press('Control+Shift+P');
  await window.waitForSelector('.quick-input-widget', { timeout: 5000 });
  await window.keyboard.type(command);
  await window.waitForTimeout(500);
  await window.keyboard.press('Enter');
}

/**
 * Get all visible tree item labels from the sidebar tree only.
 */
export async function getTreeItemLabels(window: Page): Promise<string[]> {
  const items = window.locator(TREE_ROW);
  const count = await items.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).textContent();
    if (text) labels.push(text.trim());
  }
  return labels;
}

/**
 * Click a tree item in the sidebar by label.
 */
export async function clickTreeItem(window: Page, label: string): Promise<void> {
  const item = window.locator(TREE_ROW, { hasText: label }).first();
  await item.click();
}

/**
 * Double-click a tree item to expand it.
 */
export async function expandTreeItem(window: Page, label: string): Promise<void> {
  const item = window.locator(TREE_ROW, { hasText: label }).first();
  // Click the row to select it
  await item.click();
  await window.waitForTimeout(200);
  // Press Right Arrow to expand (reliable in VS Code tree views)
  await window.keyboard.press('ArrowRight');
  await window.waitForTimeout(500);
}
