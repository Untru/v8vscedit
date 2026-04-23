import { Range, Position } from 'vscode-languageserver/node';

/** Конвертирует позицию tree-sitter в LSP Range. */
export function nodeToRange(node: {
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
}): Range {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column },
  };
}

/** Конвертирует file:// URI в путь файловой системы (кросс-платформенно). */
export function uriToFsPath(uri: string): string {
  const url = new URL(uri);
  let p = decodeURIComponent(url.pathname);
  if (process.platform === 'win32' && p.startsWith('/')) {
    p = p.slice(1);
  }
  return p;
}

/**
 * Находит слово под позицией курсора в строке текста.
 * pattern должен быть без флагов — флаг g добавляется внутри.
 */
export function getWordAtPosition(
  text: string,
  position: Position,
  pattern: RegExp,
): { word: string; range: Range } | null {
  const lines = text.split('\n');
  const line = lines[position.line];
  if (!line) {
    return null;
  }

  const globalPattern = new RegExp(pattern.source, 'gu');
  let match: RegExpExecArray | null;

  while ((match = globalPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start <= position.character && position.character <= end) {
      return {
        word: match[0],
        range: {
          start: { line: position.line, character: start },
          end: { line: position.line, character: end },
        },
      };
    }
  }

  return null;
}
