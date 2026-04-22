/**
 * CustomReadonlyEditorProvider для визуального отображения форм 1С.
 * Открывает Form.xml в webview с тремя панелями: дерево, превью, свойства.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseFormXml } from './FormXmlParser';

export class FormEditorProvider implements vscode.CustomReadonlyEditorProvider {
  static readonly viewType = 'v8vscedit.formEditor';

  constructor(private readonly extensionUri: vscode.Uri) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new FormEditorProvider(context.extensionUri);
    return vscode.window.registerCustomEditorProvider(
      FormEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  openCustomDocument(
    uri: vscode.Uri
  ): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Парсим Form.xml и отправляем модель в webview
    this.loadAndSendForm(document.uri, webviewPanel.webview);

    // Следим за изменениями файла
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.Uri.file(document.uri.fsPath.replace(/[/\\][^/\\]+$/, '')),
        '*.xml'
      )
    );
    const reload = () => this.loadAndSendForm(document.uri, webviewPanel.webview);
    watcher.onDidChange(reload);
    webviewPanel.onDidDispose(() => watcher.dispose());
  }

  private loadAndSendForm(uri: vscode.Uri, webview: vscode.Webview): void {
    try {
      const xmlContent = fs.readFileSync(uri.fsPath, 'utf-8');
      const model = parseFormXml(xmlContent);
      webview.postMessage({ type: 'formLoaded', model });
    } catch (err) {
      webview.postMessage({
        type: 'error',
        message: `Ошибка при парсинге формы: ${err}`,
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'formEditor.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'formEditor.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Визуальный редактор формы</title>
</head>
<body>
  <div class="form-editor">
    <div class="panel element-tree-panel">
      <div class="panel-header">Элементы</div>
      <div class="panel-body" id="tree-body"></div>
    </div>
    <div class="panel form-preview-panel">
      <div class="panel-header">Превью формы</div>
      <div class="panel-body" id="preview-body"></div>
    </div>
    <div class="panel property-panel">
      <div class="panel-header">Свойства</div>
      <div class="panel-body" id="property-body"></div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
