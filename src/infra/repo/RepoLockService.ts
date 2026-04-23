import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { decode } from 'iconv-lite';
import { MetaKind } from '../../domain/MetaTypes';
import { NODE_KIND_TO_1C_TYPE, TYPE_1C_TO_NODE_KIND } from './RepoTypeMapping';
import { RepoConnectionService } from './RepoConnectionService';

export enum RepoLockStatus {
  Unknown = 0,
  Free = 1,
  LockedByMe = 2,
  LockedByOther = 3,
}

export interface RepoLockInfo {
  status: RepoLockStatus;
  lockedBy?: string;
}

/**
 * Сервис управления захватами объектов в хранилище конфигурации 1С.
 * Взаимодействует через 1cv8.exe DESIGNER.
 */
export class RepoLockService {
  /** configRoot → (objectFullName → RepoLockInfo) */
  private lockCache = new Map<string, Map<string, RepoLockInfo>>();
  /** configRoot → текущий пользователь хранилища */
  private repoUsers = new Map<string, string>();

  constructor(
    private readonly connectionService: RepoConnectionService,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /** Проверяет, подключена ли конфигурация к хранилищу */
  isConnected(configRoot: string): boolean {
    return this.connectionService.hasSettings(configRoot);
  }

  /** Получает статус захвата объекта */
  getLockStatus(configRoot: string, nodeKind: MetaKind, objectName: string): RepoLockStatus {
    const objectKey = this.buildObjectKey(nodeKind, objectName);
    if (!objectKey) { return RepoLockStatus.Unknown; }

    const configLocks = this.lockCache.get(configRoot);
    if (!configLocks) { return RepoLockStatus.Unknown; }

    const info = configLocks.get(objectKey);
    return info?.status ?? RepoLockStatus.Free;
  }

  /** Получает информацию о захвате объекта */
  getLockInfo(configRoot: string, nodeKind: MetaKind, objectName: string): RepoLockInfo | undefined {
    const objectKey = this.buildObjectKey(nodeKind, objectName);
    if (!objectKey) { return undefined; }

    const configLocks = this.lockCache.get(configRoot);
    return configLocks?.get(objectKey);
  }

  /** Захватывает объект в хранилище */
  async lockObject(configRoot: string, nodeKind: MetaKind, objectName: string): Promise<boolean> {
    const objectKey = this.buildObjectKey(nodeKind, objectName);
    if (!objectKey) { return false; }

    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    const password = await this.connectionService.getPassword(configRoot);

    const args = this.buildDesignerArgs(settings, password, [
      '/ConfigurationRepositoryLock',
      `-Objects`, objectKey,
    ]);

    const result = await this.runDesignerCommand(settings.v8Path, args, 'lock');
    if (result.success) {
      this.updateLocalCache(configRoot, objectKey, RepoLockStatus.LockedByMe, settings.user);
    }
    return result.success;
  }

  /** Снимает захват объекта в хранилище */
  async unlockObject(configRoot: string, nodeKind: MetaKind, objectName: string): Promise<boolean> {
    const objectKey = this.buildObjectKey(nodeKind, objectName);
    if (!objectKey) { return false; }

    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    const password = await this.connectionService.getPassword(configRoot);

    const args = this.buildDesignerArgs(settings, password, [
      '/ConfigurationRepositoryUnlock',
      '-Objects', objectKey,
      '-force',
    ]);

    const result = await this.runDesignerCommand(settings.v8Path, args, 'unlock');
    if (result.success) {
      this.updateLocalCache(configRoot, objectKey, RepoLockStatus.Free);
    }
    return result.success;
  }

  /** Обновляет кэш статусов захватов из отчёта хранилища */
  async refreshLocks(configRoot: string): Promise<boolean> {
    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    this.repoUsers.set(configRoot, settings.user);
    const password = await this.connectionService.getPassword(configRoot);

    const reportPath = path.join(os.tmpdir(), `v8vscedit-repo-report-${Date.now()}.txt`);

    const args = this.buildDesignerArgs(settings, password, [
      '/ConfigurationRepositoryReport', reportPath,
      '-NBegin', '0',
    ]);

    const result = await this.runDesignerCommand(settings.v8Path, args, 'report');
    if (!result.success) { return false; }

    try {
      const newLocks = this.parseReport(reportPath, settings.user);
      this.lockCache.set(configRoot, newLocks);
      return true;
    } finally {
      try { fs.unlinkSync(reportPath); } catch { /* ignore */ }
    }
  }

  /** Очищает кэш для конфигурации */
  invalidate(configRoot: string): void {
    this.lockCache.delete(configRoot);
    this.repoUsers.delete(configRoot);
  }

  /** Проверяет, может ли данный тип узла быть захвачен */
  isLockable(nodeKind: MetaKind): boolean {
    return nodeKind in NODE_KIND_TO_1C_TYPE;
  }

  /** Есть ли данные о захватах для конфигурации */
  hasLockData(configRoot: string): boolean {
    return this.lockCache.has(configRoot);
  }

  // ---------------------------------------------------------------------------
  // Операции с хранилищем
  // ---------------------------------------------------------------------------

  /** Создаёт новое хранилище конфигурации из базы данных */
  async createRepository(configRoot: string): Promise<boolean> {
    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    const password = await this.connectionService.getPassword(configRoot);

    const args: string[] = [
      'DESIGNER',
      `/F${settings.dbPath}`,
      '/ConfigurationRepositoryCreate',
      `-Path`, settings.repoPath,
      `-User`, settings.user,
      `-Pwd`, password,
    ];

    const result = await this.runDesignerCommand(settings.v8Path, args, 'create');
    return result.success;
  }

  /**
   * Помещает изменения конфигурации в хранилище.
   * @param comment — комментарий к версии
   * @param objects — если указаны, помещаются только эти объекты; иначе — все изменённые
   */
  async commitToRepository(
    configRoot: string,
    comment?: string,
    objects?: Array<{ nodeKind: MetaKind; name: string }>
  ): Promise<boolean> {
    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    const password = await this.connectionService.getPassword(configRoot);

    const extraArgs: string[] = ['/ConfigurationRepositoryCommit'];
    if (comment) {
      extraArgs.push('-comment', comment);
    }
    if (objects && objects.length > 0) {
      const objectKeys = objects
        .map((o) => this.buildObjectKey(o.nodeKind, o.name))
        .filter(Boolean) as string[];
      if (objectKeys.length > 0) {
        extraArgs.push('-Objects', objectKeys.join(';'));
      }
    }

    const args = this.buildDesignerArgs(settings, password, extraArgs);
    const result = await this.runDesignerCommand(settings.v8Path, args, 'commit');
    return result.success;
  }

  /** Получает конфигурацию из хранилища (обновляет конфигурацию БД) */
  async updateFromRepository(configRoot: string, version?: number): Promise<boolean> {
    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    const password = await this.connectionService.getPassword(configRoot);

    const extraArgs: string[] = ['/ConfigurationRepositoryUpdateCfg'];
    if (version !== undefined) {
      extraArgs.push('-v', String(version));
    }
    extraArgs.push('-force');

    const args = this.buildDesignerArgs(settings, password, extraArgs);
    const result = await this.runDesignerCommand(settings.v8Path, args, 'updateCfg');
    return result.success;
  }

  /** Добавляет пользователя в хранилище */
  async addUser(
    configRoot: string,
    userName: string,
    userPassword: string,
    rights: 'ReadOnly' | 'LockObjects' | 'ManageConfigurationVersions' | 'Administration' = 'LockObjects'
  ): Promise<boolean> {
    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return false; }

    const password = await this.connectionService.getPassword(configRoot);

    const extraArgs: string[] = [
      '/ConfigurationRepositoryAddUser',
      '-User', userName,
      '-Pwd', userPassword,
      '-Rights', rights,
    ];

    const args = this.buildDesignerArgs(settings, password, extraArgs);
    const result = await this.runDesignerCommand(settings.v8Path, args, 'addUser');
    return result.success;
  }

