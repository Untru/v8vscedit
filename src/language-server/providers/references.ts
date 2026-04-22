import * as fs from 'fs';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Location, Position } from 'vscode-languageserver/node';
import { TextDocuments } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { getWordAtPosition } from '../lspUtils';

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
  findRefsInText(document.getText(), document.uri, lowerName, results, includeDeclaration, parserService);
  processedUris.add(document.uri);

  // 2. Open documents
  for (const doc of documents.all()) {
    if (processedUris.has(doc.uri)) continue;
    processedUris.add(doc.uri);
    findRefsInText(doc.getText(), doc.uri, lowerName, results, includeDeclaration, parserService);
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

      findRefsInText(text, uri, lowerName, results, includeDeclaration, parserService);
    }
  }

  return results;
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
  _includeDeclaration: boolean,
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
