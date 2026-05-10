import * as fs from 'fs';
import * as path from 'path';
import { getMetaFolder } from '../../domain/MetaTypes';
import { ConfigXmlReader } from './ConfigXmlReader';
import { extractSimpleTag, extractSynonym } from './XmlUtils';

export interface ExchangePlanContentItem {
  exchangePlanName: string;
  exchangePlanLabel: string;
  xmlPath: string;
  autoRecord: string;
  autoRecordLabel: string;
}

export interface ExchangePlanContentSnapshot {
  configRoot: string;
  objectRef: string;
  items: ExchangePlanContentItem[];
}

/** Читает состав планов обмена для отображения связей объекта метаданных. */
export class ExchangePlanContentService {
  private readonly configReader = new ConfigXmlReader();

  readObjectContentSnapshot(configRoot: string, objectRef: string): ExchangePlanContentSnapshot {
    const configPath = path.join(configRoot, 'Configuration.xml');
    if (!fs.existsSync(configPath)) {
      return { configRoot, objectRef, items: [] };
    }

    const info = this.configReader.read(configPath);
    const exchangePlanNames = info.childObjects.get('ExchangePlan') ?? [];
    const exchangePlansRoot = path.join(configRoot, getMetaFolder('ExchangePlan') ?? 'ExchangePlans');
    const items = exchangePlanNames
      .map((exchangePlanName) => this.readExchangePlanContentItem(exchangePlansRoot, exchangePlanName, objectRef))
      .filter((item): item is ExchangePlanContentItem => Boolean(item))
      .sort((left, right) => left.exchangePlanLabel.localeCompare(right.exchangePlanLabel, 'ru'));

    return { configRoot, objectRef, items };
  }

  private readExchangePlanContentItem(
    exchangePlansRoot: string,
    exchangePlanName: string,
    objectRef: string
  ): ExchangePlanContentItem | null {
    const xmlPath = resolveExchangePlanXml(exchangePlansRoot, exchangePlanName);
    const contentPath = path.join(resolveExchangePlanHomeDir(exchangePlansRoot, exchangePlanName, xmlPath), 'Ext', 'Content.xml');
    if (!xmlPath || !fs.existsSync(contentPath)) {
      return null;
    }

    const contentXml = fs.readFileSync(contentPath, 'utf-8');
    const contentItem = findContentItem(contentXml, objectRef);
    if (!contentItem) {
      return null;
    }

    const planXml = fs.readFileSync(xmlPath, 'utf-8');
    const exchangePlanLabel = firstNonEmpty(extractSynonym(planXml), extractSimpleTag(planXml, 'Name'), exchangePlanName);
    return {
      exchangePlanName,
      exchangePlanLabel,
      xmlPath,
      autoRecord: contentItem.autoRecord,
      autoRecordLabel: formatAutoRecord(contentItem.autoRecord),
    };
  }
}

function resolveExchangePlanXml(exchangePlansRoot: string, exchangePlanName: string): string | null {
  const flat = path.join(exchangePlansRoot, `${exchangePlanName}.xml`);
  if (fs.existsSync(flat)) {
    return flat;
  }
  const deep = path.join(exchangePlansRoot, exchangePlanName, `${exchangePlanName}.xml`);
  return fs.existsSync(deep) ? deep : null;
}

function resolveExchangePlanHomeDir(
  exchangePlansRoot: string,
  exchangePlanName: string,
  xmlPath: string | null
): string {
  if (!xmlPath) {
    return path.join(exchangePlansRoot, exchangePlanName);
  }
  const xmlDir = path.dirname(xmlPath);
  return path.basename(xmlDir) === exchangePlanName ? xmlDir : path.join(xmlDir, exchangePlanName);
}

function findContentItem(contentXml: string, objectRef: string): { autoRecord: string } | null {
  for (const match of contentXml.matchAll(/<Item>([\s\S]*?)<\/Item>/g)) {
    const itemXml = match[1];
    if (extractSimpleTag(itemXml, 'Metadata') !== objectRef) {
      continue;
    }
    return { autoRecord: extractSimpleTag(itemXml, 'AutoRecord') ?? '' };
  }
  return null;
}

function formatAutoRecord(value: string): string {
  if (value === 'Allow') {
    return 'Разрешить';
  }
  if (value === 'Deny') {
    return 'Запретить';
  }
  return value.length > 0 ? value : 'Не указано';
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  return values.find((value): value is string => value !== undefined && value.length > 0) ?? '';
}
