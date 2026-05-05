import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import type { MetaChild, MetaObject } from '../../domain/MetaObject';
import {
  extractChildMetaElementXml,
  extractColumnXmlFromTabularSection,
  extractSimpleTag,
  extractSynonym,
  writeTextFilePreservingBomAndEol,
} from './XmlUtils';
import { normalizeTypedFieldPropertiesAfterTypeChange } from './TypedFieldPropertyRules';

interface XmlTextNode { '#text': string }
type XmlElementNode = Record<string, XmlNodeList>;
type XmlNode = XmlTextNode | XmlElementNode;
type XmlNodeList = XmlNode[];

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  trimValues: false,
  parseTagValue: false,
  processEntities: false,
});

function isTextNode(node: XmlNode): node is XmlTextNode {
  return Object.prototype.hasOwnProperty.call(node, '#text');
}

function getElementName(node: XmlNode): string | null {
  if (isTextNode(node)) {
    return null;
  }
  const [name] = Object.keys(node);
  return name;
}

function getElementChildren(node: XmlNode): XmlNodeList {
  if (isTextNode(node)) {
    return [];
  }
  const name = getElementName(node);
  return name ? (node[name] ?? []) : [];
}

function findFirstElement(nodes: XmlNodeList, tagName: string): XmlElementNode | null {
  for (const node of nodes) {
    const name = getElementName(node);
    if (!name) {
      continue;
    }
    if (name === tagName) {
      return node as XmlElementNode;
    }
    const found = findFirstElement(getElementChildren(node), tagName);
    if (found) {
      return found;
    }
  }
  return null;
}

function findDirectChildren(nodes: XmlNodeList, tagName: string): XmlElementNode[] {
  return nodes.filter((node): node is XmlElementNode => getElementName(node) === tagName);
}

/**
 * Читает XML объекта метаданных и возвращает имя, синоним и дочерние элементы.
 */
export class ObjectXmlReader {
  read(xmlPath: string): MetaObject | null {
    let xml: string;
    try {
      xml = fs.readFileSync(xmlPath, 'utf-8');
    } catch {
      return null;
    }

    const nodes = parser.parse(xml) as XmlNodeList;
    const metaDataObject = findFirstElement(nodes, 'MetaDataObject');
    if (!metaDataObject) {
      return null;
    }

    const rootElement = getElementChildren(metaDataObject).find((node) => Boolean(getElementName(node)));
    const rootTag = rootElement ? getElementName(rootElement) : null;
    if (!rootTag) {
      return null;
    }

    return {
      tag: rootTag,
      name: extractSimpleTag(xml, 'Name') ?? '',
      synonym: extractSynonym(xml),
      children: this.parseChildren(rootElement as XmlElementNode),
    };
  }

  private parseChildren(rootElement: XmlNode): MetaChild[] {
    const result: MetaChild[] = [];
    const childObjects = findFirstElement(getElementChildren(rootElement), 'ChildObjects');
    if (!childObjects) {
      return result;
    }

    const directChildren = getElementChildren(childObjects);

    for (const tag of ['Attribute', 'Dimension', 'Resource'] as const) {
      for (const element of findDirectChildren(directChildren, tag)) {
        result.push(this.toMetaChild(tag, element));
      }
    }

    for (const element of findDirectChildren(directChildren, 'EnumValue')) {
      result.push(this.toMetaChild('EnumValue', element));
    }

    for (const element of findDirectChildren(directChildren, 'TabularSection')) {
      result.push(this.toTabularSectionChild(element));
    }

    for (const tag of ['Form', 'Template'] as const) {
      for (const element of findDirectChildren(directChildren, tag)) {
        const name = extractSimpleTagFromElement(element, 'Name') ?? collectDirectText(getElementChildren(element));
        result.push({ tag, name, synonym: '' });
      }
    }

    for (const element of findDirectChildren(directChildren, 'Command')) {
      result.push(this.toMetaChild('Command', element));
    }

    for (const element of findDirectChildren(directChildren, 'AddressingAttribute')) {
      result.push(this.toMetaChild('AddressingAttribute', element));
    }

    for (const element of findDirectChildren(directChildren, 'Subsystem')) {
      const name = extractSimpleTagFromElement(element, 'Name') ?? collectDirectText(getElementChildren(element));
      result.push({ tag: 'Subsystem', name, synonym: '' });
    }

    return result;
  }

