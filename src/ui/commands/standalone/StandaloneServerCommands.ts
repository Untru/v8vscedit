import * as fs from 'fs';
import * as vscode from 'vscode';
import type { StandaloneServerStatus } from '../../../infra/standalone';
import type { CommandServices } from '../_shared';

/** Регистрирует команды управления автономным сервером 1С. */
export function registerStandaloneServerCommands(
  context: vscode.ExtensionContext,
  services: CommandServices
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.standalone.configure', () => {
      services.standaloneServerViewProvider.show();
    }),

    vscode.commands.registerCommand('v8vscedit.standalone.start', async () => {
      const status = await runServerOperation(services, 'Запуск автономного сервера', () =>
        services.standaloneServerService.start()
      );
      showStatusMessage(status);
    }),

    vscode.commands.registerCommand('v8vscedit.standalone.restart', async () => {
      const status = await runServerOperation(services, 'Перезапуск автономного сервера', () =>
        services.standaloneServerService.restart()
      );
      showStatusMessage(status);
    }),

    vscode.commands.registerCommand('v8vscedit.standalone.stop', async () => {
      const status = await runServerOperation(services, 'Остановка автономного сервера', () =>
        services.standaloneServerService.stop()
      );
      showStatusMessage(status);
    }),

    vscode.commands.registerCommand('v8vscedit.standalone.openWebClient', async () => {
      const result = await runServerOperation(services, 'Открытие веб-клиента', () =>
        prepareWebClient(services)
      );
      if (!result) {
        return;
      }
      if (result.kind === 'configure') {
        services.standaloneServerViewProvider.show();
        return;
      }
      if (!result.status.url) {
        await vscode.window.showErrorMessage('Не удалось определить URL автономного сервера.');
        return;
      }

      await vscode.env.openExternal(vscode.Uri.parse(result.status.url));
      if (!result.ready) {
        void vscode.window.showWarningMessage(
          'Веб-клиент открыт, но HTTP-порт автономного сервера не ответил за 15 секунд. Проверьте лог сервера.'
        );
      }
    }),

    vscode.commands.registerCommand('v8vscedit.standalone.showLog', async () => {
      const logPath = services.standaloneServerService.getLogPath();
      if (!fs.existsSync(logPath)) {
        await vscode.window.showInformationMessage('Лог автономного сервера ещё не создан.');
        return;
      }
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(logPath));
      await vscode.window.showTextDocument(document, { preview: true });
    })
  );
}

type OpenWebClientResult =
  | { readonly kind: 'configure' }
  | { readonly kind: 'open'; readonly status: StandaloneServerStatus; readonly ready: boolean };

async function prepareWebClient(services: CommandServices): Promise<OpenWebClientResult> {
  const status = services.standaloneServerService.getStatus();
  if (!status.configured) {
    return { kind: 'configure' };
  }
  if (status.state !== 'running') {
    await services.standaloneServerService.start();
  }
  const ready = await services.standaloneServerService.waitForHttpReady(15_000);
  return {
    kind: 'open',
    status: services.standaloneServerService.getStatus(),
    ready,
  };
}

async function runServerOperation(
  services: CommandServices,
  title: string,
  operation: () => Promise<StandaloneServerStatus>
): Promise<StandaloneServerStatus | undefined>;
async function runServerOperation(
  services: CommandServices,
  title: string,
  operation: () => Promise<OpenWebClientResult>
): Promise<OpenWebClientResult | undefined>;
async function runServerOperation<T>(
  services: CommandServices,
  title: string,
  operation: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false,
    }, operation);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    services.outputChannel.appendLine(`[standalone][error] ${text}`);
    await vscode.window.showErrorMessage(`${title} не выполнен.\n${text}`, { modal: true });
  } finally {
    services.refreshActionsView();
  }
}

function showStatusMessage(status: StandaloneServerStatus | undefined): void {
  if (!status) {
    return;
  }
  void vscode.window.showInformationMessage(status.message);
}
