import * as vscode from 'vscode';
import * as path from 'path';
import { findConfigurations } from './ConfigFinder';
import { MetadataTreeProvider } from './MetadataTreeProvider';

let provider: MetadataTreeProvider | undefined;
let watcher: vscode.FileSystemWatcher | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  // Ищем все Configuration.xml в workspace
  const entries = await findConfigurations(rootPath);

  provider = new MetadataTreeProvider(entries, context.extensionUri);

  // Регистрируем TreeView
  const treeView = vscode.window.createTreeView('1cMetadataTree', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Команда: открыть XML-файл
  context.subscriptions.push(
    vscode.commands.registerCommand('1cNavigator.openFile', (xmlPath: string) => {
      if (!xmlPath) {
        return;
      }
      const uri = vscode.Uri.file(xmlPath);
      vscode.window.showTextDocument(uri, { preview: true });
    })
  );

  // Команда: обновить дерево
  context.subscriptions.push(
    vscode.commands.registerCommand('1cNavigator.refresh', async () => {
      if (!provider) {
        return;
      }
      const newEntries = await findConfigurations(rootPath);
      provider.updateEntries(newEntries);
    })
  );

  // FileSystemWatcher — перестраиваем дерево при изменении Configuration.xml
  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolders[0], '**/Configuration.xml'),
    false,
    false,
    false
  );

  const onConfigChange = async () => {
    if (!provider) {
      return;
    }
    const newEntries = await findConfigurations(rootPath);
    provider.updateEntries(newEntries);
  };

  watcher.onDidCreate(onConfigChange, null, context.subscriptions);
  watcher.onDidDelete(onConfigChange, null, context.subscriptions);
  watcher.onDidChange(onConfigChange, null, context.subscriptions);
  context.subscriptions.push(watcher);
}

export function deactivate(): void {
  watcher?.dispose();
}
