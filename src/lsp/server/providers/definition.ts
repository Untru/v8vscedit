import * as fs from 'fs';
import * as path from 'path';
import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { Location, Position } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { getWordAtPosition, nodeToRange, uriToFsPath } from '../lspUtils';

/** Кэш определений: имя (нижний регистр) → Location. Сбрасывается при изменении BSL-файлов. */
const definitionCache = new Map<string, Location>();

/**
 * Переходит к определению процедуры/функции под курсором.
 * Сначала ищет в текущем документе, затем — среди открытых,
 * далее — рекурсивный обход файловой системы.
 */
export async function provideDefinition(
  document: TextDocument,
  position: Position,
  parserService: BslParserService,
  workspaceRoots: string[],
  documents: TextDocuments<TextDocument>,
): Promise<Location | null> {
  const wordInfo = getWordAtPosition(document.getText(), position, /[\wа-яА-ЯёЁ_]+/);
  if (!wordInfo) {
    return null;
  }
  const name = wordInfo.word;

  await parserService.ensureInit();

  // 1. Текущий документ
  const localLoc = findInText(document.getText(), document.uri, name, parserService);
  if (localLoc) {
    return localLoc;
  }

  // 2. Кэш
  const cached = definitionCache.get(name.toLowerCase());
  if (cached) {
    return cached;
  }

  // 3. Открытые документы
  for (const doc of documents.all()) {
    if (doc.uri === document.uri) {
      continue;
    }
    const loc = findInText(doc.getText(), doc.uri, name, parserService);
    if (loc) {
      definitionCache.set(name.toLowerCase(), loc);
      return loc;
    }
  }

  // 4. Поиск по файловой системе
  for (const root of workspaceRoots) {
    const files = await findBslFiles(root);
    for (const filePath of files) {
      const fileUri = pathToUri(filePath);
      if (fileUri === document.uri) {
        continue;
      }
      let text: string;
      try {
        text = await fs.promises.readFile(filePath, 'utf-8');
      } catch {
        continue;
      }
      const loc = findInText(text, fileUri, name, parserService);
      if (loc) {
        definitionCache.set(name.toLowerCase(), loc);
        return loc;
      }
    }
  }

  return null;
}

/** Сбрасывает кэш определений — вызывается при изменении BSL-файлов. */
export function invalidateDefinitionCache(): void {
  definitionCache.clear();
}

function findInText(
  text: string,
  uri: string,
  name: string,
  parserService: BslParserService,
): Location | null {
  let root: Node;
  try {
    root = parserService.parse(text, uri).rootNode;
  } catch {
    return null;
  }

  for (const node of root.namedChildren) {
    if (!node) {
      continue;
    }
    const t = node.type;
    if (t !== 'procedure_definition' && t !== 'function_definition') {
      continue;
    }
    const nameNode = node.childForFieldName('name');
    if (nameNode?.text.toLowerCase() === name.toLowerCase()) {
      return { uri, range: nodeToRange(nameNode) };
    }
  }
  return null;
}

/** Рекурсивно собирает все *.bsl файлы в директории (глубина до 10, без node_modules). */
async function findBslFiles(dir: string, depth = 0): Promise<string[]> {
  if (depth > 10) {
    return [];
  }
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findBslFiles(full, depth + 1);
      results.push(...nested);
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

/** Инвалидирует кэш определений при изменении конкретного URI. */
export function onBslFileChanged(_uri: string): void {
  definitionCache.clear();
}

/** Конвертирует file:// URI в путь — используется при скане изменений. */
export { uriToFsPath };
