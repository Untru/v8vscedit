import * as fs from 'fs';
import * as path from 'path';
import { Node } from 'web-tree-sitter';
import { SymbolInformation, SymbolKind, Location } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { nodeToRange } from '../lspUtils';

interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName: string;
}

/** Кэш символов по корню workspace */
const symbolCache = new Map<string, SymbolEntry[]>();

/**
 * Поиск символов по всем .bsl файлам workspace.
 * Фильтрует по query (case-insensitive substring match).
 */
export async function provideWorkspaceSymbols(
  query: string,
  workspaceRoots: string[],
  parserService: BslParserService,
): Promise<SymbolInformation[]> {
  await parserService.ensureInit();

  const allSymbols: SymbolEntry[] = [];

  for (const root of workspaceRoots) {
    if (!symbolCache.has(root)) {
      symbolCache.set(root, await indexWorkspace(root, parserService));
    }
    allSymbols.push(...(symbolCache.get(root) ?? []));
  }

  // Фильтрация по query
  const lowerQuery = query.toLowerCase();
  const filtered = lowerQuery
    ? allSymbols.filter(s => s.name.toLowerCase().includes(lowerQuery))
    : allSymbols.slice(0, 200);

  return filtered.slice(0, 200).map(s => ({
    name: s.name,
    kind: s.kind,
    location: s.location,
    containerName: s.containerName,
  }));
}

/** Индексирует все .bsl файлы — извлекает процедуры/функции */
async function indexWorkspace(rootPath: string, parserService: BslParserService): Promise<SymbolEntry[]> {
  const files = await findBslFilesRecursive(rootPath);
  const entries: SymbolEntry[] = [];

  for (const filePath of files) {
    let text: string;
    try {
      text = await fs.promises.readFile(filePath, 'utf-8');
    } catch { continue; }

    const uri = pathToUri(filePath);
    const containerName = extractContainerName(filePath);

    let root: Node;
    try {
      root = parserService.parse(text, uri).rootNode;
    } catch { continue; }

    for (const node of root.namedChildren) {
      if (!node) continue;
      if (node.type !== 'procedure_definition' && node.type !== 'function_definition') continue;

      const nameNode = node.childForFieldName('name');
      if (!nameNode) continue;

      const exportNode = node.childForFieldName('export');

      entries.push({
        name: nameNode.text,
        kind: node.type === 'function_definition' ? SymbolKind.Function : SymbolKind.Method,
        location: { uri, range: nodeToRange(nameNode) },
        containerName: containerName + (exportNode ? ' (Экспорт)' : ''),
      });
    }
  }

  return entries;
}

/**
 * Извлекает имя контейнера из пути файла.
 * Например: `.../Catalogs/Номенклатура/Ext/ObjectModule.bsl` → `Catalogs/Номенклатура · МодульОбъекта`
 */
function extractContainerName(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const parts = norm.split('/');

  const bslName = parts[parts.length - 1]?.replace('.bsl', '') ?? '';

  const moduleNames: Record<string, string> = {
    'Module': 'Модуль',
    'ObjectModule': 'МодульОбъекта',
    'ManagerModule': 'МодульМенеджера',
    'RecordSetModule': 'МодульНабораЗаписей',
    'CommandModule': 'МодульКоманды',
  };
  const moduleName = moduleNames[bslName] ?? bslName;

  const extIdx = parts.lastIndexOf('Ext');
  if (extIdx >= 2) {
    const objectName = parts[extIdx - 1];
    const typeFolder = parts[extIdx - 2];
    return `${typeFolder}/${objectName} · ${moduleName}`;
  }

  return moduleName;
}

/** Сбрасывает кэш символов (при изменении .bsl файлов) */
export function invalidateWorkspaceSymbolCache(): void {
  symbolCache.clear();
}

async function findBslFilesRecursive(dir: string, depth = 0): Promise<string[]> {
  if (depth > 10) return [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch { return []; }

  const results: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findBslFilesRecursive(full, depth + 1));
    } else if (entry.name.endsWith('.bsl')) {
      results.push(full);
    }
  }
  return results;
}

function pathToUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `file:///${encoded.replace(/^\/+/, '')}`;
}
