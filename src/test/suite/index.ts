import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mocha = require('mocha');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const glob = require('glob');

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true });
  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((resolve, reject) => {
    const files: string[] = glob.sync('**/*.test.js', { cwd: testsRoot });
    files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));
    try {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} тест(ов) провалено`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
