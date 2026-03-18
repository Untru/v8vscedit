import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';

const BLOCK_TYPES = new Set([
  'procedure_definition',
  'function_definition',
  'try_statement',
  'if_statement',
  'while_statement',
  'for_statement',
  'for_each_statement',
]);

/**
 * Возвращает диапазоны сворачивания блоков и #Область / #КонецОбласти.
 */
export async function provideFoldingRanges(
  document: TextDocument,
  parserService: BslParserService,
): Promise<FoldingRange[]> {
  await parserService.ensureInit();
  const tree = parserService.parse(document.getText(), document.uri, document.version);
  const ranges: FoldingRange[] = [];

  collectBlockRanges(tree.rootNode, ranges);
  collectRegionRanges(tree.rootNode, ranges);

  return ranges;
}

function collectBlockRanges(node: Node, ranges: FoldingRange[]): void {
  if (BLOCK_TYPES.has(node.type)) {
    const start = node.startPosition.row;
    const end = node.endPosition.row;
    if (end > start) {
      ranges.push({ startLine: start, endLine: end, kind: FoldingRangeKind.Region });
    }
  }
  for (const child of node.namedChildren) {
    if (child) {
      collectBlockRanges(child, ranges);
    }
  }
}

function collectRegionRanges(root: Node, ranges: FoldingRange[]): void {
  const stack: number[] = [];

  const visit = (node: Node): void => {
    const t = node.type;
    if (t === 'preprocessor' || t === 'preproc') {
      const text = node.text.trim().toLowerCase();
      if (text.startsWith('#область') || text.startsWith('#region')) {
        stack.push(node.startPosition.row);
      } else if (text.startsWith('#конецобласти') || text.startsWith('#endregion')) {
        const startRow = stack.pop();
        if (startRow !== undefined) {
          ranges.push({ startLine: startRow, endLine: node.endPosition.row, kind: FoldingRangeKind.Region });
        }
      }
    }
    for (const child of node.namedChildren) {
      if (child) {
        visit(child);
      }
    }
  };

  visit(root);
}
