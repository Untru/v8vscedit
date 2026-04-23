import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { decode } from 'iconv-lite';
import { MetadataTreeProvider, MetadataQuickPickItem } from './MetadataTreeProvider';
import { MetadataNode } from './MetadataNode';
import { PropertiesViewProvider } from './views/PropertiesViewProvider';
import { OnecFileSystemProvider } from './OnecFileSystemProvider';
import { buildVirtualUri, buildFormModuleVirtualUri } from './OnecUriBuilder';
import { SupportInfoService } from './services/SupportInfoService';
import { RepoConnectionService } from './services/RepoConnectionService';
import { RepoLockService } from './services/RepoLockService';
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
} from './ModulePathResolver';

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
      const targetRoot = path.dirname(xmlPath);

      const actions: ActionItem[] = [];
      if (isExtension) {
        actions.push({
          actionId: 'decompileext',
          label: '$(export) Выгрузить исходники расширения',
          description: 'vrunner decompileext',
        });
        actions.push({
          actionId: 'compileext',
          label: '$(database) Загрузить расширение в БД',
          description: 'vrunner compileext',
        });
        actions.push({
          actionId: 'updateext',
          label: '$(sync) Обновить расширение в БД',
          description: 'vrunner updateext',
        });
        actions.push({
          actionId: 'compileAndUpdateExt',
          label: '$(run-all) Загрузить и обновить расширение в БД',
          description: 'vrunner compileext + updateext',
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
      } else if (picked.actionId === 'compileext') {
        await vscode.commands.executeCommand(
          'v8vscedit.compileExtensionToDb',
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
    // Подключить к хранилищу
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.connect', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        const settings = await repoConnectionService.promptAndSaveSettings(configRoot);
        if (!settings) { return; }

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Обновление захватов хранилища...' },
          async () => {
            await repoLockService.refreshLocks(configRoot);
            provider.refresh();
          }
        );

        vscode.window.showInformationMessage('Хранилище подключено. Статус захватов обновлён.');
      })
    );

    // Отключить от хранилища
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.disconnect', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        await repoConnectionService.removeSettings(configRoot);
        repoLockService.invalidate(configRoot);
        provider.refresh();
        vscode.window.showInformationMessage('Хранилище отключено.');
      })
    );

    // Захватить объект
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.lock', async (node: NodeArg) => {
        const metaNode = node as MetadataNode;
        const configRoot = metaNode.configRoot;
        if (!configRoot || !metaNode.nodeKind || !metaNode.label) { return; }

        const label = String(metaNode.label);
        const confirmed = await vscode.window.showInformationMessage(
          `Захватить "${label}" в хранилище?`,
          { modal: true },
          'Захватить'
        );
        if (confirmed !== 'Захватить') { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: `Захват: ${label}...` },
          () => repoLockService.lockObject(configRoot, metaNode.nodeKind, label)
        );

        if (success) {
          provider.refresh();
          vscode.window.showInformationMessage(`"${label}" захвачен.`);
        } else {
          vscode.window.showErrorMessage(`Не удалось захватить "${label}". Подробности в канале вывода.`);
        }
      })
    );

    // Снять захват
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.unlock', async (node: NodeArg) => {
        const metaNode = node as MetadataNode;
        const configRoot = metaNode.configRoot;
        if (!configRoot || !metaNode.nodeKind || !metaNode.label) { return; }

        const label = String(metaNode.label);
        const confirmed = await vscode.window.showInformationMessage(
          `Снять захват "${label}" в хранилище?`,
          { modal: true },
          'Снять захват'
        );
        if (confirmed !== 'Снять захват') { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: `Снятие захвата: ${label}...` },
          () => repoLockService.unlockObject(configRoot, metaNode.nodeKind, label)
        );

        if (success) {
          provider.refresh();
          vscode.window.showInformationMessage(`Захват "${label}" снят.`);
        } else {
          vscode.window.showErrorMessage(`Не удалось снять захват "${label}". Подробности в канале вывода.`);
        }
      })
    );

    // Обновить статус захватов
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.refreshLocks', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Обновление захватов хранилища...' },
          () => repoLockService.refreshLocks(configRoot)
        );

        if (success) {
          provider.refresh();
          vscode.window.showInformationMessage('Статус захватов обновлён.');
        } else {
          vscode.window.showErrorMessage('Не удалось получить отчёт из хранилища. Подробности в канале вывода.');
        }
      })
    );

    // Создать хранилище
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.create', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        if (!repoConnectionService.hasSettings(configRoot)) {
          const settings = await repoConnectionService.promptAndSaveSettings(configRoot);
          if (!settings) { return; }
        }

        const confirmed = await vscode.window.showWarningMessage(
          'Создать новое хранилище конфигурации? Текущая конфигурация базы будет помещена как начальная версия.',
          { modal: true },
          'Создать'
        );
        if (confirmed !== 'Создать') { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Создание хранилища...' },
          () => repoLockService.createRepository(configRoot)
        );

        if (success) {
          provider.refresh();
          vscode.window.showInformationMessage('Хранилище конфигурации создано.');
        } else {
          vscode.window.showErrorMessage('Не удалось создать хранилище. Подробности в канале вывода.');
        }
      })
    );

    // Поместить в хранилище (commit)
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.commit', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        const comment = await vscode.window.showInputBox({
          title: 'Помещение в хранилище',
          prompt: 'Комментарий к версии (необязательно)',
          placeHolder: 'Описание изменений...',
          ignoreFocusOut: true,
        });
        if (comment === undefined) { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Помещение в хранилище...' },
          () => repoLockService.commitToRepository(configRoot, comment || undefined)
        );

        if (success) {
          await repoLockService.refreshLocks(configRoot);
          provider.refresh();
          vscode.window.showInformationMessage('Изменения помещены в хранилище.');
        } else {
          vscode.window.showErrorMessage('Не удалось поместить в хранилище. Подробности в канале вывода.');
        }
      })
    );

    // Получить из хранилища (update)
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.updateCfg', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        const confirmed = await vscode.window.showInformationMessage(
          'Получить конфигурацию из хранилища? Текущая конфигурация БД будет обновлена.',
          { modal: true },
          'Получить'
        );
        if (confirmed !== 'Получить') { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Получение из хранилища...' },
          () => repoLockService.updateFromRepository(configRoot)
        );

        if (success) {
          await repoLockService.refreshLocks(configRoot);
          provider.refresh();
          vscode.window.showInformationMessage('Конфигурация обновлена из хранилища.');
        } else {
          vscode.window.showErrorMessage('Не удалось получить из хранилища. Подробности в канале вывода.');
        }
      })
    );

    // Добавить пользователя хранилища
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.addUser', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        const userName = await vscode.window.showInputBox({
          title: 'Добавление пользователя хранилища',
          prompt: 'Имя нового пользователя',
          ignoreFocusOut: true,
        });
        if (!userName) { return; }

        const userPassword = await vscode.window.showInputBox({
          title: 'Добавление пользователя хранилища',
          prompt: `Пароль для "${userName}"`,
          password: true,
          ignoreFocusOut: true,
        });
        if (userPassword === undefined) { return; }

        interface RightsItem extends vscode.QuickPickItem { rightsId: 'ReadOnly' | 'LockObjects' | 'ManageConfigurationVersions' | 'Administration'; }
        const rightsOptions: RightsItem[] = [
          { label: 'Захват объектов', description: 'LockObjects', rightsId: 'LockObjects' },
          { label: 'Только чтение', description: 'ReadOnly', rightsId: 'ReadOnly' },
          { label: 'Управление версиями', description: 'ManageConfigurationVersions', rightsId: 'ManageConfigurationVersions' },
          { label: 'Администрирование', description: 'Administration', rightsId: 'Administration' },
        ];
        const pickedRights = await vscode.window.showQuickPick(rightsOptions, {
          title: 'Права пользователя',
          placeHolder: 'Выберите уровень прав',
        });
        if (!pickedRights) { return; }

        const success = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: `Добавление пользователя "${userName}"...` },
          () => repoLockService.addUser(configRoot, userName, userPassword, pickedRights.rightsId)
        );

        if (success) {
          vscode.window.showInformationMessage(`Пользователь "${userName}" добавлен в хранилище.`);
        } else {
          vscode.window.showErrorMessage(`Не удалось добавить пользователя. Подробности в канале вывода.`);
        }
      })
    );

    // История хранилища
    context.subscriptions.push(
      vscode.commands.registerCommand('v8vscedit.repo.history', async (node: NodeArg) => {
        const configRoot = extractConfigRoot(node);
        if (!configRoot) { return; }

        const report = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Получение истории хранилища...' },
          () => repoLockService.getHistory(configRoot)
        );

        if (report) {
          const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'plaintext',
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        } else {
          vscode.window.showErrorMessage('Не удалось получить историю хранилища. Подробности в канале вывода.');
        }
      })
    );
  }

  // Quick Pick поиск по метаданным (Ctrl+Alt+M)
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.searchMetadata', async () => {
      const items = provider.getAllMetadataItems();
      if (items.length === 0) {
        vscode.window.showInformationMessage('Нет загруженных конфигураций.');
        return;
      }

      const picked = await vscode.window.showQuickPick(items, {
        title: 'Поиск объекта метаданных',
        placeHolder: 'Введите имя объекта...',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!picked) { return; }

      // Построить путь к XML-файлу объекта
      const folderName = META_FOLDER_NAMES[picked.metaType];
      if (!folderName) { return; }

      const xmlPath = path.join(
        picked.configRoot,
        folderName,
        picked.metaName,
        `${picked.metaName}.xml`
      );

      if (fs.existsSync(xmlPath)) {
        const editor = await vscode.window.showTextDocument(
          vscode.Uri.file(xmlPath),
          { preview: false }
        );
        if (supportService?.isLocked(xmlPath)) {
          await setEditorReadonly(editor);
        }
      } else {
        vscode.window.showWarningMessage(`Файл не найден: ${xmlPath}`);
      }
    })
  );

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

