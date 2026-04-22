import * as path from 'path';
import * as vscode from 'vscode';
import { findConfigurations } from './ConfigFinder';
import { MetadataTreeProvider } from './MetadataTreeProvider';
import { registerCommands } from './CommandRegistry';
import { PropertiesViewProvider } from './views/PropertiesViewProvider';
import { OnecFileSystemProvider, ONEC_SCHEME } from './OnecFileSystemProvider';
import { SupportInfoService } from './services/SupportInfoService';
import { SupportDecorationProvider } from './services/SupportDecorationProvider';
import { LspManager } from './services/LspManager';
import { FormEditorProvider } from './formEditor/FormEditorProvider';
import { RepoConnectionService } from './services/RepoConnectionService';
import { RepoLockService } from './services/RepoLockService';
import { searchInModules } from './services/ModuleSearchService';

let lspManager: LspManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspaceFolder = workspaceFolders[0];
  const rootPath = workspaceFolder.uri.fsPath;

  // ── Канал логирования ───────────────────────────────────────────────────
  const outputChannel = vscode.window.createOutputChannel('1С Редактор');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('[init] Расширение активировано');

  // ── Сервис поддержки 1С ─────────────────────────────────────────────────
  const supportService = new SupportInfoService(outputChannel);

  // ── Декорации поддержки в дереве ────────────────────────────────────────
  const decorationProvider = new SupportDecorationProvider();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider),
    decorationProvider
  );

  // Watcher: при изменении ParentConfigurations.bin сбрасываем кэш и обновляем дерево
  const supportWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, '**/Ext/ParentConfigurations.bin'),
    false,
    false,
    false
  );
  const onSupportFileChange = (uri: vscode.Uri) => {
    const extDir = path.dirname(uri.fsPath);
    const configRoot = path.dirname(extDir);
    supportService.invalidate(configRoot);
    supportService.loadConfig(configRoot);
    provider.refresh();
    decorationProvider.fireRefresh();
  };
  const onSupportFileDelete = (uri: vscode.Uri) => {
    const extDir = path.dirname(uri.fsPath);
    const configRoot = path.dirname(extDir);
    supportService.invalidate(configRoot);
    provider.refresh();
    decorationProvider.fireRefresh();
  };
  supportWatcher.onDidCreate(onSupportFileChange, null, context.subscriptions);
  supportWatcher.onDidChange(onSupportFileChange, null, context.subscriptions);
  supportWatcher.onDidDelete(onSupportFileDelete, null, context.subscriptions);
  context.subscriptions.push(supportWatcher);

  // ── Виртуальная файловая система onec:// ────────────────────────────────
  const fsp = new OnecFileSystemProvider();
  fsp.setSupportService(supportService);
  fsp.setOutputChannel(outputChannel);
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(ONEC_SCHEME, fsp, {
      isCaseSensitive: false,
      isReadonly: false,
    })
  );

  // ── Сервис хранилища конфигурации ────────────────────────────────────────
  const repoConnectionService = new RepoConnectionService(context.secrets);
  const repoLockService = new RepoLockService(repoConnectionService, outputChannel);

  // ── Навигатор метаданных ────────────────────────────────────────────────
  const provider = new MetadataTreeProvider([], context.extensionUri, supportService, repoLockService);
  const propertiesViewProvider = new PropertiesViewProvider();
  context.subscriptions.push(propertiesViewProvider);

  const treeView = vscode.window.createTreeView('v8vsceditTree', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const reloadEntries = () => {
    findConfigurations(rootPath).then((entries) => {
      provider.updateEntries(entries);
      outputChannel.appendLine(`[init] Найдено конфигураций: ${entries.length}`);
    });
  };

  registerCommands(
    context,
    provider,
    workspaceFolder,
    reloadEntries,
    propertiesViewProvider,
    fsp,
    outputChannel,
    supportService,
    repoConnectionService,
    repoLockService
  );

  // ── Readonly для BSL-файлов, открытых напрямую из ФС (схема file://) ───
  // Для onec:// readonly обеспечивается через stat() → permissions.
  // Для file:// нужно явно переключать editor в readonly-режим.
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (doc) => {
      if (doc.uri.scheme !== 'file') { return; }
      if (!doc.fileName.toLowerCase().endsWith('.bsl')) { return; }
      if (!supportService.isLocked(doc.fileName)) { return; }

      outputChannel.appendLine(`[readonly] Блокировка file:// BSL: ${path.basename(doc.fileName)}`);

      // Ждём, когда VS Code покажет редактор для этого документа
      const disposable = vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
        const editor = editors.find(
          (e) => e.document.uri.toString() === doc.uri.toString()
        );
        if (!editor) { return; }
        disposable.dispose();
        await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      });
      // Очистка через 5с если редактор так и не появился
      setTimeout(() => disposable.dispose(), 5000);
    })
  );

  // Команды-индикаторы поддержки (inline-кнопки в дереве)
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.support.none', () => {
      vscode.window.showInformationMessage('Объект не на поддержке.');
    }),
    vscode.commands.registerCommand('v8vscedit.support.editable', () => {
      vscode.window.showInformationMessage('Объект на поддержке. Редактирование разрешено.');
    }),
    vscode.commands.registerCommand('v8vscedit.support.locked', () => {
      vscode.window.showWarningMessage('Объект на поддержке. Редактирование запрещено.');
    }),
  );

  // ── Визуальный редактор форм ─────────────────────────────────────────────
  context.subscriptions.push(FormEditorProvider.register(context));

  // Команды-индикаторы хранилища (inline-кнопки в дереве)
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.repo.status.free', () => {
      vscode.window.showInformationMessage('Объект свободен в хранилище.');
    }),
    vscode.commands.registerCommand('v8vscedit.repo.status.lockedByMe', () => {
      vscode.window.showInformationMessage('Объект захвачен вами.');
    }),
    vscode.commands.registerCommand('v8vscedit.repo.status.lockedByOther', (node: any) => {
      const info = node?.configRoot
        ? repoLockService.getLockInfo(node.configRoot, node.nodeKind, String(node.label ?? ''))
        : undefined;
      const who = info?.lockedBy ? ` пользователем "${info.lockedBy}"` : '';
      vscode.window.showWarningMessage(`Объект захвачен${who} в хранилище.`);
    }),
  );

  reloadEntries();

  // ── Глобальный поиск по модулям ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.searchInModules', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Поиск по всем BSL-модулям конфигурации',
        placeHolder: 'Введите текст для поиска...',
      });
      if (!query) return;

      const results = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Поиск по модулям...' },
        () => searchInModules(query, [rootPath])
      );

      if (results.length === 0) {
        vscode.window.showInformationMessage(`Ничего не найдено: "${query}"`);
        return;
      }

      // Показываем результаты через Quick Pick с группировкой
      const items = results.map(r => ({
        label: `$(symbol-method) ${r.lineText.trim()}`,
        description: `${r.objectName} · ${r.moduleType}`,
        detail: `Строка ${r.line + 1}`,
        result: r,
      }));

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `Найдено ${results.length} результатов для "${query}"`,
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (picked) {
        const doc = await vscode.workspace.openTextDocument(picked.result.filePath);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(picked.result.line, picked.result.column);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    })
  );

  // ── Языковой сервер BSL (переключаемый) ────────────────────────────────
  lspManager = new LspManager(context, outputChannel, ONEC_SCHEME);
  lspManager.registerCommands();
  lspManager.startWithAutoUpdate();
}

export function deactivate(): Promise<void> | undefined {
  return lspManager?.stop();
}
