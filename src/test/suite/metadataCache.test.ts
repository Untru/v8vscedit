import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type { ConfigEntry } from '../../domain/Configuration';
import { buildMetadataCacheSnapshot, type MetadataCacheNode } from '../../infra/cache/MetadataCache';
import { getObjectLocationFromXml } from '../../infra/fs/MetaPathResolver';

const EXAMPLE_CFE = path.resolve(process.cwd(), 'example/src/cfe/EVOLC');

suite('MetadataCache', () => {
  test('Для объектов с плоским XML Git-декорация учитывает XML и каталог объекта', () => {
    const entry: ConfigEntry = { rootPath: EXAMPLE_CFE, kind: 'cfe' };
    const snapshot = buildMetadataCacheSnapshot('test-common-module-decoration', entry);

    const moduleNode = findNode(snapshot.root, (node) =>
      node.type === 'CommonModule' && node.name === 'ев_Действия'
    );
    assert.ok(moduleNode, 'Узел общего модуля ев_Действия не найден');
    assert.deepStrictEqual(moduleNode.gitDecorationTarget, {
      kind: 'paths',
      ownerXmlPath: path.join(EXAMPLE_CFE, 'CommonModules', 'ев_Действия.xml'),
      childKind: 'CommonModule',
      paths: [
        path.join(EXAMPLE_CFE, 'CommonModules', 'ев_Действия.xml'),
        path.join(EXAMPLE_CFE, 'CommonModules', 'ев_Действия'),
      ],
    });

    const roleNode = findNode(snapshot.root, (node) =>
      node.type === 'Role' && node.name === 'ев_ОсновнаяРоль'
    );
    assert.ok(roleNode, 'Узел роли ев_ОсновнаяРоль не найден');
    assert.deepStrictEqual(roleNode.gitDecorationTarget, {
      kind: 'paths',
      ownerXmlPath: path.join(EXAMPLE_CFE, 'Roles', 'ев_ОсновнаяРоль.xml'),
      childKind: 'Role',
      paths: [
        path.join(EXAMPLE_CFE, 'Roles', 'ев_ОсновнаяРоль.xml'),
        path.join(EXAMPLE_CFE, 'Roles', 'ев_ОсновнаяРоль'),
      ],
    });

    assert.deepStrictEqual(collectMissingFlatObjectTargets(snapshot.root), []);
  });
});

function findNode(
  node: MetadataCacheNode,
  predicate: (node: MetadataCacheNode) => boolean
): MetadataCacheNode | undefined {
  if (predicate(node)) {
    return node;
  }

  for (const child of node.children) {
    const found = findNode(child, predicate);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function collectMissingFlatObjectTargets(node: MetadataCacheNode): string[] {
  const result: string[] = [];

  if (node.xmlPath && node.decorationPath) {
    const loc = getObjectLocationFromXml(node.xmlPath);
    const xmlDir = path.resolve(path.dirname(node.xmlPath));
    const objectDir = path.resolve(loc.objectDir);
    if (xmlDir !== objectDir && fs.existsSync(loc.objectDir)) {
      const targetPaths = node.gitDecorationTarget?.kind === 'paths'
        ? node.gitDecorationTarget.paths ?? []
        : [];
      if (!targetPaths.includes(node.xmlPath) || !targetPaths.includes(loc.objectDir)) {
        result.push(`${node.type}:${node.name}`);
      }
    }
  }

  for (const child of node.children) {
    result.push(...collectMissingFlatObjectTargets(child));
  }

  return result;
}
