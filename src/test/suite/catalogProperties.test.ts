import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { buildRootMetaObjectProperties } from '../../ui/views/properties/PropertyBuilder';
import type { EnumPropertyValue, LocalizedStringValue } from '../../ui/views/properties/_types';

const EXAMPLE_CFE = path.resolve(process.cwd(), 'example/src/cfe/EVOLC');

suite('Properties — справочник', () => {
  test('Показывает свойства справочника по разделам конфигуратора', () => {
    const xml = fs.readFileSync(path.join(EXAMPLE_CFE, 'Catalogs', 'ев_КлиентыПартнеров.xml'), 'utf-8');
    const props = buildRootMetaObjectProperties(xml, 'Catalog');

    const keys = props.map((item) => item.key);
    assert.ok(keys.includes('Hierarchical'), 'Hierarchical не найден');
    assert.ok(keys.includes('Owners'), 'Owners не найден');
    assert.ok(keys.includes('DescriptionLength'), 'DescriptionLength не найден');
    assert.ok(keys.includes('DefaultFolderForm'), 'DefaultFolderForm не найден');
    assert.ok(keys.includes('InputByString'), 'InputByString не найден');
    assert.ok(keys.includes('UseStandardCommands'), 'UseStandardCommands не найден');
    assert.ok(keys.includes('BasedOn'), 'BasedOn не найден');
    assert.ok(keys.includes('PredefinedDataUpdate'), 'PredefinedDataUpdate не найден');

    const owners = props.find((item) => item.key === 'Owners');
    assert.ok(owners, 'Owners не найден');
    assert.strictEqual(owners.readonly, true);
    assert.strictEqual(owners.section, 'Владельцы');
    assert.strictEqual(owners.value, 'Справочники.Контрагенты');

    const codeType = props.find((item) => item.key === 'CodeType');
    assert.ok(codeType, 'CodeType не найден');
    assert.strictEqual(codeType.kind, 'enum');
    assert.strictEqual((codeType.value as EnumPropertyValue).currentLabel, 'Строка');
    assert.strictEqual(codeType.section, 'Данные');

    const autonumbering = props.find((item) => item.key === 'Autonumbering');
    assert.ok(autonumbering, 'Autonumbering не найден');
    assert.strictEqual(autonumbering.section, 'Нумерация');

    const inputByString = props.find((item) => item.key === 'InputByString');
    assert.ok(inputByString, 'InputByString не найден');
    assert.strictEqual(inputByString.readonly, true);
    assert.strictEqual(inputByString.section, 'Поле ввода');
    assert.ok(typeof inputByString.value === 'string' && inputByString.value.includes('StandardAttribute.Code'));
    assert.ok(typeof inputByString.value === 'string' && inputByString.value.includes('StandardAttribute.Description'));

    const basedOn = props.find((item) => item.key === 'BasedOn');
    assert.ok(basedOn, 'BasedOn не найден');
    assert.strictEqual(basedOn.section, 'Ввод на основании');
    assert.strictEqual(basedOn.readonly, true);

    const objectPresentation = props.find((item) => item.key === 'ObjectPresentation');
    assert.ok(objectPresentation, 'ObjectPresentation не найден');
    assert.strictEqual(objectPresentation.kind, 'localizedString');
    assert.strictEqual(objectPresentation.title, 'Представление объекта');
    assert.strictEqual(objectPresentation.section, 'Основные');
    assert.strictEqual((objectPresentation.value as LocalizedStringValue).presentation, 'Клиент партнера');

    const listPresentation = props.find((item) => item.key === 'ListPresentation');
    assert.ok(listPresentation, 'ListPresentation не найден');
    assert.strictEqual(listPresentation.kind, 'localizedString');
    assert.strictEqual(listPresentation.title, 'Представление списка');
    assert.strictEqual(listPresentation.section, 'Основные');
    assert.strictEqual((listPresentation.value as LocalizedStringValue).presentation, 'Клиенты партнеров');
  });
});
