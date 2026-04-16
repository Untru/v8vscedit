import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { buildNode } from '../nodes/_base';
import { getNodeDescriptor } from '../nodes';
import { extractSimpleTag, extractSynonym } from '../ConfigParser';
import {
  HandlerContext,
  LocalizedStringValue,
  ObjectHandler,
  ObjectPropertiesCollection,
} from './_types';

// ---------------------------------------------------------------------------
// Свойства объекта «Параметр сеанса» (SessionParameter) в XML-выгрузке 1С:
//
// Name    (string)           — имя параметра
// Synonym (LocalizedString) — синоним
// Comment (string)          — комментарий разработчика
// Type    (составной тип)   — один или несколько <v8:Type>, примитивы с квалификаторами
//                             (<v8:StringQualifiers>, <v8:NumberQualifiers>, …)
// ---------------------------------------------------------------------------

const FOLDER_NAME = 'SessionParameters';

export const sessionParameterHandler: ObjectHandler = {
  buildTreeNodes(ctx: HandlerContext) {
    const descriptor = getNodeDescriptor('SessionParameter');
    const folderPath = path.join(ctx.configRoot, FOLDER_NAME);

    /** Имена уже в порядке следования тегов <SessionParameter> в Configuration.xml */
    return ctx.names.map((name) => {
      const xmlPath = resolveSessionParameterXml(folderPath, name);

      let ownershipTag: 'OWN' | 'BORROWED' | undefined;
      if (ctx.configKind === 'cfe' && ctx.namePrefix) {
        ownershipTag = name.startsWith(ctx.namePrefix) ? 'OWN' : 'BORROWED';
      }

      const node = buildNode(descriptor, {
        label: name,
        kind: 'SessionParameter',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        xmlPath,
        childrenLoader: undefined,
        ownershipTag,
      });

      let cachedSynonym: string | undefined;
      Object.defineProperty(node, 'tooltip', {
        get: () => {
          if (cachedSynonym !== undefined) {
            return cachedSynonym;
          }
          if (xmlPath) {
            try {
              const xml = fs.readFileSync(xmlPath, 'utf-8');
              cachedSynonym = extractSynonym(xml) || '';
            } catch {
              cachedSynonym = '';
            }
          } else {
            cachedSynonym = '';
          }
          return cachedSynonym;
        },
        enumerable: true,
        configurable: true,
      });

      return node;
    });
  },

  canShowProperties(node) {
    return node.nodeKind === 'SessionParameter' && Boolean(node.xmlPath);
  },

  getProperties(node) {
    if (!node.xmlPath || !fs.existsSync(node.xmlPath)) {
      return [];
    }

    const xml = fs.readFileSync(node.xmlPath, 'utf-8');
    const props: ObjectPropertiesCollection = [];

    /** Прямые дочерние элементы <Properties> — порядок как в файле выгрузки */
    for (const { tag, inner } of extractTopLevelPropertiesChildren(xml)) {
      if (tag === 'Name') {
        props.push({
          key: 'Name',
          title: 'Имя',
          kind: 'string',
          value: inner.trim() || node.label,
        });
        continue;
      }
      if (tag === 'Synonym') {
        props.push({
          key: 'Synonym',
          title: 'Синоним',
          kind: 'localizedString',
          value: parseLocalizedStringSection(inner),
        });
        continue;
      }
      if (tag === 'Comment') {
        props.push({
          key: 'Comment',
          title: 'Комментарий',
          kind: 'string',
          value: inner.trim(),
        });
        continue;
      }
      if (tag === 'Type') {
        props.push({
          key: 'Type',
          title: 'Тип',
          kind: 'string',
          value: formatSessionParameterType(inner),
        });
        continue;
      }

      props.push({
        key: tag,
        title: tag,
        kind: 'string',
        value: inner.trim().length > 0 ? formatUnknownPropertyInner(inner) : '',
      });
    }

    return props;
  },
};

/** Резолвит путь к XML параметра сеанса (глубокая или плоская структура) */
function resolveSessionParameterXml(folderPath: string, name: string): string | undefined {
  const deep = path.join(folderPath, name, `${name}.xml`);
  if (fs.existsSync(deep)) {
    return deep;
  }

  const flat = path.join(folderPath, `${name}.xml`);
  if (fs.existsSync(flat)) {
    return flat;
  }

  return undefined;
}

/**
 * Возвращает верхнеуровневые дочерние элементы секции <Properties> в порядке XML.
 * Учитывает вложенность (тело элемента — всё до парного закрывающего тега).
 */
