import * as vscode from 'vscode';

export interface RepoConnectionSettings {
  /** Путь к хранилищу (файловый путь или tcp://host:port/repo) */
  repoPath: string;
  /** Имя пользователя хранилища */
  user: string;
  /** Путь к файловой базе данных 1С */
  dbPath: string;
  /** Путь к 1cv8.exe */
  v8Path: string;
}

const SETTINGS_SECTION = 'v8vscedit.repository';
const PASSWORD_KEY_PREFIX = 'v8vscedit.repo.password.';

export class RepoConnectionService {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  /** Проверяет, есть ли сохранённые настройки для данного корня конфигурации */
  hasSettings(configRoot: string): boolean {
    const all = this.getAllSettings();
    return configRoot in all;
  }

  /** Получает настройки подключения (без пароля — он в SecretStorage) */
  getSettings(configRoot: string): RepoConnectionSettings | undefined {
    const all = this.getAllSettings();
    const raw = all[configRoot];
    if (!raw || !raw.repoPath) {
      return undefined;
    }
    return {
      repoPath: raw.repoPath ?? '',
      user: raw.user ?? '',
      dbPath: raw.dbPath ?? '',
      v8Path: raw.v8Path ?? '',
    };
  }

  /** Получает пароль из SecretStorage */
  async getPassword(configRoot: string): Promise<string> {
    return (await this.secrets.get(PASSWORD_KEY_PREFIX + configRoot)) ?? '';
  }

  /** Удаляет настройки подключения */
  async removeSettings(configRoot: string): Promise<void> {
    const all = this.getAllSettings();
    delete all[configRoot];
    await this.saveAllSettings(all);
    await this.secrets.delete(PASSWORD_KEY_PREFIX + configRoot);
  }

  /** Запрашивает у пользователя настройки и сохраняет их */
  async promptAndSaveSettings(configRoot: string): Promise<RepoConnectionSettings | undefined> {
    const existing = this.getSettings(configRoot);
    const existingPassword = existing ? await this.getPassword(configRoot) : '';

    const v8Path = await vscode.window.showInputBox({
      title: 'Путь к 1cv8.exe',
      prompt: 'Укажите полный путь к исполняемому файлу 1cv8.exe',
      value: existing?.v8Path ?? 'C:\\Program Files\\1cv8\\8.3.24.1819\\bin\\1cv8.exe',
      ignoreFocusOut: true,
    });
    if (v8Path === undefined) { return undefined; }

    const dbPath = await vscode.window.showInputBox({
      title: 'Путь к базе данных',
      prompt: 'Укажите путь к файловой базе данных 1С',
      value: existing?.dbPath ?? '',
      ignoreFocusOut: true,
    });
    if (dbPath === undefined) { return undefined; }

    const repoPath = await vscode.window.showInputBox({
      title: 'Путь к хранилищу',
      prompt: 'Файловый путь или tcp://host:port/repo',
      value: existing?.repoPath ?? '',
      ignoreFocusOut: true,
    });
    if (repoPath === undefined) { return undefined; }

    const user = await vscode.window.showInputBox({
      title: 'Пользователь хранилища',
      prompt: 'Имя пользователя для подключения к хранилищу',
      value: existing?.user ?? '',
      ignoreFocusOut: true,
    });
    if (user === undefined) { return undefined; }

    const password = await vscode.window.showInputBox({
      title: 'Пароль хранилища',
      prompt: existingPassword
        ? 'Пароль для подключения к хранилищу (оставьте пустым, чтобы сохранить текущий)'
        : 'Пароль для подключения к хранилищу',
      password: true,
      ignoreFocusOut: true,
    });
    if (password === undefined) { return undefined; }

    const settings: RepoConnectionSettings = { repoPath, user, dbPath, v8Path };

    const all = this.getAllSettings();
    all[configRoot] = settings;
    await this.saveAllSettings(all);
    if (password !== '' || !existingPassword) {
      await this.secrets.store(PASSWORD_KEY_PREFIX + configRoot, password);
    }

    return settings;
  }

  private getAllSettings(): Record<string, any> {
    const config = vscode.workspace.getConfiguration(SETTINGS_SECTION);
    return config.get<Record<string, any>>('connections', {});
  }

  private async saveAllSettings(all: Record<string, any>): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_SECTION);
    await config.update('connections', all, vscode.ConfigurationTarget.Workspace);
  }
}
