import * as assert from 'assert';
import * as path from 'path';
import { ConfigEntry } from '../../domain/Configuration';
import { buildMetadataCacheSnapshot, MetadataCacheNode } from '../../infra/cache/MetadataCache';

const EXAMPLE_CFE = path.resolve(process.cwd(), 'example/src/cfe/EVOLC');

suite('MetadataCache', () => {
  test('Для общего модуля Git-декорация учитывает XML и каталог кода', () => {
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
