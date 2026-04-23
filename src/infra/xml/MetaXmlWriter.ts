/**
 * Сервис записи изменений свойств метаданных обратно в XML-файлы.
 * Использует regex-замену тегов, аналогично тому как ConfigParser читает.
 */

import * as fs from 'fs';

/**
 * Обновить значение простого тега в XML-файле.
 * Заменяет содержимое тега `<TagName>oldValue</TagName>` на `<TagName>newValue</TagName>`.
 */
export function updateSimpleTag(
  xmlPath: string,
  tagName: string,
  newValue: string
): boolean {
  let xml = fs.readFileSync(xmlPath, 'utf-8');

  // Простой тег: <TagName>value</TagName>
  const simpleRegex = new RegExp(
    `(<${tagName}>)(.*?)(</${tagName}>)`,
    's'
  );

  if (simpleRegex.test(xml)) {
    xml = xml.replace(simpleRegex, `$1${escapeXml(newValue)}$3`);
    fs.writeFileSync(xmlPath, xml, 'utf-8');
    return true;
  }

  return false;
}

/**
 * Обновить значение локализованной строки (Synonym, Comment).
 * Ищет первый v8:content внутри тега и заменяет его содержимое.
 */
export function updateLocalizedTag(
  xmlPath: string,
  tagName: string,
  newValue: string
): boolean {
  let xml = fs.readFileSync(xmlPath, 'utf-8');

  // Найти блок <TagName>...</TagName>
  const blockRegex = new RegExp(
    `(<${tagName}>)([\\s\\S]*?)(</${tagName}>)`
  );
  const blockMatch = xml.match(blockRegex);
  if (!blockMatch) return false;

  const block = blockMatch[2];

  // Заменить первый v8:content
  const contentRegex = /(<v8:content>)([\s\S]*?)(<\/v8:content>)/;
  if (contentRegex.test(block)) {
    const newBlock = block.replace(contentRegex, `$1${escapeXml(newValue)}$3`);
    xml = xml.replace(blockRegex, `$1${newBlock}$3`);
    fs.writeFileSync(xmlPath, xml, 'utf-8');
    return true;
  }

  return false;
}

/**
 * Обновить булево свойство в блоке <Properties>.
 */
export function updateBooleanTag(
  xmlPath: string,
  tagName: string,
  newValue: boolean
): boolean {
  return updateSimpleTag(xmlPath, tagName, newValue ? 'true' : 'false');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
