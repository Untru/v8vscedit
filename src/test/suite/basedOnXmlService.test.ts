import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BasedOnXmlService } from '../../infra/xml';

suite('BasedOnXmlService', () => {
  test('Редактирует прямой и обратный ввод на основании', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v8vscedit-based-on-'));
    fs.mkdirSync(path.join(root, 'Catalogs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'Documents'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Configuration.xml'), buildConfigXml(), 'utf-8');
    fs.writeFileSync(path.join(root, 'Catalogs', 'Клиенты.xml'), buildObjectXml('Catalog', 'Клиенты'), 'utf-8');
    fs.writeFileSync(path.join(root, 'Catalogs', 'Партнеры.xml'), buildObjectXml('Catalog', 'Партнеры'), 'utf-8');
    fs.writeFileSync(path.join(root, 'Documents', 'Заказ.xml'), buildObjectXml('Document', 'Заказ'), 'utf-8');

    const service = new BasedOnXmlService();
    const direct = service.setBasedOn(root, 'Catalog', 'Клиенты', ['Catalog.Партнеры', 'Document.Заказ']);
    assert.strictEqual(direct.changed, true);
    let snapshot = service.readSnapshot(root, 'Catalog', 'Клиенты');
    assert.deepStrictEqual(snapshot.basedOn.map((item) => item.ref), ['Catalog.Партнеры', 'Document.Заказ']);

    const inverse = service.setBasedFor(root, 'Catalog', 'Клиенты', ['Document.Заказ']);
    assert.strictEqual(inverse.changed, true);
    snapshot = service.readSnapshot(root, 'Catalog', 'Клиенты');
    assert.deepStrictEqual(snapshot.basedFor.map((item) => item.ref), ['Document.Заказ']);

    const orderXml = fs.readFileSync(path.join(root, 'Documents', 'Заказ.xml'), 'utf-8');
    assert.ok(orderXml.includes('<xr:Item xsi:type="xr:MDObjectRef">Catalog.Клиенты</xr:Item>'));

    const removed = service.setBasedFor(root, 'Catalog', 'Клиенты', []);
    assert.strictEqual(removed.changed, true);
    const orderXmlAfterRemove = fs.readFileSync(path.join(root, 'Documents', 'Заказ.xml'), 'utf-8');
    assert.ok(!orderXmlAfterRemove.includes('Catalog.Клиенты'));
  });
});

function buildConfigXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<MetaDataObject>
  <Configuration>
    <Properties><Name>Тест</Name></Properties>
    <ChildObjects>
      <Catalog>Клиенты</Catalog>
      <Catalog>Партнеры</Catalog>
      <Document>Заказ</Document>
    </ChildObjects>
  </Configuration>
</MetaDataObject>`;
}

function buildObjectXml(kind: 'Catalog' | 'Document', name: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<MetaDataObject>
  <${kind}>
    <Properties>
      <Name>${name}</Name>
      <BasedOn/>
    </Properties>
  </${kind}>
</MetaDataObject>`;
}
