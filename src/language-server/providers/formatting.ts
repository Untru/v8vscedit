import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextEdit, DocumentFormattingParams } from 'vscode-languageserver/node';

/** Ключевые слова, увеличивающие отступ (следующая строка +1 уровень) */
const INDENT_INCREASE =
  /^\s*(Процедура|Procedure|Функция|Function|Если|If|Для|For|Пока|While|Попытка|Try|Иначе|Else|ИначеЕсли|ElsIf|Исключение|Except|#Область|#Region)\b/i;

/** Ключевые слова, уменьшающие отступ текущей строки (-1 уровень) */
const INDENT_DECREASE =
  /^\s*(КонецПроцедуры|EndProcedure|КонецФункции|EndFunction|КонецЕсли|EndIf|КонецЦикла|EndDo|КонецПопытки|EndTry|Иначе|Else|ИначеЕсли|ElsIf|Исключение|Except|#КонецОбласти|#EndRegion)\b/i;

export function provideDocumentFormatting(
  document: TextDocument,
  params: DocumentFormattingParams,
): TextEdit[] {
  const tabSize = params.options.tabSize ?? 4;
  const insertSpaces = params.options.insertSpaces ?? false;
  const indent = insertSpaces ? ' '.repeat(tabSize) : '\t';

  const text = document.getText();
  const lines = text.split('\n');
  const edits: TextEdit[] = [];
  let level = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    const content = trimmed.trimStart();

    if (content.length === 0) {
      // Пустая строка -- убрать trailing whitespace
      if (line.length > 0 && line !== '\r') {
        edits.push({
          range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
          newText: '',
        });
      }
      continue;
    }

    // Уменьшаем уровень ДО форматирования текущей строки
    if (INDENT_DECREASE.test(content)) {
      level = Math.max(0, level - 1);
    }

    const expectedIndent = indent.repeat(level);
    const currentIndent = line.slice(0, line.length - line.trimStart().length);

    if (currentIndent !== expectedIndent) {
      edits.push({
        range: { start: { line: i, character: 0 }, end: { line: i, character: currentIndent.length } },
        newText: expectedIndent,
      });
    }

    // Убираем trailing whitespace
    if (trimmed.length < line.length) {
      edits.push({
        range: { start: { line: i, character: trimmed.length }, end: { line: i, character: line.length } },
        newText: '',
      });
    }

    // Увеличиваем уровень ПОСЛЕ форматирования текущей строки
    if (INDENT_INCREASE.test(content)) {
      level++;
    }
  }

  return edits;
}
