import * as vscode from 'vscode';
import { findConfigurations } from './ConfigFinder';
import { MetadataTreeProvider } from './MetadataTreeProvider';
import { registerCommands } from './CommandRegistry';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspaceFolder = workspaceFolders[0];
  const rootPath = workspaceFolder.uri.fsPath;

  const provider = new MetadataTreeProvider([], context.extensionUri);

  const treeView = vscode.window.createTreeView('1cMetadataTree', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  const reloadEntries = () => {
    findConfigurations(rootPath).then((entries) => {
      provider.updateEntries(entries);
    });
  };

  registerCommands(context, provider, workspaceFolder, reloadEntries);

  reloadEntries();
}

export function deactivate(): void {
  // Все ресурсы освобождаются через context.subscriptions.
}
