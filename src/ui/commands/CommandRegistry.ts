import * as vscode from 'vscode';
import { MetadataTreeProvider } from '../tree/MetadataTreeProvider';
import { MetadataNode } from '../tree/TreeNode';
import { PropertiesViewProvider } from '../views/PropertiesViewProvider';
import { OnecFileSystemProvider } from '../vfs/OnecFileSystemProvider';
import { buildVirtualUri, buildFormModuleVirtualUri } from '../vfs/OnecUriBuilder';
import { SupportInfoService } from '../../infra/support/SupportInfoService';
import { RepoConnectionService } from '../../infra/repo/RepoConnectionService';
import { RepoLockService } from '../../infra/repo/RepoLockService';
import * as path from 'path';
import * as fs from 'fs';
import {
  extractExtensionTarget,
  runCompileExtension,
  runDecompileExtension,
  runUpdateExtension,
} from './ext/ExtensionCommandRunner';
import {
  getCommonCommandModulePath,
  getCommonFormModulePath,
  getCommandModulePathForChild,
  ensureCommonModuleCodePath,
  getCommonModuleCodePath,
  getConstantModulePath,
  getFormModulePathForChild,
  getManagerModulePath,
  getObjectModulePath,
  getServiceModulePath,
} from '../../infra/fs/MetaPathResolver';

type NodeArg = MetadataNode | { xmlPath?: string; nodeKind?: string; label?: string };

interface ActionItem extends vscode.QuickPickItem {
  actionId: 'decompileext' | 'compileext' | 'updateext' | 'compileAndUpdateExt';
}

/**
 * Открывает BSL-модуль и блокирует редактирование для объектов на поддержке.
 *
 * @param ownerXmlPath — путь к XML-файлу объекта-владельца (из дерева).
 *   Используется для проверки поддержки ВМЕСТО обратного ресолва из BSL.
 *   Для onec:// readonly ставится через stat() (permissions).
 *   Для file:// — через setEditorReadonlyInSession.
 */
async function openModule(
  fsp: OnecFileSystemProvider,
  modulePath: string,
  virtualUri: vscode.Uri | null,
  supportService: SupportInfoService | undefined,
  ownerXmlPath: string | undefined,
  preview = true
): Promise<void> {
  const locked = ownerXmlPath ? supportService?.isLocked(ownerXmlPath) : false;
  let editor: vscode.TextEditor;

  const lspMode = vscode.workspace.getConfiguration('v8vscedit.lsp').get<string>('mode', 'bsl-analyzer');
  const useVfs = lspMode === 'built-in';

  if (useVfs && virtualUri) {
    fsp.register(virtualUri, modulePath);
    if (ownerXmlPath) {
      fsp.registerOwnerXml(virtualUri, ownerXmlPath);
    }
    const doc = await vscode.workspace.openTextDocument(virtualUri);
    await vscode.languages.setTextDocumentLanguage(doc, 'bsl');
    editor = await vscode.window.showTextDocument(doc, { preview });
  } else {
    editor = await vscode.window.showTextDocument(vscode.Uri.file(modulePath), { preview });
  }

  if (locked) {
    await setEditorReadonly(editor);
  }
}

/** Помечает активный редактор как readonly в текущей сессии */
async function setEditorReadonly(editor: vscode.TextEditor): Promise<void> {
  await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn });
  await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
}

