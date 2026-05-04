import * as vscode from 'vscode';
import type {
  SaveStandaloneServerSettingsInput,
  StandaloneServerService,
  StandaloneServerSettingsSnapshot,
} from '../../../infra/standalone';

type StandaloneServerMessage =
  | { readonly type: 'refresh' }
  | ({ readonly type: 'save' } & SaveStandaloneServerSettingsInput);

/**
 * Webview-панель настройки автономного сервера 1С.
 */
export class StandaloneServerViewProvider implements vscode.Disposable {
  static readonly viewType = 'v8vsceditStandaloneServerPanel';

  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly service: StandaloneServerService,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly onDidSave: () => void
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      this.postState(this.service.getSettingsSnapshot(false));
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      StandaloneServerViewProvider.viewType,
      'Автономный сервер',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.options = {
      enableScripts: true,
    };
    this.panel.webview.html = this.getHtml(this.panel.webview, this.service.getSettingsSnapshot(false));
    this.panel.webview.onDidReceiveMessage((message: StandaloneServerMessage) => {
      void this.handleMessage(message);
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async handleMessage(message: StandaloneServerMessage): Promise<void> {
    try {
      if (message.type === 'refresh') {
        this.postState(this.service.getSettingsSnapshot(true));
        this.postStatus('idle', '');
        return;
      }

      const snapshot = this.service.save({
        ibsrvPath: message.ibsrvPath,
        platformPath: message.platformPath,
        databasePath: message.databasePath,
        httpAddress: message.httpAddress,
        httpPort: message.httpPort,
        httpBase: message.httpBase,
        name: message.name,
        distributeLicenses: message.distributeLicenses,
        scheduleJobs: message.scheduleJobs,
      });
      this.postState(snapshot);
      this.postStatus('success', 'Настройки автономного сервера сохранены.');
      this.onDidSave();
      await vscode.window.showInformationMessage('Настройки автономного сервера сохранены.');
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[standalone][error] ${text}`);
      this.postStatus('error', text);
      await vscode.window.showErrorMessage(`Не удалось сохранить настройки автономного сервера.\n${text}`);
    }
  }

  private postState(snapshot: StandaloneServerSettingsSnapshot): void {
    void this.panel?.webview.postMessage({
      type: 'state',
      state: snapshot,
    });
  }

  private postStatus(kind: 'idle' | 'success' | 'error', message: string): void {
    void this.panel?.webview.postMessage({
      type: 'status',
      kind,
      message,
    });
  }

  private getHtml(webview: vscode.Webview, snapshot: StandaloneServerSettingsSnapshot): string {
    const nonce = getNonce();
    const stateJson = JSON.stringify(snapshot).replace(/</g, '\\u003C');
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      box-sizing: border-box;
      padding: 10px 12px 12px;
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .layout {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding-bottom: 11px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
    }

    section:last-of-type {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 18px;
      font-weight: 600;
      color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground));
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--vscode-descriptionForeground);
    }

    input,
    select {
      width: 100%;
      min-height: 28px;
      box-sizing: border-box;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      font: inherit;
      outline: none;
    }

    input {
      padding: 3px 7px;
    }

    select {
      padding: 3px 6px;
    }

    input:focus,
    select:focus {
      border-color: var(--vscode-focusBorder);
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 92px;
      gap: 7px;
      align-items: end;
    }

    .path,
    .warning,
    .status {
      color: var(--vscode-descriptionForeground);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .warning {
      color: var(--vscode-inputValidation-warningForeground, var(--vscode-descriptionForeground));
    }

    .status {
      display: none;
      min-height: 22px;
    }

    .status.visible {
      display: block;
    }

    .status.success {
      color: var(--vscode-testing-iconPassed, var(--vscode-descriptionForeground));
    }

    .status.error {
      color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground));
    }

    .buttons {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
    }

    button {
      min-height: 30px;
      padding: 5px 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      font: inherit;
      cursor: pointer;
    }

    .primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    .primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }

    .secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button:disabled,
    input:disabled,
    select:disabled {
      cursor: default;
      opacity: 0.65;
    }
  </style>
</head>
<body>
  <div class="layout">
    <section>
      <div class="title">
        <span>Платформа и ibsrv</span>
      </div>
      <label>
        Платформа
        <select id="platform"></select>
      </label>
      <label>
        Путь к ibsrv
        <input id="ibsrvPath" type="text" autocomplete="off" spellcheck="false" placeholder="Авто: рядом с выбранной платформой">
      </label>
      <div id="dataPath" class="path"></div>
    </section>

    <section>
      <div class="title">
        <span>Файловая база</span>
      </div>
      <label>
        Каталог базы
        <input id="databasePath" type="text" autocomplete="off" spellcheck="false">
      </label>
    </section>

    <section>
      <div class="title">
        <span>HTTP-публикация</span>
      </div>
      <div class="grid">
        <label>
          Адрес
          <input id="httpAddress" type="text" autocomplete="off" spellcheck="false">
        </label>
        <label>
          Порт
          <input id="httpPort" type="number" min="1" max="65535" step="1">
        </label>
      </div>
      <label>
        Базовый путь
        <input id="httpBase" type="text" autocomplete="off" spellcheck="false">
      </label>
      <label>
        Имя базы
        <input id="name" type="text" autocomplete="off" spellcheck="false">
      </label>
    </section>

    <section>
      <div class="title">
        <span>Режимы</span>
      </div>
      <label>
        Выдача клиентских лицензий
        <select id="distributeLicenses">
          <option value="allow">Разрешена</option>
          <option value="deny">Запрещена</option>
        </select>
      </label>
      <label>
        Регламентные задания
        <select id="scheduleJobs">
          <option value="allow">Разрешены</option>
          <option value="deny">Запрещены</option>
        </select>
      </label>
    </section>

    <div id="warnings"></div>
    <div id="status" class="status" aria-live="polite"></div>
    <div class="buttons">
      <button id="save" class="primary" type="button">Сохранить</button>
      <button id="refresh" class="secondary" type="button">Обновить</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = ${stateJson};

    const platform = document.getElementById('platform');
    const ibsrvPath = document.getElementById('ibsrvPath');
    const dataPath = document.getElementById('dataPath');
    const databasePath = document.getElementById('databasePath');
    const httpAddress = document.getElementById('httpAddress');
    const httpPort = document.getElementById('httpPort');
    const httpBase = document.getElementById('httpBase');
    const name = document.getElementById('name');
    const distributeLicenses = document.getElementById('distributeLicenses');
    const scheduleJobs = document.getElementById('scheduleJobs');
    const warnings = document.getElementById('warnings');
    const status = document.getElementById('status');
    const save = document.getElementById('save');
    const refresh = document.getElementById('refresh');
    const controls = [platform, ibsrvPath, databasePath, httpAddress, httpPort, httpBase, name, distributeLicenses, scheduleJobs, save, refresh];
    let saving = false;

    function render() {
      renderPlatformOptions();
      ibsrvPath.value = state.settings.ibsrvPath || '';
      dataPath.textContent = 'Данные сервера: ' + state.settings.dataPath;
      databasePath.value = state.settings.databasePath || '';
      httpAddress.value = state.settings.httpAddress || 'localhost';
      httpPort.value = String(state.settings.httpPort || 8314);
      httpBase.value = state.settings.httpBase || '/';
      name.value = state.settings.name || 'v8vscedit';
      distributeLicenses.value = state.settings.distributeLicenses || 'allow';
      scheduleJobs.value = state.settings.scheduleJobs || 'allow';
      renderWarnings();
      applyControlState();
    }

    function renderPlatformOptions() {
      platform.replaceChildren();
      platform.append(new Option('Автоопределение из env.json', ''));
      for (const item of state.platforms) {
        platform.append(new Option(item.label, item.executablePath));
      }
      platform.value = state.settings.platformPath || '';
    }

    function renderWarnings() {
      warnings.replaceChildren();
      for (const warning of state.warnings) {
        const item = document.createElement('div');
        item.className = 'warning';
        item.textContent = warning;
        warnings.append(item);
      }
    }

    function setSaving(nextSaving) {
      saving = nextSaving;
      applyControlState();
      save.textContent = nextSaving ? 'Сохранение...' : 'Сохранить';
      status.className = nextSaving ? 'status visible' : 'status';
      status.textContent = nextSaving ? 'Сохраняю настройки автономного сервера...' : '';
    }

    function showStatus(kind, message) {
      saving = false;
      applyControlState();
      save.textContent = 'Сохранить';
      if (!message) {
        status.className = 'status';
        status.textContent = '';
        return;
      }
      status.className = 'status visible ' + kind;
      status.textContent = message;
    }

    function applyControlState() {
      for (const control of controls) {
        control.disabled = saving;
      }
    }

    save.addEventListener('click', () => {
      if (saving) {
        return;
      }
      setSaving(true);
      vscode.postMessage({
        type: 'save',
        ibsrvPath: ibsrvPath.value,
        platformPath: platform.value,
        databasePath: databasePath.value,
        httpAddress: httpAddress.value,
        httpPort: Number(httpPort.value),
        httpBase: httpBase.value,
        name: name.value,
        distributeLicenses: distributeLicenses.value,
        scheduleJobs: scheduleJobs.value,
      });
    });

    refresh.addEventListener('click', () => {
      if (saving) {
        return;
      }
      vscode.postMessage({ type: 'refresh' });
    });

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'state') {
        state = event.data.state;
        render();
      } else if (event.data?.type === 'status') {
        showStatus(event.data.kind, event.data.message);
      }
    });

    render();
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
