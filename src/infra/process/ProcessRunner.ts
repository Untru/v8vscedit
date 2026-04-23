import { spawn } from 'child_process';

export interface ProcessRunOptions {
  command: string;
  args: string[];
  cwd?: string;
  shell?: boolean;
  onStdout?: (chunk: Buffer) => void;
  onStderr?: (chunk: Buffer) => void;
}

export interface ProcessRunResult {
  exitCode: number;
  lastStdout: string;
  lastStderr: string;
}

/**
 * Запускает внешний процесс и возвращает код завершения и последние строки потоков.
 * Используется как единая точка запуска CLI-инструментов.
 */
export async function runProcess(options: ProcessRunOptions): Promise<ProcessRunResult> {
  return new Promise<ProcessRunResult>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      shell: options.shell ?? false,
    });

    let lastStdout = '';
    let lastStderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      lastStdout = chunk.toString('utf-8').trim();
      options.onStdout?.(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      lastStderr = chunk.toString('utf-8').trim();
      options.onStderr?.(chunk);
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        lastStdout,
        lastStderr,
      });
    });
  });
}