  private toMetaChild(tag: string, element: XmlElementNode): MetaChild {
    return {
      tag,
      name: extractSimpleTagFromElement(element, 'Name') ?? collectDirectText(getElementChildren(element)),
      synonym: extractSynonymFromElement(element),
    };
  }

  private toTabularSectionChild(element: XmlElementNode): MetaChild {
    const columns: MetaChild[] = [];
    const childObjects = findFirstElement(getElementChildren(element), 'ChildObjects');
    if (childObjects) {
      for (const column of findDirectChildren(getElementChildren(childObjects), 'Attribute')) {
        columns.push(this.toMetaChild('Attribute', column));
      }
    }

    return {
      tag: 'TabularSection',
      name: extractSimpleTagFromElement(element, 'Name') ?? collectDirectText(getElementChildren(element)),
      synonym: extractSynonymFromElement(element),
      columns,
    };
  }

  updateTypeInObject(
    xmlPath: string,
    options: {
      targetKind:
        | 'Attribute'
        | 'AddressingAttribute'
        | 'Dimension'
        | 'Resource'
        | 'Column'
        | 'SessionParameter'
        | 'CommonAttribute'
        | 'Constant'
        | 'DefinedType'
        | 'EventSubscription'
        | 'CommonCommand'
        | 'Command';
      targetName: string;
      tabularSectionName?: string;
      propertyName?: 'Type' | 'Source' | 'CommandParameterType';
      typeInnerXml: string;
    }
  ): boolean {
    let xml: string;
    try {
      xml = fs.readFileSync(xmlPath, 'utf-8');
    } catch {
      return false;
    }

    const normalizedType = indentTypeInner(options.typeInnerXml);
    const targetXml = (() => {
      if (options.targetKind !== 'Column') {
        return isRootTypeTargetKind(options.targetKind)
          ? xml
          : extractChildMetaElementXml(xml, options.targetKind, options.targetName);
      }
      if (!options.tabularSectionName) {
        return null;
      }
      return extractColumnXmlFromTabularSection(xml, options.tabularSectionName, options.targetName);
    })();

    if (!targetXml) {
      return false;
    }

    const updatedTarget = updateTypeInElement(targetXml, normalizedType, options.propertyName ?? 'Type');
    if (updatedTarget === targetXml) {
      return false;
    }

    const updatedXml = xml.replace(targetXml, updatedTarget);
    if (updatedXml === xml) {
      return false;
    }

    writeTextFilePreservingBomAndEol(xmlPath, xml, updatedXml);
    return true;
  }

  updatePropertyInObject(
    xmlPath: string,
    options: {
      targetKind: 'Self' | 'Attribute' | 'AddressingAttribute' | 'Dimension' | 'Resource' | 'Column' | 'TabularSection' | 'Command' | 'EnumValue';
      targetName: string;
      tabularSectionName?: string;
      propertyKey: string;
      valueKind: 'string' | 'boolean' | 'localizedString';
      value: string | boolean;
    }
  ): boolean {
    let xml: string;
    try {
      xml = fs.readFileSync(xmlPath, 'utf-8');
    } catch {
      return false;
    }

    let targetXml: string | null;
    if (options.targetKind === 'Self') {
      targetXml = xml;
    } else if (options.targetKind === 'Column') {
      if (!options.tabularSectionName) {
        return false;
      }
      targetXml = extractColumnXmlFromTabularSection(xml, options.tabularSectionName, options.targetName);
    } else {
      targetXml = extractChildMetaElementXml(xml, options.targetKind, options.targetName);
    }

    if (!targetXml) {
      return false;
    }

    const updatedTarget = updatePropertyInElement(targetXml, options.propertyKey, options.valueKind, options.value);
    if (updatedTarget === targetXml) {
      return false;
    }

    const updatedXml = options.targetKind === 'Self'
      ? updatedTarget
      : xml.replace(targetXml, updatedTarget);
    if (updatedXml === xml) {
      return false;
    }
    writeTextFilePreservingBomAndEol(xmlPath, xml, updatedXml);
    return true;
  }
}

