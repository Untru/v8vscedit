import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MetaPathResolver } from '../../infra/fs/MetaPathResolver';

suite('MetaPathResolver', () => {
  test('создаёт отсутствующий модуль объекта в штатном каталоге Ext', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v8vscedit-module-path-'));
    const sourceXmlPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'example',
      'src',
      'cf',
      'Catalogs',
      'ОКПД2ПоВидамПродукцииИС.xml'
    );
    const objectName = path.basename(sourceXmlPath, '.xml');
    const targetFolder = path.join(tempRoot, 'Catalogs');
    const targetXmlPath = path.join(targetFolder, `${objectName}.xml`);

    fs.mkdirSync(targetFolder, { recursive: true });
    fs.copyFileSync(sourceXmlPath, targetXmlPath);

    const modulePath = new MetaPathResolver().ensureModule({ xmlPath: targetXmlPath, kind: 'Catalog' }, 'Object');

    assert.strictEqual(modulePath, path.join(targetFolder, objectName, 'Ext', 'ObjectModule.bsl'));
    assert.strictEqual(fs.readFileSync(modulePath, 'utf8'), '');
  });

  test('создаёт модуль менеджера для справочника (разрешённый слот)', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v8vscedit-module-path-'));
    const xmlPath = path.join(tempRoot, 'Catalogs', 'TestCatalog.xml');
    fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
    fs.writeFileSync(xmlPath, '');

    const modulePath = new MetaPathResolver().ensureModule({ xmlPath, kind: 'Catalog' }, 'Manager');

    assert.ok(modulePath?.endsWith('ManagerModule.bsl'));
  });

  test('запрещает создание ObjectModule для регистра сведений', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v8vscedit-module-path-'));
    const xmlPath = path.join(tempRoot, 'InformationRegisters', 'TestRegister.xml');
    fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
    fs.writeFileSync(xmlPath, '');

    assert.throws(
      () => new MetaPathResolver().ensureModule({ xmlPath, kind: 'InformationRegister' }, 'Object'),
      /не поддерживает слот/
    );
  });

  test('запрещает создание ObjectModule для регистра накопления', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v8vscedit-module-path-'));
    const xmlPath = path.join(tempRoot, 'AccumulationRegisters', 'TestRegister.xml');
    fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
    fs.writeFileSync(xmlPath, '');

    assert.throws(
      () => new MetaPathResolver().ensureModule({ xmlPath, kind: 'AccumulationRegister' }, 'Object'),
      /не поддерживает слот/
    );
  });

  test('разрешает создание ManagerModule для регистра сведений', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'v8vscedit-module-path-'));
    const xmlPath = path.join(tempRoot, 'InformationRegisters', 'TestRegister.xml');
    fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
    fs.writeFileSync(xmlPath, '');

    const modulePath = new MetaPathResolver().ensureModule({ xmlPath, kind: 'InformationRegister' }, 'Manager');

    assert.ok(modulePath?.endsWith('ManagerModule.bsl'));
  });
});
