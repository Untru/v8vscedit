import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { getWordAtPosition } from '../lspUtils';
import { GLOBAL_METHODS_MAP, GlobalMethodInfo } from '../data/globalMethods';

/**
 * Возвращает подсказку при наведении — сигнатуру процедуры/функции под курсором.
 */
export async function provideHover(
  document: TextDocument,
  position: Position,
  parserService: BslParserService,
): Promise<Hover | null> {
  const wordInfo = getWordAtPosition(document.getText(), position, /[\wа-яА-ЯёЁ_]+/);
  if (!wordInfo) {
    return null;
  }

  await parserService.ensureInit();
  const tree = parserService.parse(document.getText(), document.uri, document.version);

  const defNode = findDefinition(tree.rootNode, wordInfo.word);
  if (!defNode) {
    const globalMethod = GLOBAL_METHODS_MAP.get(wordInfo.word.toLowerCase());
    if (globalMethod) {
      return {
        contents: { kind: MarkupKind.Markdown, value: buildGlobalMethodHover(globalMethod) },
        range: wordInfo.range,
      };
    }
    return null;
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: buildHoverMarkdown(defNode),
    },
    range: wordInfo.range,
  };
}

function findDefinition(root: Node, name: string): Node | null {
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
      return node;
    }
  }
  return null;
}

function buildHoverMarkdown(node: Node): string {
  const isFunction = node.type === 'function_definition';
  const kind = isFunction ? 'Функция' : 'Процедура';

  const nameNode = node.childForFieldName('name');
  const name = nameNode?.text ?? '';

  const paramsNode = node.childForFieldName('parameters');
  const params = paramsNode ? buildParamsString(paramsNode) : '';

  const exportNode = node.childForFieldName('export');
  const exportSuffix = exportNode ? ' Экспорт' : '';

  let annotation = '';
  const parent = node.parent;
  if (parent) {
    const siblings = parent.namedChildren.filter((n): n is Node => n !== null);
    const idx = siblings.indexOf(node);
    if (idx > 0) {
      const prev = siblings[idx - 1];
      if (prev.type === 'annotation') {
        annotation = `\n\n${prev.text}`;
      }
    }
  }

  return `\`\`\`bsl\n${kind} ${name}(${params})${exportSuffix}${annotation}\n\`\`\``;
}

function buildParamsString(paramsNode: Node): string {
  const parts: string[] = [];
  for (const param of paramsNode.namedChildren) {
    if (!param || param.type !== 'parameter') {
      continue;
    }
    let text = '';
    const valNode = param.childForFieldName('val');
    if (valNode) {
      text += 'Знач ';
    }
    const nameNode = param.childForFieldName('name');
    if (nameNode) {
      text += nameNode.text;
    }
    const defaultNode = param.childForFieldName('default_value');
    if (defaultNode) {
      text += ` = ${defaultNode.text}`;
    }
    parts.push(text);
  }
  return parts.join(', ');
}

function buildGlobalMethodHover(method: GlobalMethodInfo): string {
  const kind = method.isFunction ? 'Функция' : 'Процедура';
  const paramsStr = method.params.map(p =>
    `${p.name}: ${p.type}${p.optional ? ' (необязательный)' : ''}`
  ).join(', ');

  let md = `\`\`\`bsl\n${kind} ${method.nameRu}(${paramsStr})`;
  if (method.returnType) md += ` : ${method.returnType}`;
  md += `\n\`\`\`\n\n${method.description}`;

  if (method.params.length > 0) {
    md += '\n\n**Параметры:**\n';
    for (const p of method.params) {
      md += `- **${p.name}** (*${p.type}*${p.optional ? ', необязательный' : ''}) \u2014 ${p.description}\n`;
    }
  }

  if (method.returnType) {
    md += `\n**Возвращает:** *${method.returnType}*`;
  }

  md += `\n\n*Категория: ${method.category}*`;
  return md;
}
