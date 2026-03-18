import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';

/**
 * Вычисляет диагностики документа на основе ERROR-узлов tree-sitter.
 * Не рекурсирует внутрь ERROR-узлов — предотвращает каскад ложных ошибок.
 */
export async function computeDiagnostics(
  document: TextDocument,
  parserService: BslParserService,
): Promise<Diagnostic[]> {
  await parserService.ensureInit();
  const tree = parserService.parse(document.getText(), document.uri, document.version);
  const diagnostics: Diagnostic[] = [];
  collectErrors(tree.rootNode, diagnostics);
  return diagnostics;
}

function collectErrors(node: Node, out: Diagnostic[]): void {
  if (node.isError) {
    const range: Range = {
      start: { line: node.startPosition.row, character: node.startPosition.column },
      end: { line: node.endPosition.row, character: node.endPosition.column },
    };

    // Однострочные ERROR-узлы длиной ≤ 1 символ — артефакты восстановления парсера
    const isTrivial =
      node.startPosition.row === node.endPosition.row &&
      node.endPosition.column - node.startPosition.column <= 1;
    if (isTrivial) {
      return;
    }

    // Только закрывающие скобки — артефакт скобочного RHS присвоения,
    // grammar не поддерживает (expr) как самостоятельное выражение
    if (/^\)+$/.test(node.text.trim())) {
      return;
    }

    out.push({
      range,
      message: 'Синтаксическая ошибка',
      severity: DiagnosticSeverity.Error,
      source: 'bsl',
    });
    return;
  }

  for (const child of node.children) {
    if (child) {
      collectErrors(child, out);
    }
  }
}
