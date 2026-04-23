import { Node } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  Position,
} from 'vscode-languageserver/node';
import { BslParserService } from '../BslParserService';
import { BslContextService, ExportMethod } from '../BslContextService';

/** Контекст вызова метода: имя, активный параметр, опциональный модуль-префикс. */
interface CallContext {
  methodName: string;
  activeParam: number;
  dotPrefix?: string;
}

/**
 * Возвращает подсказку параметров (Signature Help) для вызова процедуры/функции.
 */
export async function provideSignatureHelp(
  document: TextDocument,
  position: Position,
  parserService: BslParserService,
  contextService?: BslContextService,
): Promise<SignatureHelp | null> {
  const ctx = findCallContext(document.getText(), position);
  if (!ctx) {
    return null;
  }

  // Поиск в общих модулях через contextService (МодульИмя.Метод)
  if (ctx.dotPrefix && contextService) {
    await contextService.ensureInitialized();
    const methods = await contextService.getExportMethods(ctx.dotPrefix);
    const method = methods.find(
      (m) => m.name.toLowerCase() === ctx.methodName.toLowerCase(),
    );
    if (method) {
      return {
        signatures: [buildSignatureFromExportMethod(method)],
        activeSignature: 0,
        activeParameter: ctx.activeParam,
      };
    }
  }

  // Поиск в текущем файле через tree-sitter
  await parserService.ensureInit();
  const tree = parserService.parse(document.getText(), document.uri, document.version);
  const defNode = findDefinition(tree.rootNode, ctx.methodName);
  if (!defNode) {
    return null;
  }

  const sig = buildSignatureFromNode(defNode);
  if (!sig) {
    return null;
  }

  return {
    signatures: [sig],
    activeSignature: 0,
    activeParameter: ctx.activeParam,
  };
}

/**
 * Анализирует текст до позиции курсора и определяет контекст вызова:
 * имя метода, номер активного параметра, опциональный модуль-префикс.
 */
function findCallContext(text: string, position: Position): CallContext | null {
  const lines = text.split('\n');
  const line = lines[position.line] ?? '';
  const before = line.slice(0, position.character);

  // Идём назад от курсора, считаем скобки, чтобы найти открывающую
  let depth = 0;
  let commaCount = 0;
  let parenPos = -1;

  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === ')') {
      depth++;
    } else if (ch === '(') {
      if (depth === 0) {
        parenPos = i;
        break;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      commaCount++;
    }
  }

  if (parenPos < 0) {
    return null;
  }

  // Извлекаем имя метода перед скобкой
  const beforeParen = before.slice(0, parenPos);
  const match = /([\wа-яА-ЯёЁ_]+)\s*$/u.exec(beforeParen);
  if (!match) {
    return null;
  }

  // Проверяем есть ли точка-префикс (МодульИмя.Метод)
  const dotMatch = /([\wа-яА-ЯёЁ_]+)\.\s*$/u.exec(beforeParen.slice(0, match.index));

  return {
    methodName: match[1],
    activeParam: commaCount,
    dotPrefix: dotMatch ? dotMatch[1] : undefined,
  };
}

/** Ищет определение процедуры/функции в корне AST по имени. */
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

/** Строит SignatureInformation из узла определения процедуры/функции (tree-sitter). */
function buildSignatureFromNode(node: Node): SignatureInformation | null {
  const isFunction = node.type === 'function_definition';
  const nameNode = node.childForFieldName('name');
  if (!nameNode) {
    return null;
  }

  const paramsNode = node.childForFieldName('parameters');
  const params: ParameterInformation[] = [];
  const paramStrings: string[] = [];

  if (paramsNode) {
    for (const param of paramsNode.namedChildren) {
      if (!param || param.type !== 'parameter') {
        continue;
      }

      let paramText = '';
      const valNode = param.childForFieldName('val');
      if (valNode) {
        paramText += 'Знач ';
      }
      const pNameNode = param.childForFieldName('name');
      if (pNameNode) {
        paramText += pNameNode.text;
      }
      const defaultNode = param.childForFieldName('default_value');
      if (defaultNode) {
        paramText += ` = ${defaultNode.text}`;
      }

      paramStrings.push(paramText);
      params.push({ label: paramText });
    }
  }

  const kind = isFunction ? 'Функция' : 'Процедура';
  const label = `${kind} ${nameNode.text}(${paramStrings.join(', ')})`;

  return { label, parameters: params };
}

/** Строит SignatureInformation из ExportMethod общего модуля. */
function buildSignatureFromExportMethod(method: ExportMethod): SignatureInformation {
  const paramNames = method.params
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const kind = method.isFunction ? 'Функция' : 'Процедура';
  const label = `${kind} ${method.name}(${method.params})`;

  return {
    label,
    parameters: paramNames.map((p) => ({ label: p })),
  };
}