function extractSimpleTagFromElement(element: XmlElementNode, tagName: string): string | undefined {
  const target = findFirstElement(getElementChildren(element), tagName);
  if (!target) {
    return undefined;
  }
  return collectDirectText(getElementChildren(target)) || undefined;
}

function extractSynonymFromElement(element: XmlElementNode): string {
  const synonym = findFirstElement(getElementChildren(element), 'Synonym');
  if (!synonym) {
    return '';
  }
  const content = findFirstElement(getElementChildren(synonym), 'v8:content');
  return content ? collectDirectText(getElementChildren(content)) : '';
}

function collectDirectText(nodes: XmlNodeList): string {
  let result = '';
  for (const node of nodes) {
    if (isTextNode(node)) {
      result += node['#text'];
    }
  }
  return result.trim();
}

function updateTypeInElement(
  elementXml: string,
  typeInnerXml: string,
  propertyName: 'Type' | 'Source' | 'CommandParameterType' = 'Type'
): string {
  const typeBlock = `<${propertyName}>\n${typeInnerXml}\n</${propertyName}>`;
  const propertyRe = new RegExp(`<${propertyName}>[\\s\\S]*?<\\/${propertyName}>`);
  if (propertyRe.test(elementXml)) {
    const updated = elementXml.replace(propertyRe, typeBlock);
    return propertyName === 'Type' ? normalizeTypedFieldProperties(updated, typeInnerXml) : updated;
  }
  const selfClosingRe = new RegExp(`<${propertyName}(?:\\s[^>]*)?\\/>`);
  if (selfClosingRe.test(elementXml)) {
    const updated = elementXml.replace(selfClosingRe, typeBlock);
    return propertyName === 'Type' ? normalizeTypedFieldProperties(updated, typeInnerXml) : updated;
  }
  const propertiesMatch = /<Properties>([\s\S]*?)<\/Properties>/.exec(elementXml);
  if (!propertiesMatch) {
    return elementXml;
  }
  const propsInner = propertiesMatch[1];
  const nextPropsInner = /<Comment[\s\S]*?<\/Comment>/.test(propsInner)
    ? propsInner.replace(/(<Comment[\s\S]*?<\/Comment>)/, `$1\n${typeBlock}`)
    : /<Name[\s\S]*?<\/Name>/.test(propsInner)
    ? propsInner.replace(/(<Name[\s\S]*?<\/Name>)/, `$1\n${typeBlock}`)
    : `${propsInner}\n${typeBlock}`;
  const updated = elementXml.replace(propsInner, nextPropsInner);
  return propertyName === 'Type' ? normalizeTypedFieldProperties(updated, typeInnerXml) : updated;
}

function normalizeTypedFieldProperties(elementXml: string, typeInnerXml: string): string {
  const tag = detectNormalizedTypeOwnerTag(elementXml);
  if (
    tag === 'Attribute' ||
    tag === 'AddressingAttribute' ||
    tag === 'Dimension' ||
    tag === 'Resource' ||
    tag === 'Constant' ||
    tag === 'CommonAttribute'
  ) {
    return normalizeTypedFieldPropertiesAfterTypeChange(elementXml, tag, typeInnerXml);
  }
  return elementXml;
}

