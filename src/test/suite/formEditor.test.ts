import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { parseFormXml } from '../../formEditor/FormXmlParser';
import { FormXmlDocument } from '../../formEditor/FormXmlSerializer';
import { getObjectLocationFromXml } from '../../ModulePathResolver';

// ── Фикстуры: XML формы создаются inline ──────────────────────────────────

/** Минимальная форма с группой, двумя полями ввода и кнопкой */
const SIMPLE_FORM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Form xmlns="http://v8.1c.ru/8.3/xcf/readable"
      xmlns:v8="http://v8.1c.ru/8.1/data/core"
      xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <ChildItems>
    <UsualGroup name="ГруппаОсновная" id="1">
      <Group>Vertical</Group>
      <Title>
        <v8:item>
          <v8:content>Основная</v8:content>
        </v8:item>
      </Title>
      <ChildItems>
        <InputField name="Наименование" id="2">
          <DataPath>Объект.Наименование</DataPath>
          <Title>
            <v8:item>
              <v8:content>Наименование</v8:content>
            </v8:item>
          </Title>
          <Width>40</Width>
        </InputField>
        <InputField name="Код" id="3">
          <DataPath>Объект.Код</DataPath>
          <ReadOnly>true</ReadOnly>
        </InputField>
      </ChildItems>
    </UsualGroup>
    <Button name="КнопкаЗаписать" id="4">
      <Title>
        <v8:item>
          <v8:content>Записать</v8:content>
        </v8:item>
      </Title>
    </Button>
  </ChildItems>
  <Attributes>
    <Attribute name="Объект" id="1">
      <Type>
        <v8:Type>xs:string</v8:Type>
      </Type>
      <MainAttribute>true</MainAttribute>
      <SavedData>true</SavedData>
      <Columns>
        <Column name="Наименование" id="10">
          <Type>
            <v8:Type>xs:string</v8:Type>
          </Type>
        </Column>
        <Column name="Код" id="11">
          <Type>
            <v8:Type>xs:string</v8:Type>
          </Type>
        </Column>
      </Columns>
    </Attribute>
    <Attribute name="ДополнительныйРеквизит" id="2">
      <Type>
        <v8:Type>xs:decimal</v8:Type>
      </Type>
    </Attribute>
  </Attributes>
  <Commands>
    <Command name="КомандаЗаписать" id="1">
      <Title>
        <v8:item>
          <v8:content>Записать и закрыть</v8:content>
        </v8:item>
      </Title>
      <Action>КомандаЗаписать</Action>
    </Command>
    <Command name="КомандаПечать" id="2">
      <Action>КомандаПечать</Action>
      <Representation>Auto</Representation>
    </Command>
  </Commands>
  <Events>
    <Event name="ПриОткрытии">ПриОткрытии</Event>
    <Event name="ПриЗакрытии">ПриЗакрытии</Event>
  </Events>
</Form>`;

/** Пустая форма — только корневой тег */
const EMPTY_FORM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Form xmlns="http://v8.1c.ru/8.3/xcf/readable">
</Form>`;

/** Форма с вложенными страницами */
const PAGES_FORM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Form xmlns="http://v8.1c.ru/8.3/xcf/readable"
      xmlns:v8="http://v8.1c.ru/8.1/data/core">
  <ChildItems>
    <Pages name="Страницы" id="1">
      <ChildItems>
        <Page name="Страница1" id="2">
          <Title>
            <v8:item>
              <v8:content>Основное</v8:content>
            </v8:item>
          </Title>
          <ChildItems>
            <InputField name="ПолеНаСтранице" id="3">
              <DataPath>Объект.Поле</DataPath>
            </InputField>
          </ChildItems>
        </Page>
        <Page name="Страница2" id="4">
          <Title>
            <v8:item>
              <v8:content>Дополнительно</v8:content>
            </v8:item>
          </Title>
        </Page>
      </ChildItems>
    </Pages>
  </ChildItems>
