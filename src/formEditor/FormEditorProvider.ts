/**
 * Writable CustomEditorProvider для визуального редактирования форм 1С.
 * Поддерживает drag-and-drop, редактирование свойств, удаление элементов.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseFormXml } from './FormXmlParser';
import { FormXmlDocument } from './FormXmlSerializer';

// ── CustomDocument ──────────────────────────────────────────────────────────

class FormDocument implements vscode.CustomDocument {
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private _xmlDoc: FormXmlDocument;
  private _isDirty = false;

  /** Стек undo: XML-снапшоты до каждого изменения */
  private undoStack: string[] = [];
  /** Стек redo: XML-снапшоты отменённых изменений */
  private redoStack: string[] = [];
  private static readonly MAX_UNDO = 50;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(readonly uri: vscode.Uri, content: string) {
    this._xmlDoc = new FormXmlDocument(content);
  }

  get xmlDoc(): FormXmlDocument {
    return this._xmlDoc;
  }

  get isDirty(): boolean {
    return this._isDirty;
  }

  /** Сохранить снапшот перед изменением */
  pushUndo(): void {
    this.undoStack.push(this._xmlDoc.serialize());
    if (this.undoStack.length > FormDocument.MAX_UNDO) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  /** Отменить последнее изменение */
  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;
    this.redoStack.push(this._xmlDoc.serialize());
    this._xmlDoc = new FormXmlDocument(snapshot);
    this._isDirty = this.undoStack.length > 0;
    this._onDidChange.fire();
    return true;
  }

  /** Повторить отменённое изменение */
  redo(): boolean {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return false;
    this.undoStack.push(this._xmlDoc.serialize());
    this._xmlDoc = new FormXmlDocument(snapshot);
    this._isDirty = true;
    this._onDidChange.fire();
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  markDirty(): void {
    this._isDirty = true;
    this._onDidChange.fire();
  }

  markClean(): void {
    this._isDirty = false;
  }

  reload(content: string): void {
    this._xmlDoc = new FormXmlDocument(content);
    this._isDirty = false;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChange.dispose();
  }
}

// ── Provider ────────────────────────────────────────────────────────────────

export class FormEditorProvider implements vscode.CustomEditorProvider<FormDocument> {
  static readonly viewType = 'v8vscedit.formEditor';

  private readonly _onDidChangeCustomDocument =
    new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<FormDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  private readonly webviews = new Map<string, vscode.Webview>();

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

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async openCustomDocument(uri: vscode.Uri): Promise<FormDocument> {
    const content = fs.readFileSync(uri.fsPath, 'utf-8');
    return new FormDocument(uri, content);
  }

  resolveCustomEditor(
    document: FormDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    this.webviews.set(document.uri.toString(), webviewPanel.webview);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Отправить начальную модель
    this.sendModel(document, webviewPanel.webview);

    // Обработка сообщений от webview
    webviewPanel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg, document, webviewPanel.webview)
    );

    // File watcher для внешних изменений
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.Uri.file(document.uri.fsPath.replace(/[/\\][^/\\]+$/, '')),
        '*.xml'
      )
    );
    watcher.onDidChange(() => {
      if (!document.isDirty) {
        const content = fs.readFileSync(document.uri.fsPath, 'utf-8');
        document.reload(content);
        this.sendModel(document, webviewPanel.webview);
      }
    });
    webviewPanel.onDidDispose(() => {
      watcher.dispose();
      this.webviews.delete(document.uri.toString());
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────

  async saveCustomDocument(document: FormDocument): Promise<void> {
    const xml = document.xmlDoc.serialize();
    fs.writeFileSync(document.uri.fsPath, xml, 'utf-8');
    document.markClean();
  }

  async saveCustomDocumentAs(
    document: FormDocument,
    destination: vscode.Uri
  ): Promise<void> {
    const xml = document.xmlDoc.serialize();
    fs.writeFileSync(destination.fsPath, xml, 'utf-8');
  }

  async revertCustomDocument(document: FormDocument): Promise<void> {
    const content = fs.readFileSync(document.uri.fsPath, 'utf-8');
    document.reload(content);
    const webview = this.webviews.get(document.uri.toString());
    if (webview) {
      this.sendModel(document, webview);
    }
  }

  async backupCustomDocument(
    document: FormDocument,
    context: vscode.CustomDocumentBackupContext
  ): Promise<vscode.CustomDocumentBackup> {
    const xml = document.xmlDoc.serialize();
    fs.writeFileSync(context.destination.fsPath, xml, 'utf-8');
    return {
      id: context.destination.toString(),
      delete: () => {
        try { fs.unlinkSync(context.destination.fsPath); } catch {}
      },
    };
  }

  // ── Message handling ──────────────────────────────────────────────────────

  private handleMessage(
    msg: {
      type: string;
      elementId?: number;
      targetParentId?: number;
      insertBeforeId?: number | null;
      propertyName?: string;
      value?: string;
    },
    document: FormDocument,
    webview: vscode.Webview
  ): void {
    switch (msg.type) {
      case 'moveElement': {
        document.pushUndo();
        const ok = document.xmlDoc.moveElement(
          msg.elementId!,
          msg.targetParentId!,
          msg.insertBeforeId ?? null
        );
        if (ok) {
          this.markChanged(document);
          this.sendModel(document, webview);
        }
        break;
      }

      case 'updateProperty': {
        document.pushUndo();
        const ok = document.xmlDoc.updateElementProperty(
          msg.elementId!,
          msg.propertyName!,
          msg.value!
        );
        if (ok) {
          this.markChanged(document);
          this.sendModel(document, webview);
        }
        break;
      }

      case 'deleteElement': {
        document.pushUndo();
        const ok = document.xmlDoc.deleteElement(msg.elementId!);
        if (ok) {
          this.markChanged(document);
          this.sendModel(document, webview);
        }
        break;
      }

      case 'selectElement':
        // Только визуальная синхронизация, обрабатывается в webview
        break;

      case 'undo': {
        if (document.undo()) {
          this._onDidChangeCustomDocument.fire({ document });
          this.sendModel(document, webview);
        }
        break;
      }

      case 'redo': {
        if (document.redo()) {
          this._onDidChangeCustomDocument.fire({ document });
          this.sendModel(document, webview);
        }
        break;
      }
    }
  }

  private markChanged(document: FormDocument): void {
    document.markDirty();
    this._onDidChangeCustomDocument.fire({ document });
  }

  private sendModel(document: FormDocument, webview: vscode.Webview): void {
    try {
      // Пере-парсим из текущего XML чтобы получить актуальную FormModel
      const xml = document.xmlDoc.serialize();
      const model = parseFormXml(xml);
      webview.postMessage({ type: 'formLoaded', model });
    } catch (err) {
      webview.postMessage({
        type: 'error',
        message: `Ошибка при парсинге формы: ${err}`,
      });
    }
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

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
