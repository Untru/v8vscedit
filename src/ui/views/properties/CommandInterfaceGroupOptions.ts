import * as fs from 'fs';
import * as path from 'path';
import { extractSimpleTag, extractSynonym } from '../../../infra/xml';
import type {
  EnumPropertyValue,
  ObjectPropertiesCollection,
} from './_types';

/** Дополняет свойство `Group` пользовательскими группами команд из текущей конфигурации. */
export function enrichCommandInterfaceGroupOptions(
  properties: ObjectPropertiesCollection,
  configRoot: string
): ObjectPropertiesCollection {
  const groupProperty = properties.find((item) => item.key === 'Group' && item.kind === 'enum');
  if (!groupProperty) {
    return properties;
  }

  const enumValue = groupProperty.value as EnumPropertyValue;
  const allowedValues = mergeCommandGroupOptions(enumValue.allowedValues, readCustomCommandGroupOptions(configRoot));
  const currentOption = allowedValues.find((option) => option.value === enumValue.current);
  groupProperty.value = {
    ...enumValue,
    currentLabel: currentOption?.label ?? enumValue.currentLabel,
    allowedValues,
  };
  return properties;
}

function mergeCommandGroupOptions(
  base: EnumPropertyValue['allowedValues'],
  custom: EnumPropertyValue['allowedValues']
): EnumPropertyValue['allowedValues'] {
  const result = [...base];
  const known = new Set(result.map((item) => item.value));
  for (const item of custom) {
    if (known.has(item.value)) {
      continue;
    }
    known.add(item.value);
    result.push(item);
  }
  return result;
}

function readCustomCommandGroupOptions(configRoot: string): EnumPropertyValue['allowedValues'] {
  const commandGroupsDir = path.join(configRoot, 'CommandGroups');
  if (!fs.existsSync(commandGroupsDir)) {
    return [];
  }

  const result: EnumPropertyValue['allowedValues'] = [];
  for (const xmlPath of listCommandGroupXmlFiles(commandGroupsDir)) {
    let xml: string;
    try {
      xml = fs.readFileSync(xmlPath, 'utf-8');
    } catch {
      continue;
    }

    const name = extractSimpleTag(xml, 'Name');
    if (!name) {
      continue;
    }
    const synonym = extractSynonym(xml);
    result.push({
      value: `CommandGroup.${name}`,
      label: `Группа команд: ${synonym || name}`,
    });
  }
  return result.sort((left, right) => left.label.localeCompare(right.label, 'ru'));
}

function listCommandGroupXmlFiles(commandGroupsDir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(commandGroupsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.xml')) {
      result.push(path.join(commandGroupsDir, entry.name));
      continue;
    }
    if (!entry.isDirectory()) {
      continue;
    }
    const deepXml = path.join(commandGroupsDir, entry.name, `${entry.name}.xml`);
    if (fs.existsSync(deepXml)) {
      result.push(deepXml);
    }
  }
  return result;
}