function detectNormalizedTypeOwnerTag(elementXml: string): string | undefined {
  const text = elementXml.trimStart().replace(/^<\?xml\b[\s\S]*?\?>\s*/, '');
  return /^<MetaDataObject\b[^>]*>\s*<([A-Za-z][A-Za-z0-9]*)\b/.exec(text)?.[1]
    ?? /^<([A-Za-z][A-Za-z0-9]*)\b/.exec(text)?.[1];
}

function isRootTypeTargetKind(kind: string): boolean {
  return kind === 'SessionParameter'
    || kind === 'CommonAttribute'
    || kind === 'Constant'
    || kind === 'DefinedType'
    || kind === 'EventSubscription'
    || kind === 'CommonCommand';
}

function indentTypeInner(typeInnerXml: string): string {
  return typeInnerXml
    .split('\n')
    .map((line) => line.replace(/\r/g, '').trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => `\t\t\t${line}`)
    .join('\n');
}

function updatePropertyInElement(
  elementXml: string,
  propertyKey: string,
  valueKind: 'string' | 'boolean' | 'localizedString',
  value: string | boolean
): string {
  const propertiesMatch = /<Properties>([\s\S]*?)<\/Properties>/.exec(elementXml);
  if (!propertiesMatch) {
    return elementXml;
  }
  const propsInner = propertiesMatch[1];
  const propertyRe = new RegExp(`<${propertyKey}>[\\s\\S]*?<\\/${propertyKey}>`);
  const selfClosingRe = new RegExp(`<${propertyKey}(?:\\s[^>]*)?\\/>`);
  const propertyMatch = propertyRe.exec(propsInner);
  const nextValueBlock = propertyMatch && valueKind === 'localizedString'
    ? updateLocalizedPropertyContent(propertyMatch[0], value)
    : buildPropertyValueBlock(propertyKey, valueKind, value);

  const nextPropsInner = propertyMatch
    ? propsInner.replace(propertyMatch[0], nextValueBlock)
    : selfClosingRe.test(propsInner)
    ? propsInner.replace(selfClosingRe, nextValueBlock)
    : /<Comment[\s\S]*?<\/Comment>/.test(propsInner)
    ? propsInner.replace(/(<Comment[\s\S]*?<\/Comment>)/, `$1\n${nextValueBlock}`)
    : /<Name[\s\S]*?<\/Name>/.test(propsInner)
    ? propsInner.replace(/(<Name[\s\S]*?<\/Name>)/, `$1\n${nextValueBlock}`)
    : `${propsInner}\n${nextValueBlock}`;

  if (nextPropsInner === propsInner) {
    return elementXml;
  }
  return elementXml.replace(propsInner, nextPropsInner);
}

function buildPropertyValueBlock(
  propertyKey: string,
  valueKind: 'string' | 'boolean' | 'localizedString',
  value: string | boolean
): string {
  if (valueKind === 'boolean') {
    return `<${propertyKey}>${value === true ? 'true' : 'false'}</${propertyKey}>`;
  }
  if (valueKind === 'localizedString') {
    const content = escapeXmlText(typeof value === 'string' ? value : String(value));
    return [
      `<${propertyKey}>`,
      '\t\t\t\t\t<v8:item>',
      '\t\t\t\t\t\t<v8:lang>ru</v8:lang>',
      `\t\t\t\t\t\t<v8:content>${content}</v8:content>`,
      '\t\t\t\t\t</v8:item>',
      `</${propertyKey}>`,
    ].join('\n');
  }
  return `<${propertyKey}>${escapeXmlText(String(value))}</${propertyKey}>`;
}

function updateLocalizedPropertyContent(propertyBlock: string, value: string | boolean): string {
  const content = escapeXmlText(typeof value === 'string' ? value : String(value));
  const contentRe = /(<v8:content>)[\s\S]*?(<\/v8:content>)/;
  if (!contentRe.test(propertyBlock)) {
    return propertyBlock.replace(/<v8:content\s*\/>/, `<v8:content>${content}</v8:content>`);
  }
  return propertyBlock.replace(contentRe, `$1${content}$2`);
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