async function runDecompileExtension(
  extensionName: string,
  extensionRoot: string,
  workspaceFolder: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel
): Promise<boolean> {
  const targetDir = extensionRoot;
  const settingsPath = resolveSettingsPath(workspaceFolder.uri.fsPath, extensionRoot);
  const commandArgs = ['decompileext', extensionName, targetDir, '--settings', settingsPath];
  return runVrunnerExtensionCommand(
    {
      extensionName,
      commandArgs,
      progressTitle: `Выгрузка расширения ${extensionName}`,
      progressStartMessage: 'Запуск decompileext...',
      successMessage: `Выгрузка расширения "${extensionName}" успешно завершена.`,
      errorTitle: `Ошибка выгрузки расширения "${extensionName}".`,
      logPrefix: 'decompileext',
    },
    workspaceFolder,
    outputChannel
  );
}

async function runCompileExtension(
  extensionName: string,
  extensionRoot: string,
  workspaceFolder: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel,
  showSuccessModal = true
): Promise<boolean> {
  const targetDir = extensionRoot;
  const settingsPath = resolveSettingsPath(workspaceFolder.uri.fsPath, extensionRoot);
  const commandArgs = ['compileext', targetDir, extensionName, '--settings', settingsPath];
  return runVrunnerExtensionCommand(
    {
      extensionName,
      commandArgs,
      progressTitle: `Загрузка расширения ${extensionName} в БД`,
      progressStartMessage: 'Запуск compileext...',
      successMessage: `Загрузка расширения "${extensionName}" в БД успешно завершена.`,
      errorTitle: `Ошибка загрузки расширения "${extensionName}" в БД.`,
      logPrefix: 'compileext',
      showSuccessModal,
    },
    workspaceFolder,
    outputChannel
  );
}

