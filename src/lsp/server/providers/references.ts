import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Location, Position } from 'vscode-languageserver/node';
import { TextDocuments } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { getWordAtPosition, nodeToRange } from '../lspUtils';

export async function provideReferences(
  document: TextDocument,
  position: Position,
  parserService: BslParserService,
  workspaceRoots: string[],
  documents: TextDocuments<TextDocument>,
  includeDeclaration: boolean,
): Promise<Location[]> {
  const wordInfo = getWordAtPosition(document.getText(), position, /[\wа-яА-ЯёЁ_]+/);
  if (!wordInfo) return [];

  const name = wordInfo.word;
  const lowerName = name.toLowerCase();
  const results: Location[] = [];
  const processedUris = new Set<string>();

  // 1. Current document
  findRefsInText(document.getText(), document.uri, lowerName, results, parserService);
  processedUris.add(document.uri);

  // 2. Open documents
  for (const doc of documents.all()) {
    if (processedUris.has(doc.uri)) continue;
    processedUris.add(doc.uri);
    findRefsInText(doc.getText(), doc.uri, lowerName, results, parserService);
  }

  // 3. Files in workspace
  for (const root of workspaceRoots) {
    const files = await findBslFiles(root);
    for (const filePath of files) {
      const uri = pathToUri(filePath);
      if (processedUris.has(uri)) continue;
      processedUris.add(uri);

      let text: string;
      try { text = await fs.promises.readFile(filePath, 'utf-8'); }
      catch { continue; }

      // Quick check — skip file if word is not present at all
      if (!text.toLowerCase().includes(lowerName)) continue;

      findRefsInText(text, uri, lowerName, results, parserService);
    }
  }

  // When includeDeclaration is false, filter out the declaration location
  if (!includeDeclaration) {
    return filterOutDeclaration(results, lowerName, parserService, documents, workspaceRoots);
  }

  return results;
}

/**
 * Finds the declaration (procedure/function definition) location for the given name
 * across all available sources, and filters it out from results.
 */
async function filterOutDeclaration(
  results: Location[],
  lowerName: string,
  parserService: BslParserService,
  documents: TextDocuments<TextDocument>,
  workspaceRoots: string[],
): Promise<Location[]> {
  await parserService.ensureInit();

  // Search for declaration in open documents first
  for (const doc of documents.all()) {
    const declLoc = findDeclarationInText(doc.getText(), doc.uri, lowerName, parserService);
    if (declLoc) {
      return results.filter(loc => !locationEquals(loc, declLoc));
    }
  }

  // Search in workspace files
  for (const root of workspaceRoots) {
    const files = await findBslFiles(root);
    for (const filePath of files) {
      let text: string;
      try { text = await fs.promises.readFile(filePath, 'utf-8'); }
      catch { continue; }
      if (!text.toLowerCase().includes(lowerName)) continue;
      const uri = pathToUri(filePath);
      const declLoc = findDeclarationInText(text, uri, lowerName, parserService);
      if (declLoc) {
        return results.filter(loc => !locationEquals(loc, declLoc));
      }
    }
  }

  return results;
}

/**
 * Finds the declaration (procedure/function definition) of a name using tree-sitter.
 */
function findDeclarationInText(
  text: string,
  uri: string,
  lowerName: string,
  parserService: BslParserService,
): Location | null {
  let root;
  try { root = parserService.parse(text, uri).rootNode; }
  catch { return null; }

  for (const node of root.namedChildren) {
    if (!node) continue;
    const t = node.type;
    if (t !== 'procedure_definition' && t !== 'function_definition') continue;
    const nameNode = node.childForFieldName('name');
    if (nameNode?.text.toLowerCase() === lowerName) {
      return { uri, range: nodeToRange(nameNode) };
    }
  }
  return null;
}

/**
 * Compares two Location objects for equality.
 */
function locationEquals(a: Location, b: Location): boolean {
  return a.uri === b.uri
    && a.range.start.line === b.range.start.line
    && a.range.start.character === b.range.start.character
    && a.range.end.line === b.range.end.line
    && a.range.end.character === b.range.end.character;
}

/**
 * Finds all occurrences of an identifier as a whole word in text.
 * Skips occurrences inside string literals and comments.
 */
function findRefsInText(
  text: string,
  uri: string,
  lowerName: string,
  results: Location[],
  _parserService: BslParserService,
): void {
  const lines = text.split('\n');
  const pattern = new RegExp(
    `(?<![\\wа-яА-ЯёЁ_])${escapeRegex(lowerName)}(?![\\wа-яА-ЯёЁ_])`, 'giu'
  );

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const linePattern = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = linePattern.exec(line)) !== null) {
      const col = match.index;

      // Skip occurrences in comments
      if (isInComment(line, col)) continue;
      // Skip occurrences in strings
      if (isInString(line, col)) continue;

      results.push({
        uri,
        range: {
          start: { line: lineNum, character: col },
          end: { line: lineNum, character: col + lowerName.length },
        },
      });
    }
  }
}

function isInComment(line: string, pos: number): boolean {
  let inStr = false;
  for (let i = 0; i < pos; i++) {
    if (line[i] === '"') inStr = !inStr;
    if (!inStr && i < line.length - 1 && line[i] === '/' && line[i + 1] === '/') return true;
  }
  return false;
}

function isInString(line: string, pos: number): boolean {
  let inStr = false;
  for (let i = 0; i < pos; i++) {
    if (line[i] === '"') inStr = !inStr;
  }
  return inStr;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findBslFiles(dir: string, depth = 0): Promise<string[]> {
  if (depth > 10) return [];
  let entries: fs.Dirent[];
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const results: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await findBslFiles(full, depth + 1));
    else if (entry.name.endsWith('.bsl')) results.push(full);
  }
  return results;
}

function pathToUri(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `file:///${encoded.replace(/^\/+/, '')}`;
}