</Form>`;

// ── Тесты FormXmlParser ────────────────────────────────────────────────────

suite('FormXmlParser — парсинг формы', () => {
  test('Парсит элементы формы: группа, поля, кнопка', () => {
    const model = parseFormXml(SIMPLE_FORM_XML);
    const root = model.root;

    assert.strictEqual(root.name, '__root__');
    assert.strictEqual(root.children.length, 2, 'Ожидаются 2 элемента верхнего уровня');

    const group = root.children[0];
    assert.strictEqual(group.type, 'UsualGroup');
    assert.strictEqual(group.name, 'ГруппаОсновная');
    assert.strictEqual(group.id, 1);
    assert.strictEqual(group.group, 'Vertical');
    assert.strictEqual(group.title, 'Основная');
    assert.strictEqual(group.children.length, 2);

    const nameField = group.children[0];
    assert.strictEqual(nameField.type, 'InputField');
    assert.strictEqual(nameField.name, 'Наименование');
    assert.strictEqual(nameField.dataPath, 'Объект.Наименование');
    assert.strictEqual(nameField.width, 40);

    const codeField = group.children[1];
    assert.strictEqual(codeField.name, 'Код');
    assert.strictEqual(codeField.readOnly, true);

    const button = root.children[1];
    assert.strictEqual(button.type, 'Button');
    assert.strictEqual(button.name, 'КнопкаЗаписать');
    assert.strictEqual(button.title, 'Записать');
  });

  test('Парсит реквизиты формы с колонками', () => {
    const model = parseFormXml(SIMPLE_FORM_XML);

    assert.strictEqual(model.attributes.length, 2);

    const mainAttr = model.attributes[0];
    assert.strictEqual(mainAttr.name, 'Объект');
    assert.strictEqual(mainAttr.isMain, true);
    assert.strictEqual(mainAttr.savedData, true);
    assert.ok(mainAttr.columns);
    assert.strictEqual(mainAttr.columns!.length, 2);
    assert.strictEqual(mainAttr.columns![0].name, 'Наименование');
    assert.strictEqual(mainAttr.columns![1].name, 'Код');

    const extraAttr = model.attributes[1];
    assert.strictEqual(extraAttr.name, 'ДополнительныйРеквизит');
    assert.strictEqual(extraAttr.valueType, 'xs:decimal');
  });

  test('Парсит команды формы', () => {
    const model = parseFormXml(SIMPLE_FORM_XML);
    assert.strictEqual(model.commands.length, 2);

    assert.strictEqual(model.commands[0].name, 'КомандаЗаписать');
    assert.strictEqual(model.commands[0].title, 'Записать и закрыть');
    assert.strictEqual(model.commands[0].action, 'КомандаЗаписать');

    assert.strictEqual(model.commands[1].name, 'КомандаПечать');
    assert.strictEqual(model.commands[1].representation, 'Auto');
  });

  test('Парсит события формы', () => {
    const model = parseFormXml(SIMPLE_FORM_XML);
    assert.strictEqual(model.events.length, 2);
    assert.strictEqual(model.events[0].name, 'ПриОткрытии');
    assert.strictEqual(model.events[1].handler, 'ПриЗакрытии');
  });

  test('Пустая форма — пустая модель', () => {
    const model = parseFormXml(EMPTY_FORM_XML);
    assert.strictEqual(model.root.children.length, 0);
    assert.strictEqual(model.attributes.length, 0);
    assert.strictEqual(model.commands.length, 0);
    assert.strictEqual(model.events.length, 0);
  });

  test('Вложенные страницы Pages → Page → элементы', () => {
    const model = parseFormXml(PAGES_FORM_XML);
    const pages = model.root.children[0];
    assert.strictEqual(pages.type, 'Pages');
    assert.strictEqual(pages.children.length, 2);

    const page1 = pages.children[0];
    assert.strictEqual(page1.type, 'Page');
    assert.strictEqual(page1.title, 'Основное');
    assert.strictEqual(page1.children.length, 1);
    assert.strictEqual(page1.children[0].dataPath, 'Объект.Поле');

    assert.strictEqual(pages.children[1].children.length, 0);
  });

  test('Некорректный XML — пустая модель без исключения', () => {
    const model = parseFormXml('<NotAForm><Random/></NotAForm>');
    assert.strictEqual(model.root.children.length, 0);
    assert.strictEqual(model.attributes.length, 0);
  });
});

// ── Тесты FormXmlSerializer (round-trip) ───────────────────────────────────

suite('FormXmlSerializer — round-trip', () => {
  test('Парсинг → сериализация сохраняет структуру', () => {
    const doc = new FormXmlDocument(SIMPLE_FORM_XML);
    const serialized = doc.serialize();
    const model = parseFormXml(serialized);

    assert.strictEqual(model.root.children.length, 2);
    assert.strictEqual(model.attributes.length, 2);
    assert.strictEqual(model.commands.length, 2);
    assert.strictEqual(model.events.length, 2);

    const group = model.root.children[0];
    assert.strictEqual(group.type, 'UsualGroup');
    assert.strictEqual(group.children.length, 2);
    assert.strictEqual(group.children[0].name, 'Наименование');
  });

  test('Перемещение элемента сохраняется', () => {
    const doc = new FormXmlDocument(SIMPLE_FORM_XML);
    // Перемещаем кнопку (id=4) в группу (id=1), перед элементом Наименование (id=2)
    doc.moveElement(4, 1, 2);
    const model = parseFormXml(doc.serialize());

    assert.strictEqual(model.root.children.length, 1, 'Кнопка перемещена в группу');
    const group = model.root.children[0];
    assert.strictEqual(group.children.length, 3);
    assert.strictEqual(group.children[0].name, 'КнопкаЗаписать', 'Кнопка перед Наименованием');
  });

  test('Удаление элемента сохраняется', () => {
    const doc = new FormXmlDocument(SIMPLE_FORM_XML);
    doc.deleteElement(4);
    const model = parseFormXml(doc.serialize());

    assert.strictEqual(model.root.children.length, 1);
    assert.strictEqual(model.root.children[0].type, 'UsualGroup');
  });
});

// ── Тесты путей к Form.xml ────────────────────────────────────────────────

suite('Пути к Form.xml для openFormEditor', () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v8test-'));

    // Catalogs/Номенклатура/Номенклатура.xml + Forms/ФормаЭлемента/Ext/Form.xml
    const catDir = path.join(tmpDir, 'Catalogs', 'Номенклатура');
    const catFormDir = path.join(catDir, 'Forms', 'ФормаЭлемента', 'Ext');
    fs.mkdirSync(catFormDir, { recursive: true });
    fs.writeFileSync(path.join(catDir, 'Номенклатура.xml'), '<root/>');
    fs.writeFileSync(path.join(catFormDir, 'Form.xml'), SIMPLE_FORM_XML);

    // CommonForms/ОбщаяФорма/ОбщаяФорма.xml + Ext/Form.xml
    const cfDir = path.join(tmpDir, 'CommonForms', 'ОбщаяФорма');
    const cfExtDir = path.join(cfDir, 'Ext');
    fs.mkdirSync(cfExtDir, { recursive: true });
    fs.writeFileSync(path.join(cfDir, 'ОбщаяФорма.xml'), '<root/>');
    fs.writeFileSync(path.join(cfExtDir, 'Form.xml'), SIMPLE_FORM_XML);
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getObjectLocationFromXml — глубокая структура', () => {
    const xmlPath = path.join(tmpDir, 'Catalogs', 'Номенклатура', 'Номенклатура.xml');
    const loc = getObjectLocationFromXml(xmlPath);
    assert.strictEqual(loc.objectName, 'Номенклатура');
    assert.strictEqual(loc.folderName, 'Catalogs');
  });

  test('Путь к Form.xml формы объекта', () => {
    const xmlPath = path.join(tmpDir, 'Catalogs', 'Номенклатура', 'Номенклатура.xml');
    const loc = getObjectLocationFromXml(xmlPath);
    const formXmlPath = path.join(loc.objectDir, 'Forms', 'ФормаЭлемента', 'Ext', 'Form.xml');

    assert.ok(fs.existsSync(formXmlPath));
    const model = parseFormXml(fs.readFileSync(formXmlPath, 'utf-8'));
    assert.strictEqual(model.root.children.length, 2);
  });

  test('Путь к Form.xml общей формы', () => {
    const xmlPath = path.join(tmpDir, 'CommonForms', 'ОбщаяФорма', 'ОбщаяФорма.xml');
    const loc = getObjectLocationFromXml(xmlPath);
    const formXmlPath = path.join(loc.objectDir, 'Ext', 'Form.xml');

    assert.ok(fs.existsSync(formXmlPath));
    const model = parseFormXml(fs.readFileSync(formXmlPath, 'utf-8'));
    assert.strictEqual(model.root.children.length, 2);
  });

  test('Несуществующая форма — файл не найден', () => {
    const xmlPath = path.join(tmpDir, 'Catalogs', 'Номенклатура', 'Номенклатура.xml');
    const loc = getObjectLocationFromXml(xmlPath);
    const formXmlPath = path.join(loc.objectDir, 'Forms', 'НесуществующаяФорма', 'Ext', 'Form.xml');
    assert.ok(!fs.existsSync(formXmlPath));
  });
});
