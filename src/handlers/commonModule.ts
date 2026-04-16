import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { buildNode } from '../nodes/_base';
import { getNodeDescriptor } from '../nodes';
import { extractSynonym } from '../ConfigParser';
import { HandlerContext, ObjectHandler } from './_types';

// ---------------------------------------------------------------------------
// Свойства объекта «Общий модуль» (CommonModule) в XML-выгрузке 1С:
//
// Name                       (string)  — имя (идентификатор)
// Synonym                    (LocalizedString) — синоним (представление для пользователя)
// Comment                    (string)  — комментарий разработчика
// Global                     (boolean) — глобальный модуль (методы доступны без указания имени модуля)
// ClientManagedApplication   (boolean) — доступен на клиенте управляемого приложения
// Server                     (boolean) — доступен на сервере
// ExternalConnection         (boolean) — доступен во внешнем соединении
// ClientOrdinaryApplication  (boolean) — доступен на клиенте обычного приложения
// ServerCall                 (boolean) — вызов сервера (клиент может вызывать экспортные методы)
// Privileged                 (boolean) — привилегированный (выполняется без проверки прав)
// ReturnValuesReuse          (enum: DontUse | DuringRequest | DuringSession)
//                                      — повторное использование возвращаемых значений
// ---------------------------------------------------------------------------

const FOLDER_NAME = 'CommonModules';

export const commonModuleHandler: ObjectHandler = {

  buildTreeNodes(ctx: HandlerContext) {
    const descriptor = getNodeDescriptor('CommonModule');
    const folderPath = path.join(ctx.configRoot, FOLDER_NAME);

    return ctx.names.map((name) => {
      const xmlPath = resolveModuleXml(folderPath, name);

      let ownershipTag: 'OWN' | 'BORROWED' | undefined;
      if (ctx.configKind === 'cfe' && ctx.namePrefix) {
        ownershipTag = name.startsWith(ctx.namePrefix) ? 'OWN' : 'BORROWED';
      }

      const node = buildNode(descriptor, {
        label: name,
        kind: 'CommonModule',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        xmlPath,
        childrenLoader: undefined,
        ownershipTag,
      });

      let cachedSynonym: string | undefined;
      Object.defineProperty(node, 'tooltip', {
        get: () => {
          if (cachedSynonym !== undefined) { return cachedSynonym; }
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
};

/** Резолвит путь к XML-файлу общего модуля (глубокая или плоская структура) */
function resolveModuleXml(folderPath: string, name: string): string | undefined {
  const deep = path.join(folderPath, name, `${name}.xml`);
  if (fs.existsSync(deep)) { return deep; }

  const flat = path.join(folderPath, `${name}.xml`);
  if (fs.existsSync(flat)) { return flat; }

  return undefined;
}
