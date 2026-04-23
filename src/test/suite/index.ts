// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mocha = require('mocha');

/**
 * Webpack-совместимый test runner.
 *
 * При бандлинге webpack'ом все .test.ts файлы попадают в один бандл.
 * Мы загружаем их через require.context, но сначала привязываем
 * глобальные suite/test к нашему экземпляру Mocha через pre-require.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });

  // Привязываем suite/test к нашему экземпляру Mocha
  mocha.suite.emit('pre-require', global, '', mocha);

  // Загружаем тестовые модули — webpack собирает их в бандл
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (require as any).context('.', true, /\.test$/);
  for (const key of ctx.keys()) {
    ctx(key);
  }

  return new Promise((resolve, reject) => {
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
