import * as vscode from 'vscode';

export type LspState = 'downloading' | 'starting' | 'running' | 'stopped' | 'error';

const STATE_MAP: Record<LspState, { icon: string; text: string; tooltip: string; color?: string }> = {
  downloading: { icon: '$(cloud-download)', text: 'BSL: загрузка…', tooltip: 'Загрузка bsl-analyzer', color: undefined },
  starting:    { icon: '$(sync~spin)',      text: 'BSL: запуск…',  tooltip: 'Запуск языкового сервера', color: undefined },
  running:     { icon: '$(check)',          text: 'BSL',           tooltip: 'bsl-analyzer работает', color: undefined },
  stopped:     { icon: '$(circle-slash)',   text: 'BSL: выкл',    tooltip: 'Языковой сервер остановлен', color: new vscode.ThemeColor('statusBarItem.warningForeground') as unknown as string },
  error:       { icon: '$(error)',          text: 'BSL: ошибка',  tooltip: 'Ошибка языкового сервера', color: new vscode.ThemeColor('statusBarItem.errorForeground') as unknown as string },
};

export class BslAnalyzerStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private _state: LspState = 'stopped';

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    this.item.command = '1cNavigator.bslAnalyzer.showMenu';
    this.setState('stopped');
    this.item.show();
  }

  get state(): LspState { return this._state; }

  setState(state: LspState, detail?: string): void {
    this._state = state;
    const cfg = STATE_MAP[state];
    this.item.text = `${cfg.icon} ${cfg.text}`;
    this.item.tooltip = detail ? `${cfg.tooltip}\n${detail}` : cfg.tooltip;
    this.item.color = cfg.color;
  }

  /** Показать версию рядом с иконкой */
  setVersion(version: string): void {
    if (this._state === 'running') {
      const cfg = STATE_MAP.running;
      this.item.text = `${cfg.icon} BSL ${version}`;
      this.item.tooltip = `bsl-analyzer ${version} — работает`;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