function extractTopLevelPropertiesChildren(xml: string): Array<{ tag: string; inner: string }> {
  const block = extractFirstBalancedBlock(xml, 'Properties');
  if (!block) {
    return [];
  }

  const result: Array<{ tag: string; inner: string }> = [];
  let pos = 0;
  const s = block;

  while (pos < s.length) {
    while (pos < s.length && /\s/.test(s[pos])) {
      pos++;
    }
    if (pos >= s.length) {
      break;
    }
    if (s[pos] !== '<') {
      pos++;
      continue;
    }
    if (s.startsWith('<!--', pos)) {
      const end = s.indexOf('-->', pos + 4);
      pos = end >= 0 ? end + 3 : s.length;
      continue;
    }

    const openMatch = /^<([^\s>/]+)(\s[^>]*)?>/.exec(s.slice(pos));
    if (!openMatch) {
      pos++;
      continue;
    }

    const tagName = openMatch[1];
    const openFullLen = openMatch[0].length;
    const isEmptyElement = openMatch[0].trimEnd().endsWith('/>');

    if (isEmptyElement) {
      result.push({ tag: tagName, inner: '' });
      pos += openFullLen;
      continue;
    }

    const innerStart = pos + openFullLen;
    const closeSeq = `</${tagName}>`;
    const innerEnd = findClosingTagIndex(s, innerStart, tagName);
    if (innerEnd < 0) {
      break;
    }

    result.push({ tag: tagName, inner: s.slice(innerStart, innerEnd) });
    pos = innerEnd + closeSeq.length;
  }

  return result;
}

/** Первое вхождение <tagName>...</tagName> с учётом вложенных одноимённых тегов */
function extractFirstBalancedBlock(xml: string, tagName: string): string | null {
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'm');
  const openM = openRe.exec(xml);
  if (!openM) {
    return null;
  }
  const innerStart = openM.index + openM[0].length;
  const end = findClosingTagIndex(xml, innerStart, tagName);
  if (end < 0) {
    return null;
  }
  return xml.slice(innerStart, end);
}

/** Индекс начала `</tagName>` для блока, начинающегося с innerStart */
function findClosingTagIndex(xml: string, innerStart: number, tagName: string): number {
  const openTag = new RegExp(`<${tagName}\\b[^>]*>`, 'g');
  const closeTag = `</${tagName}>`;
  let depth = 1;
  let pos = innerStart;

  openTag.lastIndex = 0;

  while (depth > 0 && pos < xml.length) {
    const nextClose = xml.indexOf(closeTag, pos);
    if (nextClose < 0) {
      return -1;
    }

    openTag.lastIndex = pos;
    const nextOpen = openTag.exec(xml);
    if (nextOpen != null && nextOpen.index < nextClose) {
      depth++;
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) {
        return nextClose;
      }
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

/** Парсит тело секции Synonym в структуру для панели свойств */
function parseLocalizedStringSection(inner: string): LocalizedStringValue {
  const values = Array.from(
    inner.matchAll(/<v8:item>\s*<v8:lang>([^<]*)<\/v8:lang>\s*<v8:content>([\s\S]*?)<\/v8:content>\s*<\/v8:item>/g)
  ).map((match) => ({
    lang: match[1].trim(),
    content: match[2].trim(),
  }));

  return {
    presentation: values[0]?.content ?? '',
    values,
  };
}

/**
 * Человекочитаемое описание типа параметра сеанса:
 * список ссылок/примитивов и при наличии — квалификаторы строки, числа, даты.
 */
function formatSessionParameterType(typeInner: string): string {
  const lines: string[] = [];

  const types = Array.from(typeInner.matchAll(/<v8:Type>([^<]*)<\/v8:Type>/g)).map((m) => m[1].trim());
  if (types.length > 0) {
    lines.push(types.join('\n'));
  }

  const stringQ = extractFirstBalancedBlock(typeInner, 'v8:StringQualifiers');
  if (stringQ) {
    const len = extractSimpleTag(stringQ, 'v8:Length');
    const allowed = extractSimpleTag(stringQ, 'v8:AllowedLength');
    const parts = [`Строка: длина=${len ?? '—'}`, `допустимая длина=${allowed ?? '—'}`];
    lines.push(parts.join(', '));
  }

  const numQ = extractFirstBalancedBlock(typeInner, 'v8:NumberQualifiers');
  if (numQ) {
    const digits = extractSimpleTag(numQ, 'v8:Digits');
    const frac = extractSimpleTag(numQ, 'v8:FractionDigits');
    const allowedSign = extractSimpleTag(numQ, 'v8:AllowedSign');
    lines.push(`Число: разрядов=${digits ?? '—'}, дробных=${frac ?? '—'}, знак=${allowedSign ?? '—'}`);
  }

  const dateQ = extractFirstBalancedBlock(typeInner, 'v8:DateQualifiers');
  if (dateQ) {
    const datePortions = extractSimpleTag(dateQ, 'v8:DateFractions');
    lines.push(`Дата: состав даты=${datePortions ?? '—'}`);
  }

  if (lines.length === 0) {
    return typeInner.replace(/\s+/g, ' ').trim();
  }

  return lines.join('\n\n');
}

/** Сжимает произвольное XML-содержимое свойства для отображения в одной строке */
function formatUnknownPropertyInner(inner: string): string {
  const collapsed = inner.replace(/\s+/g, ' ').trim();
  return collapsed.length > 2000 ? `${collapsed.slice(0, 2000)}…` : collapsed;
}