  /** Получает историю версий хранилища (отчёт) */
  async getHistory(configRoot: string, versionCount?: number): Promise<string | undefined> {
    const settings = this.connectionService.getSettings(configRoot);
    if (!settings) { return undefined; }

    const password = await this.connectionService.getPassword(configRoot);
    const reportPath = path.join(os.tmpdir(), `v8vscedit-repo-history-${Date.now()}.txt`);

    const extraArgs: string[] = ['/ConfigurationRepositoryReport', reportPath];
    if (versionCount) {
      extraArgs.push('-NBegin', String(versionCount));
    }

    const args = this.buildDesignerArgs(settings, password, extraArgs);
    const result = await this.runDesignerCommand(settings.v8Path, args, 'history');
    if (!result.success) { return undefined; }

    try {
      if (!fs.existsSync(reportPath)) { return undefined; }
      const raw = fs.readFileSync(reportPath);
      return this.decodeOutput(raw);
    } finally {
      try { fs.unlinkSync(reportPath); } catch { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Приватные методы
  // ---------------------------------------------------------------------------

  private buildObjectKey(nodeKind: MetaKind, objectName: string): string | undefined {
    const type1C = NODE_KIND_TO_1C_TYPE[nodeKind];
    if (!type1C) { return undefined; }
    return `${type1C}.${objectName}`;
  }

  private buildDesignerArgs(
    settings: { dbPath: string; repoPath: string; user: string },
    password: string,
    extraArgs: string[]
  ): string[] {
    return [
      'DESIGNER',
      `/F${settings.dbPath}`,
      `/ConfigurationRepositoryF`, settings.repoPath,
      `/ConfigurationRepositoryN`, settings.user,
      `/ConfigurationRepositoryP`, password,
      ...extraArgs,
    ];
  }

  private async runDesignerCommand(
    v8Path: string,
    args: string[],
    logPrefix: string
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const safeArgs = args.map((a) =>
      a.startsWith('/ConfigurationRepositoryP')
        ? '/ConfigurationRepositoryP ****'
        : a
    );
    this.outputChannel.appendLine(`[repo:${logPrefix}] Старт: ${v8Path} ${safeArgs.join(' ')}`);

    return new Promise((resolve) => {
      // На Windows вызываем 1cv8.exe через PowerShell для корректной кодировки
      const psCommand = `& '${v8Path}' ${args.map((a) => `'${a.replace(/'/g, "''")}'`).join(' ')}`;
      const child = spawn('powershell', ['-NoProfile', '-Command', psCommand], {
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        const text = this.decodeOutput(chunk).trim();
        if (text) {
          stdout += text + '\n';
          this.outputChannel.appendLine(`[repo:${logPrefix}] ${text}`);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = this.decodeOutput(chunk).trim();
        if (text) {
          stderr += text + '\n';
          this.outputChannel.appendLine(`[repo:${logPrefix}][stderr] ${text}`);
        }
      });

      child.on('error', (err) => {
        this.outputChannel.appendLine(`[repo:${logPrefix}][error] ${err.message}`);
        resolve({ success: false, stdout, stderr: err.message });
      });

      child.on('close', (code) => {
        const success = code === 0;
        if (!success) {
          this.outputChannel.appendLine(`[repo:${logPrefix}] Код завершения: ${code}`);
        }
        resolve({ success, stdout, stderr });
      });
    });
  }

  private decodeOutput(chunk: Buffer): string {
    const utf8Text = chunk.toString('utf-8');
    if (process.platform !== 'win32' || !utf8Text.includes('�')) {
      return utf8Text;
    }
    const cp866Text = decode(chunk, 'cp866');
    const cp1251Text = decode(chunk, 'win1251');
    return this.pickMostReadable([cp866Text, cp1251Text, utf8Text]);
  }

  private pickMostReadable(candidates: string[]): string {
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
   * Парсит файл отчёта ConfigurationRepositoryReport.
   * Ищет строки вида «Захвачено: Пользователь — Справочник.Номенклатура».
   */
  private parseReport(reportPath: string, currentUser: string): Map<string, RepoLockInfo> {
    const locks = new Map<string, RepoLockInfo>();

    if (!fs.existsSync(reportPath)) {
      return locks;
    }

    let content: string;
    try {
      const raw = fs.readFileSync(reportPath);
      content = this.decodeOutput(raw);
    } catch {
      return locks;
    }

    // Формат отчёта хранилища содержит строки вида:
    // «Захвачен - Пользователь "ИмяПользователя"»
    // и далее перечисление захваченных объектов.
    // Парсим построчно, ищем блоки захватов.
    const lines = content.split(/\r?\n/);
    let currentLocker: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Ищем строку с именем пользователя, захватившего объекты
      // Формат: "Захвачен - Пользователь "ИмяПользователя""
      const userMatch = trimmed.match(/[Зз]ахвач\S*\s*[-–—]\s*(?:Пользователь\s+)?["«]?([^"»]+)["»]?/i);
      if (userMatch) {
        currentLocker = userMatch[1].trim();
        continue;
      }

      // Ищем строку с объектом метаданных (ТипОбъекта.ИмяОбъекта)
      // Проверяем, что это известный тип 1С
      const objectMatch = trimmed.match(/^(\S+)\.(\S+)$/);
      if (objectMatch && currentLocker) {
        const [, typeName, objectName] = objectMatch;
        const nodeKind = TYPE_1C_TO_NODE_KIND.get(typeName);
        if (nodeKind) {
          const key = `${typeName}.${objectName}`;
          const isMe = currentLocker.toLowerCase() === currentUser.toLowerCase();
          locks.set(key, {
            status: isMe ? RepoLockStatus.LockedByMe : RepoLockStatus.LockedByOther,
            lockedBy: currentLocker,
          });
        }
      }

      // Пустая строка сбрасывает текущего пользователя
      if (trimmed === '') {
        currentLocker = null;
      }
    }

    return locks;
  }

  private updateLocalCache(
    configRoot: string,
    objectKey: string,
    status: RepoLockStatus,
    lockedBy?: string
  ): void {
    let configLocks = this.lockCache.get(configRoot);
    if (!configLocks) {
      configLocks = new Map();
      this.lockCache.set(configRoot, configLocks);
    }

    if (status === RepoLockStatus.Free) {
      configLocks.delete(objectKey);
    } else {
      configLocks.set(objectKey, { status, lockedBy });
    }
  }
}
