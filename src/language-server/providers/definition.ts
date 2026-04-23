import * as fs from 'fs';
import * as path from 'path';
import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';
import { Location, Position } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { BslContextService } from '../BslContextService';
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
  contextService?: BslContextService,
): Promise<Location | null> {
  const wordInfo = getWordAtPosition(document.getText(), position, /[\wа-яА-ЯёЁ_]+/);
  if (!wordInfo) {
    return null;
  }
  const name = wordInfo.word;

  await parserService.ensureInit();

  // 0. Проверяем паттерн "Модуль.Метод" — кросс-модульный переход
  if (contextService) {
    const crossModuleLoc = await findCrossModuleDefinition(
      document, position, parserService, contextService,
    );
    if (crossModuleLoc) return crossModuleLoc;
  }

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

/**
 * Проверяет конструкцию «Модуль.Метод» и возвращает Location определения.
 * Курсор может стоять на имени модуля (→ открыть Module.bsl)
 * или на имени метода (→ перейти к процедуре/функции в Module.bsl).
 */
async function findCrossModuleDefinition(
  document: TextDocument,
  position: Position,
  parserService: BslParserService,
  contextService: BslContextService,
): Promise<Location | null> {
  await contextService.ensureInitialized();

  const text = document.getText();
  const wordInfo = getWordAtPosition(text, position, /[\wа-яА-ЯёЁ_]+/);
  if (!wordInfo) return null;

  const word = wordInfo.word;
  const wordStart = wordInfo.range.start.character;
  const wordEnd = wordInfo.range.end.character;

  const lines = text.split('\n');
  const line = lines[position.line] ?? '';

  // Проверяем: есть ли точка слева от слова? (Модуль.Метод — курсор на Метод)
  const beforeWord = line.slice(0, wordStart);
  const dotMatch = /([\wа-яА-ЯёЁ_]+)\.\s*$/u.exec(beforeWord);

  if (dotMatch) {
    const moduleName = dotMatch[1];
    return await resolveModuleMethod(moduleName, word, parserService, contextService);
  }

  // Проверяем: есть ли точка справа от слова? (Модуль.Метод — курсор на Модуль)
  const afterWord = line.slice(wordEnd);
  if (/^\s*\./.test(afterWord)) {
    const moduleInfo = contextService.getModuleByName(word);
    if (moduleInfo?.bslPath) {
      return {
        uri: pathToUri(moduleInfo.bslPath),
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      };
    }
  }

  return null;
}

/**
 * Находит определение метода в файле общего модуля.
 */
async function resolveModuleMethod(
  moduleName: string,
  methodName: string,
  parserService: BslParserService,
  contextService: BslContextService,
): Promise<Location | null> {
  const moduleInfo = contextService.getModuleByName(moduleName);
  if (!moduleInfo?.bslPath) return null;

  let text: string;
  try {
    text = await fs.promises.readFile(moduleInfo.bslPath, 'utf-8');
  } catch {
    return null;
  }

  const uri = pathToUri(moduleInfo.bslPath);
  return findInText(text, uri, methodName, parserService);
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
