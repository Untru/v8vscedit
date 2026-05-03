import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { buildNode } from '../nodes/_base';
import { getNodeDescriptor } from '../nodes/index';
import { extractSynonym } from '../../../infra/xml';
import {
  HandlerContext,
  ObjectHandler,
  ObjectPropertiesCollection,
} from './_types';
import { buildTypeAwareRootProperties } from '../../views/properties/PropertyBuilder';

// ---------------------------------------------------------------------------
// Общий реквизит (CommonAttribute) в выгрузке 1С:
//
// Регистрация: теги <CommonAttribute>Имя</CommonAttribute> в Configuration.xml —
// порядок узлов совпадает с порядком этих тегов.
//
// Файлы: CommonAttributes/Имя.xml или CommonAttributes/Имя/Имя.xml.
// Вложенные каталоги с детализацией в дереве не показываются.
// ---------------------------------------------------------------------------

const FOLDER_NAME = 'CommonAttributes';

export const commonAttributeHandler: ObjectHandler = {
  buildTreeNodes(ctx: HandlerContext) {
    const descriptor = getNodeDescriptor('CommonAttribute');
    const folderPath = path.join(ctx.configRoot, FOLDER_NAME);

    /** Имена в порядке следования тегов <CommonAttribute> в Configuration.xml */
    return ctx.names.map((name) => {
      const xmlPath = resolveCommonAttributeXml(folderPath, name);

      let ownershipTag: 'OWN' | 'BORROWED' | undefined;
      if (ctx.configKind === 'cfe' && ctx.namePrefix) {
        ownershipTag = name.startsWith(ctx.namePrefix) ? 'OWN' : 'BORROWED';
      }

      const node = buildNode(descriptor, {
        label: name,
        kind: 'CommonAttribute',
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
    return node.nodeKind === 'CommonAttribute' && Boolean(node.xmlPath);
  },

  getProperties(node) {
    if (!node.xmlPath || !fs.existsSync(node.xmlPath)) {
      return [];
    }

    const xml = fs.readFileSync(node.xmlPath, 'utf-8');
    return buildTypeAwareRootProperties(xml, null, 'CommonAttribute');
  },
};

/** Путь к XML общего реквизита (плоская или вложенная структура каталога CommonAttributes) */
function resolveCommonAttributeXml(folderPath: string, name: string): string | undefined {
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
