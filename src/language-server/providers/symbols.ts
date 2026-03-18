import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentSymbol, SymbolKind, Range } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { nodeToRange } from '../lspUtils';

/**
 * Возвращает символы документа (процедуры, функции, переменные) для Outline и хлебных крошек.
 */
export async function provideDocumentSymbols(
  document: TextDocument,
  parserService: BslParserService,
): Promise<DocumentSymbol[]> {
  await parserService.ensureInit();
  const tree = parserService.parse(document.getText(), document.uri, document.version);
  return extractSymbols(tree.rootNode, document);
}

function extractSymbols(root: Node, document: TextDocument): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const children = root.namedChildren.filter((n): n is Node => n !== null);

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const t = node.type;
    if (t !== 'procedure_definition' && t !== 'function_definition') {
      continue;
    }

    const nameNode = node.childForFieldName('name');
    if (!nameNode) {
      continue;
    }

    const nameRange = nodeToRange(nameNode);
    const fullRange = nodeToRange(node);

    // Аннотация-сиблинг перед функцией (&НаКлиенте и т.п.)
    let detail = '';
    if (i > 0) {
      const prev = children[i - 1];
      if (prev.type === 'annotation') {
        detail = document.getText(nodeToRange(prev) as Range);
      }
    }

    const sym: DocumentSymbol = {
      name: nameNode.text,
      detail,
      kind: SymbolKind.Function,
      range: fullRange,
      selectionRange: nameRange,
      children: extractVarSymbols(node),
    };

    symbols.push(sym);
  }

  return symbols;
}

function extractVarSymbols(procNode: Node): DocumentSymbol[] {
  const vars: DocumentSymbol[] = [];

  const collect = (node: Node): void => {
    if (node.type === 'var_statement' || node.type === 'var_definition') {
      for (const child of node.namedChildren) {
        if (child?.type === 'var_name') {
          const range = nodeToRange(child);
          vars.push({
            name: child.text,
            detail: '',
            kind: SymbolKind.Variable,
            range,
            selectionRange: range,
          });
        }
      }
    }
    for (const c of node.namedChildren) {
      if (c) {
        collect(c);
      }
    }
  };

  collect(procNode);
  return vars;
}