async function runUpdateExtension(
  extensionName: string,
  extensionRoot: string,
  workspaceFolder: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel,
  showSuccessModal = true
): Promise<boolean> {
  const settingsPath = resolveSettingsPath(workspaceFolder.uri.fsPath, extensionRoot);
  const commandArgs = ['updateext', extensionName, '--settings', settingsPath];
  return runVrunnerExtensionCommand(
    {
      extensionName,
      commandArgs,
      progressTitle: `Обновление расширения ${extensionName} в БД`,
      progressStartMessage: 'Запуск updateext...',
      successMessage: `Обновление расширения "${extensionName}" в БД успешно завершено.`,
      errorTitle: `Ошибка обновления расширения "${extensionName}" в БД.`,
      logPrefix: 'updateext',
      showSuccessModal,
    },
    workspaceFolder,
    outputChannel
  );
}

interface RunVrunnerOptions {
  extensionName: string;
  commandArgs: string[];
  progressTitle: string;
  progressStartMessage: string;
  successMessage: string;
  errorTitle: string;
  logPrefix: string;
  showSuccessModal?: boolean;
}

async function runVrunnerExtensionCommand(
  options: RunVrunnerOptions,
  workspaceFolder: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel
): Promise<boolean> {
  const commandAsText = `vrunner ${options.commandArgs.join(' ')}`;
  outputChannel.appendLine(`[actions] Старт: ${commandAsText}`);

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: options.progressTitle,
        cancellable: false,
      },
      (progress) =>
        new Promise<void>((resolve, reject) => {
          progress.report({ message: options.progressStartMessage });
          const child = spawn('vrunner', options.commandArgs, {
            cwd: workspaceFolder.uri.fsPath,
            shell: true,
          });

          let finished = false;
          let lastStdout = '';
          let lastStderr = '';

          const finalizeSuccess = () => {
            if (finished) {
              return;
            }
            finished = true;
            resolve();
          };

          const finalizeError = (message: string) => {
            if (finished) {
              return;
            }
            finished = true;
            reject(new Error(message));
          };

          child.stdout.on('data', (chunk: Buffer) => {
            const text = decodeProcessOutput(chunk).trim();
            if (text.length > 0) {
              lastStdout = text;
              outputChannel.appendLine(`[${options.logPrefix}] ${text}`);
              progress.report({ message: trimStatusMessage(text) });
            }
          });

          child.stderr.on('data', (chunk: Buffer) => {
            const text = decodeProcessOutput(chunk).trim();
            if (text.length > 0) {
              lastStderr = text;
              outputChannel.appendLine(`[${options.logPrefix}][stderr] ${text}`);
              progress.report({ message: trimStatusMessage(`stderr: ${text}`) });
            }
          });

          child.on('error', (err) => {
            finalizeError(`Не удалось запустить vrunner: ${err.message}`);
          });

          child.on('close', (code) => {
            if (code === 0) {
              finalizeSuccess();
              return;
            }

            const details = [lastStderr, lastStdout].filter(Boolean).join('\n');
            const suffix = details ? `\n\n${details}` : '';
            finalizeError(`Команда завершилась с кодом ${code ?? 'null'}.${suffix}`);
          });
        })
    );

    outputChannel.appendLine(`[actions] Завершено: ${commandAsText}`);
    if (options.showSuccessModal !== false) {
      await vscode.window.showInformationMessage(options.successMessage, { modal: true });
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[actions][error] ${message}`);
    await vscode.window.showErrorMessage(`${options.errorTitle}\n${message}`, { modal: true });
    return false;
  }
}

function extractConfigRoot(node: NodeArg): string | null {
  const metaNode = node as MetadataNode;
  if (metaNode.configRoot) { return metaNode.configRoot; }
  const xmlPath = node?.xmlPath;
  if (!xmlPath) { return null; }
  return path.dirname(xmlPath);
}

function extractExtensionTarget(node: NodeArg): { extensionName: string; extensionRoot: string } | null {
  const nodeKind = node?.nodeKind;
  const xmlPath = node?.xmlPath;
  const extensionName = String((node as MetadataNode | undefined)?.label ?? '');
  if (nodeKind !== 'extension' || !xmlPath || !extensionName) {
    return null;
  }
  return {
    extensionName,
    extensionRoot: path.dirname(xmlPath),
  };
}

function trimStatusMessage(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 80) {
    return oneLine;
  }
  return `${oneLine.slice(0, 77)}...`;
}

/**
 * Нормализует кодировку вывода внешней команды.
 * На Windows консольные утилиты часто пишут в OEM-866 вместо UTF-8.
 */
function decodeProcessOutput(chunk: Buffer): string {
  const utf8Text = chunk.toString('utf-8');
  if (process.platform !== 'win32') {
    return utf8Text;
  }

  // Если UTF-8 уже корректен, оставляем как есть.
  if (!utf8Text.includes('�')) {
    return utf8Text;
  }

  const cp866Text = decode(chunk, 'cp866');
  const cp1251Text = decode(chunk, 'win1251');
  return pickMostReadableText([cp866Text, cp1251Text, utf8Text]);
}

/** Выбирает вариант строки с наибольшим числом кириллических символов. */
function pickMostReadableText(candidates: string[]): string {
  let best = candidates[0] ?? '';
  let bestScore = -1;

  for (const candidate of candidates) {
    const cyr = (candidate.match(/[А-Яа-яЁё]/g) ?? []).length;
    const replacement = (candidate.match(/�/g) ?? []).length;
    const score = cyr * 2 - replacement * 3;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Подбирает корректный абсолютный путь к env.json.
 * Нужен, чтобы избежать дубля "example/example" при разных корнях workspace.
 */
/** Маппинг типа объекта → имя папки в XML-выгрузке */
const META_FOLDER_NAMES: Record<string, string> = {
  Subsystem: 'Subsystems',
  CommonModule: 'CommonModules',
  Role: 'Roles',
  CommonForm: 'CommonForms',
  CommonCommand: 'CommonCommands',
  CommandGroup: 'CommandGroups',
  CommonPicture: 'CommonPictures',
  CommonTemplate: 'CommonTemplates',
  XDTOPackage: 'XDTOPackages',
  StyleItem: 'StyleItems',
  DefinedType: 'DefinedTypes',
  Constant: 'Constants',
  Catalog: 'Catalogs',
  Document: 'Documents',
  DocumentNumerator: 'DocumentNumerators',
  Enum: 'Enums',
  InformationRegister: 'InformationRegisters',
  AccumulationRegister: 'AccumulationRegisters',
  AccountingRegister: 'AccountingRegisters',
  CalculationRegister: 'CalculationRegisters',
  Report: 'Reports',
  DataProcessor: 'DataProcessors',
  BusinessProcess: 'BusinessProcesses',
  Task: 'Tasks',
  ExchangePlan: 'ExchangePlans',
  ChartOfCharacteristicTypes: 'ChartsOfCharacteristicTypes',
  ChartOfAccounts: 'ChartsOfAccounts',
  ChartOfCalculationTypes: 'ChartsOfCalculationTypes',
  DocumentJournal: 'DocumentJournals',
  ScheduledJob: 'ScheduledJobs',
  EventSubscription: 'EventSubscriptions',
  HTTPService: 'HTTPServices',
  WebService: 'WebServices',
  FilterCriterion: 'FilterCriteria',
  Sequence: 'Sequences',
  SessionParameter: 'SessionParameters',
  CommonAttribute: 'CommonAttributes',
  FunctionalOption: 'FunctionalOptions',
  FunctionalOptionsParameter: 'FunctionalOptionsParameters',
  SettingsStorage: 'SettingsStorages',
  Style: 'Styles',
  WSReference: 'WSReferences',
  WebSocketClient: 'WebSocketClients',
  IntegrationService: 'IntegrationServices',
  Bot: 'Bots',
  ExternalDataSource: 'ExternalDataSources',
};

function resolveSettingsPath(workspaceRoot: string, extensionRoot: string): string {
  const extensionParent = path.dirname(extensionRoot);
  const extensionGrandParent = path.dirname(extensionParent);

  const candidates = [
    path.join(workspaceRoot, 'example', 'env.json'),
    path.join(workspaceRoot, 'env.json'),
    path.join(extensionGrandParent, 'env.json'),
    path.join(extensionParent, 'env.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}
