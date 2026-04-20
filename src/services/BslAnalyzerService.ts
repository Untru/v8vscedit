import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

const GITHUB_REPO = 'itrous/bsl-analyzer';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

/** Платформенный суффикс имени бинарника */
function platformAssetName(): string {
  switch (process.platform) {
    case 'win32': return 'bsl-analyzer-windows-amd64.exe';
    case 'linux': return 'bsl-analyzer-linux-amd64';
    case 'darwin': return 'bsl-analyzer-darwin-arm64';
    default: throw new Error(`Платформа ${process.platform} не поддерживается bsl-analyzer`);
  }
}

interface ReleaseInfo {
  tag: string;
  downloadUrl: string;
}

export class BslAnalyzerService implements vscode.Disposable {
  private storageDir: string;
  private outputChannel: vscode.OutputChannel;
  private currentVersion: string | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
  ) {
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'bsl-analyzer');
    this.outputChannel = outputChannel;
  }

  dispose(): void { /* noop */ }

  /** Путь к исполняемому файлу (может не существовать) */
  get binaryPath(): string {
    const name = process.platform === 'win32' ? 'bsl-analyzer.exe' : 'bsl-analyzer';
    return path.join(this.storageDir, name);
  }

  /** Текущая закэшированная версия (из файла version.txt) */
  get installedVersion(): string | undefined {
    if (this.currentVersion) return this.currentVersion;
    const vFile = path.join(this.storageDir, 'version.txt');
    if (fs.existsSync(vFile)) {
      this.currentVersion = fs.readFileSync(vFile, 'utf-8').trim();
    }
    return this.currentVersion;
  }

  /** Бинарник уже скачан? */
  get isInstalled(): boolean {
    return fs.existsSync(this.binaryPath);
  }

  /**
   * Убедиться, что бинарник существует и актуален.
   * @returns true если бинарник готов
   */
  async ensureBinary(token?: vscode.CancellationToken): Promise<boolean> {
    try { fs.unlinkSync(this.binaryPath + '.old'); } catch { /* noop */ }
    const customPath = vscode.workspace.getConfiguration('v8vscedit.bslAnalyzer').get<string>('path');
    if (customPath) {
      if (!fs.existsSync(customPath)) {
        vscode.window.showErrorMessage(`bsl-analyzer: указанный путь не найден: ${customPath}`);
        return false;
      }
      return true;
    }

    if (this.isInstalled) return true;

    return this.downloadLatest(token);
  }

  /** Получить путь к исполняемому файлу с учётом пользовательского пути */
  getExecutablePath(): string {
    const customPath = vscode.workspace.getConfiguration('v8vscedit.bslAnalyzer').get<string>('path');
    return customPath || this.binaryPath;
  }

  /** Проверить наличие обновлений и скачать если есть */
  async checkForUpdate(): Promise<boolean> {
    const latest = await this.fetchLatestRelease();
    if (!latest) return false;

    const installed = this.installedVersion;
    if (installed === latest.tag) {
      this.outputChannel.appendLine(`[bsl-analyzer] Версия ${installed} актуальна`);
      return false;
    }

    const action = await vscode.window.showInformationMessage(
      `Доступна новая версия bsl-analyzer: ${latest.tag} (текущая: ${installed || 'не установлена'})`,
      'Обновить',
      'Пропустить',
    );
    if (action !== 'Обновить') return false;

    return this.downloadLatest();
  }

  /** Коллбэк для остановки LSP перед подменой бинарника (устанавливается из extension.ts) */
  onBeforeSwap: (() => Promise<void>) | undefined;

  /** Скачать последнюю версию */
  async downloadLatest(token?: vscode.CancellationToken): Promise<boolean> {
    const release = await this.fetchLatestRelease();
    if (!release) return false;

    return vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `bsl-analyzer ${release.tag}`, cancellable: true },
      async (progress, cancelToken) => {
        const ct = token || cancelToken;
        progress.report({ message: 'Загрузка...' });

        const tmpPath = this.binaryPath + '.tmp';

        try {
          fs.mkdirSync(this.storageDir, { recursive: true });
          await this.download(release.downloadUrl, tmpPath, ct);

          progress.report({ message: 'Замена бинарника...' });

          if (this.onBeforeSwap) {
            await this.onBeforeSwap();
            await new Promise((r) => setTimeout(r, 1500));
          }

          const oldPath = this.binaryPath + '.old';
          try { fs.unlinkSync(oldPath); } catch { /* ignore */ }

          if (fs.existsSync(this.binaryPath)) {
            fs.renameSync(this.binaryPath, oldPath);
          }
          fs.renameSync(tmpPath, this.binaryPath);

          try { fs.unlinkSync(oldPath); } catch { /* подчистим при следующем запуске */ }

          if (process.platform !== 'win32') {
            fs.chmodSync(this.binaryPath, 0o755);
          }

          this.currentVersion = release.tag;
          fs.writeFileSync(path.join(this.storageDir, 'version.txt'), release.tag, 'utf-8');

          this.outputChannel.appendLine(`[bsl-analyzer] Установлена версия ${release.tag}`);
          return true;
        } catch (err) {
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
          if (ct?.isCancellationRequested) return false;
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`bsl-analyzer: ошибка загрузки: ${msg}`);
          return false;
        }
      },
    );
  }

  /** Запрос последнего релиза с GitHub API */
  private async fetchLatestRelease(): Promise<ReleaseInfo | undefined> {
    try {
      const data = await this.httpGetJson(`${GITHUB_API_BASE}/releases/latest`);
      const tag = data.tag_name as string;
      const asset = (data.assets as Array<{ name: string; browser_download_url: string }>)
        .find((a) => a.name === platformAssetName());

      if (!asset) {
        this.outputChannel.appendLine(`[bsl-analyzer] Бинарник для ${process.platform} не найден в релизе ${tag}`);
        return undefined;
      }

      return { tag, downloadUrl: asset.browser_download_url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[bsl-analyzer] Ошибка запроса GitHub API: ${msg}`);
      return undefined;
    }
  }

  private static readonly DOWNLOAD_TIMEOUT_MS = 120_000;

  /** Скачать файл по URL с поддержкой редиректов и таймаутом */
  private download(url: string, dest: string, token?: vscode.CancellationToken): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err: Error) => { if (!settled) { settled = true; reject(err); } };
      const ok = () => { if (!settled) { settled = true; resolve(); } };

      const timer = setTimeout(() => {
        fail(new Error('Таймаут загрузки (120 сек)'));
      }, BslAnalyzerService.DOWNLOAD_TIMEOUT_MS);

      const file = fs.createWriteStream(dest);
      file.on('error', (err) => { clearTimeout(timer); fail(err); });

      const request = (targetUrl: string) => {
        const mod = targetUrl.startsWith('https') ? https : http;
        const req = mod.get(targetUrl, { headers: { 'User-Agent': 'v8vscedit' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            clearTimeout(timer);
            fail(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          res.pipe(file);
          file.on('finish', () => { clearTimeout(timer); file.close(() => ok()); });
        });
        req.on('error', (err) => { clearTimeout(timer); fail(err); });
        if (token) {
          token.onCancellationRequested(() => {
            req.destroy();
            clearTimeout(timer);
            fail(new Error('Отменено'));
          });
        }
      };
      request(url);
    });
  }

  /** HTTP GET JSON */
  private httpGetJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'v8vscedit', Accept: 'application/json' } }, (res) => {
        let body = '';
        res.on('data', (c: Buffer) => { body += c.toString(); });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }
}
