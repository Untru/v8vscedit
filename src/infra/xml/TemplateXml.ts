import * as fs from 'fs';
import * as path from 'path';
import type { TemplateType } from './MetadataXmlCreator';

const TEMPLATE_TYPES: ReadonlySet<string> = new Set<TemplateType>([
  'SpreadsheetDocument',
  'TextDocument',
  'HTMLDocument',
  'BinaryData',
  'DataCompositionSchema',
  'DataCompositionAppearanceTemplate',
  'GraphicalSchema',
  'AddIn',
]);

/** Читает тип макета из XML-описания макета. */
export function readTemplateTypeFromXml(xmlPath: string): TemplateType | null {
  if (!fs.existsSync(xmlPath)) {
    return null;
  }

  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const value = /<TemplateType>\s*([^<]+?)\s*<\/TemplateType>/.exec(xml)?.[1]?.trim();
  return value && TEMPLATE_TYPES.has(value) ? value as TemplateType : null;
}

/** Находит реальный файл содержимого текстового макета без его создания. */
export function resolveTextTemplateContentPath(templateXmlPath: string, templateName?: string): string | null {
  const templateDir = path.dirname(templateXmlPath);
  const baseName = path.basename(templateXmlPath, '.xml');
  const name = templateName && templateName.length > 0 ? templateName : baseName;
  const candidates = [
    path.join(templateDir, name, 'Ext', 'Template.txt'),
    path.join(templateDir, 'Ext', 'Template.txt'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}