/**
 * Регистрирует команды расширения и файловый watcher.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  provider: MetadataTreeProvider,
  workspaceFolder: vscode.WorkspaceFolder,
  reloadEntries: () => void,
  propertiesViewProvider: PropertiesViewProvider,
  fsp: OnecFileSystemProvider,
  outputChannel: vscode.OutputChannel,
  supportService?: SupportInfoService,
  repoConnectionService?: RepoConnectionService,
  repoLockService?: RepoLockService
): void {
  // Открыть XML-файл объекта метаданных
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openXmlFile', async (node: { xmlPath?: string }) => {
      if (!node?.xmlPath) { return; }
      const editor = await vscode.window.showTextDocument(
        vscode.Uri.file(node.xmlPath),
        { preview: false }
      );
      if (supportService?.isLocked(node.xmlPath)) {
        await setEditorReadonly(editor);
      }
    })
  );

  // Открыть модуль общего модуля
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openCommonModuleCode', async (node: NodeArg) => {
      const modulePath = getCommonModuleCodePath(node as any) ?? ensureCommonModuleCodePath(node as any);
      if (!modulePath) { return; }
      const xmlPath = (node as any).xmlPath as string | undefined;
      const vUri = xmlPath ? buildVirtualUri(xmlPath, 'module') : null;
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Открыть модуль объекта
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openObjectModule', async (node: NodeArg) => {
      const modulePath = getObjectModulePath(node as any);
      if (!modulePath) { return; }
      const xmlPath = (node as any).xmlPath as string | undefined;
      const vUri = xmlPath ? buildVirtualUri(xmlPath, 'objectModule') : null;
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Открыть модуль менеджера
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openManagerModule', async (node: NodeArg) => {
      const modulePath = getManagerModulePath(node as any);
      if (!modulePath) { return; }
      const xmlPath = (node as any).xmlPath as string | undefined;
      const vUri = xmlPath ? buildVirtualUri(xmlPath, 'managerModule') : null;
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Открыть модуль константы
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openConstantModule', async (node: NodeArg) => {
      const modulePath = getConstantModulePath(node as any);
      if (!modulePath) { return; }
      const xmlPath = (node as any).xmlPath as string | undefined;
      const vUri = xmlPath ? buildVirtualUri(xmlPath, 'valueManagerModule') : null;
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Открыть модуль сервиса (Web/HTTP)
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openServiceModule', async (node: NodeArg) => {
      const modulePath = getServiceModulePath(node as any);
      if (!modulePath) { return; }
      const xmlPath = (node as any).xmlPath as string | undefined;
      const vUri = xmlPath ? buildVirtualUri(xmlPath, 'module') : null;
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Открыть модуль формы (общей или объектной)
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openFormModule', async (node: NodeArg) => {
      const nodeAny = node as any;
      const isCommonForm = nodeAny?.nodeKind === 'CommonForm';
      const modulePath = isCommonForm
        ? getCommonFormModulePath(nodeAny)
        : getFormModulePathForChild(nodeAny);
      if (!modulePath) { return; }

      const xmlPath = nodeAny.xmlPath as string | undefined;
      let vUri: vscode.Uri | null = null;
      if (xmlPath) {
        vUri = isCommonForm
          ? buildVirtualUri(xmlPath, 'module')
          : buildFormModuleVirtualUri(xmlPath, String(nodeAny.label ?? ''));
      }
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Открыть модуль команды (общей или объектной)
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openCommandModule', async (node: NodeArg) => {
      const nodeAny = node as any;
      const isCommonCommand = nodeAny?.nodeKind === 'CommonCommand';
      const modulePath = isCommonCommand
        ? getCommonCommandModulePath(nodeAny)
        : getCommandModulePathForChild(nodeAny);
      if (!modulePath) { return; }

      const xmlPath = nodeAny.xmlPath as string | undefined;
      const vUri = xmlPath ? buildVirtualUri(xmlPath, 'commandModule') : null;
      await openModule(fsp, modulePath, vUri, supportService, xmlPath);
    })
  );

  // Обновить дерево конфигураций
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.refresh', () => {
      reloadEntries();
    })
  );

  // Открыть вкладку свойств для выбранного узла
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'v8vscedit.showProperties',
      (node: MetadataNode | undefined) => {
        if (!node) { return; }
        propertiesViewProvider.show(node);
      }
    )
  );

  // Меню действий над корневой конфигурацией/расширением
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.showConfigActions', async (node: NodeArg) => {
      const nodeKind = node?.nodeKind;
      const xmlPath = node?.xmlPath;
      if (!nodeKind || !xmlPath) {
        return;
      }

      const isExtension = nodeKind === 'extension';
      const targetLabel = String((node as MetadataNode).label ?? '');

      const actions: ActionItem[] = [];
      if (isExtension) {
        actions.push({
          actionId: 'decompileext',
          label: '$(cloud-download) Импортировать',
        });
        actions.push({
          actionId: 'updateext',
          label: '$(sync) Обновить',
        });
        actions.push({
          actionId: 'compileAndUpdateExt',
          label: '$(run-all) Полное обновление',
        });
      }

      if (actions.length === 0) {
        vscode.window.showInformationMessage(`Для "${targetLabel}" пока нет доступных команд.`);
        return;
      }

      const picked = await vscode.window.showQuickPick(actions, {
        title: `Команды: ${targetLabel}`,
        placeHolder: 'Выберите действие',
      });
      if (!picked) {
        return;
      }

      if (picked.actionId === 'decompileext') {
        await vscode.commands.executeCommand(
          'v8vscedit.decompileExtensionSources',
          node
        );
      } else if (picked.actionId === 'updateext') {
        await vscode.commands.executeCommand(
          'v8vscedit.updateExtensionInDb',
          node
        );
      } else if (picked.actionId === 'compileAndUpdateExt') {
        await vscode.commands.executeCommand(
          'v8vscedit.compileAndUpdateExtensionInDb',
          node
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.decompileExtensionSources', async (node: NodeArg) => {
      const target = extractExtensionTarget(node);
      if (!target) {
        vscode.window.showWarningMessage('Команда доступна только для корневого узла расширения.');
        return;
      }

      await runDecompileExtension(target.extensionName, target.extensionRoot, workspaceFolder, outputChannel);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.compileExtensionToDb', async (node: NodeArg) => {
      const target = extractExtensionTarget(node);
      if (!target) {
        vscode.window.showWarningMessage('Команда доступна только для корневого узла расширения.');
        return;
      }

      await runCompileExtension(target.extensionName, target.extensionRoot, workspaceFolder, outputChannel);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.updateExtensionInDb', async (node: NodeArg) => {
      const target = extractExtensionTarget(node);
      if (!target) {
        vscode.window.showWarningMessage('Команда доступна только для корневого узла расширения.');
        return;
      }

      await runUpdateExtension(target.extensionName, target.extensionRoot, workspaceFolder, outputChannel);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.compileAndUpdateExtensionInDb', async (node: NodeArg) => {
      const target = extractExtensionTarget(node);
      if (!target) {
        vscode.window.showWarningMessage('Команда доступна только для корневого узла расширения.');
        return;
      }

      const compiled = await runCompileExtension(
        target.extensionName,
        target.extensionRoot,
        workspaceFolder,
        outputChannel,
        false
      );
      if (!compiled) {
        return;
      }
      const updated = await runUpdateExtension(
        target.extensionName,
        target.extensionRoot,
        workspaceFolder,
        outputChannel,
        false
      );
      if (!updated) {
        return;
      }

      await vscode.window.showInformationMessage(
        `Загрузка и обновление расширения "${target.extensionName}" в БД успешно завершены.`,
        { modal: true }
      );
    })
  );

  // ── Команды хранилища конфигурации ──────────────────────────────────────
  if (repoConnectionService && repoLockService) {
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.connect', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        const settings = await repoConnectionService.promptAndSaveSettings(configRoot);
        if (!settings) { return; }
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Обновление захватов хранилища...' },
          async () => { await repoLockService.refreshLocks(configRoot); provider.refresh(); }
        );
        vscode.window.showInformationMessage('Хранилище подключено.');
      }),
      vscode.commands.registerCommand('v8vscedit.repo.disconnect', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        await repoConnectionService.removeSettings(configRoot);
        repoLockService.invalidate(configRoot);
        provider.refresh();
        vscode.window.showInformationMessage('Хранилище отключено.');
      }),
      vscode.commands.registerCommand('v8vscedit.repo.lock', async (node: NodeArg) => {
        const metaNode = node as MetadataNode;
        const configRoot = metaNode.configRoot;
        if (!configRoot || !metaNode.nodeKind || !metaNode.label) { return; }
        const label = String(metaNode.label);
        const ok = await vscode.window.showInformationMessage(`Захватить "${label}"?`, { modal: true }, 'Захватить');
        if (ok !== 'Захватить') { return; }
        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: `Захват: ${label}...` },
          () => repoLockService.lockObject(configRoot, metaNode.nodeKind, label)
        );
        if (success) { provider.refresh(); vscode.window.showInformationMessage(`"${label}" захвачен.`); }
        else { vscode.window.showErrorMessage(`Не удалось захватить "${label}".`); }
      }),
      vscode.commands.registerCommand('v8vscedit.repo.unlock', async (node: NodeArg) => {
        const metaNode = node as MetadataNode;
        const configRoot = metaNode.configRoot;
        if (!configRoot || !metaNode.nodeKind || !metaNode.label) { return; }
        const label = String(metaNode.label);
        const ok = await vscode.window.showInformationMessage(`Снять захват "${label}"?`, { modal: true }, 'Снять захват');
        if (ok !== 'Снять захват') { return; }
        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: `Снятие захвата: ${label}...` },
          () => repoLockService.unlockObject(configRoot, metaNode.nodeKind, label)
        );
        if (success) { provider.refresh(); vscode.window.showInformationMessage(`Захват "${label}" снят.`); }
        else { vscode.window.showErrorMessage(`Не удалось снять захват "${label}".`); }
      }),
      vscode.commands.registerCommand('v8vscedit.repo.refreshLocks', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Обновление захватов...' },
          () => repoLockService.refreshLocks(configRoot)
        );
        if (success) { provider.refresh(); vscode.window.showInformationMessage('Статус захватов обновлён.'); }
        else { vscode.window.showErrorMessage('Не удалось получить отчёт из хранилища.'); }
      }),
      vscode.commands.registerCommand('v8vscedit.repo.create', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        if (!repoConnectionService.hasSettings(configRoot)) {
          const s = await repoConnectionService.promptAndSaveSettings(configRoot);
          if (!s) { return; }
        }
        const ok = await vscode.window.showWarningMessage('Создать новое хранилище?', { modal: true }, 'Создать');
        if (ok !== 'Создать') { return; }
        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Создание хранилища...' },
          () => repoLockService.createRepository(configRoot)
        );
        if (success) { provider.refresh(); vscode.window.showInformationMessage('Хранилище создано.'); }
        else { vscode.window.showErrorMessage('Не удалось создать хранилище.'); }
      }),
      vscode.commands.registerCommand('v8vscedit.repo.commit', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        const comment = await vscode.window.showInputBox({ title: 'Помещение в хранилище', prompt: 'Комментарий', ignoreFocusOut: true });
        if (comment === undefined) { return; }
        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Помещение в хранилище...' },
          () => repoLockService.commitToRepository(configRoot, comment || undefined)
        );
        if (success) { await repoLockService.refreshLocks(configRoot); provider.refresh(); vscode.window.showInformationMessage('Помещено в хранилище.'); }
        else { vscode.window.showErrorMessage('Не удалось поместить в хранилище.'); }
      }),
      vscode.commands.registerCommand('v8vscedit.repo.updateCfg', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        const ok = await vscode.window.showInformationMessage('Получить из хранилища?', { modal: true }, 'Получить');
        if (ok !== 'Получить') { return; }
        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Получение из хранилища...' },
          () => repoLockService.updateFromRepository(configRoot)
        );
        if (success) { await repoLockService.refreshLocks(configRoot); provider.refresh(); vscode.window.showInformationMessage('Конфигурация обновлена.'); }
        else { vscode.window.showErrorMessage('Не удалось получить из хранилища.'); }
      }),
      vscode.commands.registerCommand('v8vscedit.repo.history', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }
        const report = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'История хранилища...' },
          () => repoLockService.getHistory(configRoot)
        );
        if (report) {
          const doc = await vscode.workspace.openTextDocument({ content: report, language: 'plaintext' });
          await vscode.window.showTextDocument(doc, { preview: true });
        } else { vscode.window.showErrorMessage('Не удалось получить историю.'); }
      }),
    );
  }

  // FileSystemWatcher — перестраиваем дерево при изменении Configuration.xml
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, '**/Configuration.xml'),
    false,
    false,
    false
  );

  const onConfigChange = () => { reloadEntries(); };
  watcher.onDidCreate(onConfigChange, null, context.subscriptions);
  watcher.onDidDelete(onConfigChange, null, context.subscriptions);
  watcher.onDidChange(onConfigChange, null, context.subscriptions);
  context.subscriptions.push(watcher);
}

function extractConfigRoot(node: NodeArg): string | null {
  const metaNode = node as MetadataNode;
  if (metaNode.configRoot) { return metaNode.configRoot; }
  const xmlPath = node?.xmlPath;
  if (!xmlPath) { return null; }
  return path.dirname(xmlPath);
}
