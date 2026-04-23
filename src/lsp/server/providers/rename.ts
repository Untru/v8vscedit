import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  WorkspaceEdit,
  TextEdit,
  Range,
  Position,
} from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { getWordAtPosition } from '../lspUtils';

/** Паттерн идентификатора BSL (латиница + кириллица + цифры + подчёркивание). */
const IDENT_PATTERN = /[\wа-яА-ЯёЁ]+/;

/**
 * Проверяет, можно ли переименовать символ под курсором.
 * Возвращает range и placeholder (текущее имя).
 */
export async function prepareRename(
  document: TextDocument,
  position: Position,
  _parserService: BslParserService,
): Promise<{ range: Range; placeholder: string } | null> {
  const wordInfo = getWordAtPosition(document.getText(), position, IDENT_PATTERN);
  if (!wordInfo) return null;

  // Не переименовываем ключевые слова
  if (isKeyword(wordInfo.word)) return null;

  return { range: wordInfo.range, placeholder: wordInfo.word };
}

/**
 * Выполняет переименование: находит все вхождения идентификатора
 * в текущем документе и возвращает WorkspaceEdit.
 */
export async function provideRename(
  document: TextDocument,
  position: Position,
  newName: string,
  _parserService: BslParserService,
): Promise<WorkspaceEdit | null> {
  const wordInfo = getWordAtPosition(document.getText(), position, IDENT_PATTERN);
  if (!wordInfo) return null;

  if (isKeyword(wordInfo.word)) return null;

  const oldName = wordInfo.word;
  const text = document.getText();
  const edits: TextEdit[] = [];

  // Находим все вхождения как целые слова (регистронезависимо)
  const linePattern = new RegExp(
    `(?<![\\wа-яА-ЯёЁ])${escapeRegex(oldName)}(?![\\wа-яА-ЯёЁ])`,
    'giu',
  );
  const lines = text.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    // Reset lastIndex for each line
    const pattern = new RegExp(linePattern.source, linePattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      // Пропускаем вхождения внутри строковых литералов и комментариев
      if (isInsideStringOrComment(line, match.index)) continue;

      edits.push({
        range: {
          start: { line: lineNum, character: match.index },
          end: { line: lineNum, character: match.index + oldName.length },
        },
        newText: newName,
      });
    }
  }

  if (edits.length === 0) return null;

  return { changes: { [document.uri]: edits } };
}

/** Проверяет, находится ли позиция внутри строки или комментария. */
function isInsideStringOrComment(line: string, pos: number): boolean {
  // Комментарий: всё после //
  const commentIdx = findCommentStart(line);
  if (commentIdx >= 0 && pos >= commentIdx) return true;

  // Строки: внутри кавычек "..."
  let inString = false;
  for (let i = 0; i < pos; i++) {
    if (line[i] === '"') inString = !inString;
  }
  return inString;
}

/** Находит начало однострочного комментария (не внутри строки). */
function findCommentStart(line: string): number {
  let inString = false;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === '"') inString = !inString;
    if (!inString && line[i] === '/' && line[i + 1] === '/') return i;
  }
  return -1;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORDS = new Set([
  'если', 'if', 'тогда', 'then', 'иначеесли', 'elsif', 'иначе', 'else',
  'конецесли', 'endif', 'для', 'for', 'каждого', 'each', 'из', 'in',
  'по', 'to', 'цикл', 'do', 'конеццикла', 'enddo', 'пока', 'while',
  'попытка', 'try', 'исключение', 'except', 'конецпопытки', 'endtry',
  'возврат', 'return', 'прервать', 'break', 'продолжить', 'continue',
  'новый', 'new', 'экспорт', 'export',
  'процедура', 'procedure', 'конецпроцедуры', 'endprocedure',
  'функция', 'function', 'конецфункции', 'endfunction',
  'перем', 'var', 'знач', 'val',
  'истина', 'true', 'ложь', 'false', 'неопределено', 'undefined', 'null',
  'и', 'and', 'или', 'or', 'не', 'not',
]);

function isKeyword(word: string): boolean {
  return KEYWORDS.has(word.toLowerCase());
}
