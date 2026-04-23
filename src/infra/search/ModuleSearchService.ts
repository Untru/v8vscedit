import * as fs from 'fs';
import * as path from 'path';

export interface SearchResult {
  /** Путь к .bsl файлу */
  filePath: string;
  /** Строка, где найдено совпадение */
  line: number;
  /** Колонка начала */
  column: number;
  /** Текст строки */
  lineText: string;
  /** Имя объекта метаданных (из пути) */
  objectName: string;
  /** Тип модуля (МодульОбъекта, МодульМенеджера и т.д.) */
  moduleType: string;
}

/**
 * Ищет текст по всем .bsl файлам в заданных корнях.
 */
export async function searchInModules(
  searchText: string,
  rootPaths: string[],
  options?: { caseSensitive?: boolean; regex?: boolean; maxResults?: number }
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const maxResults = options?.maxResults ?? 500;
  const caseSensitive = options?.caseSensitive ?? false;

  let pattern: RegExp;
  try {
    const source = options?.regex ? searchText : escapeRegex(searchText);
    const flags = caseSensitive ? 'g' : 'gi';
    pattern = new RegExp(source, flags);
  } catch {
    return [];
  }

  for (const root of rootPaths) {
    if (results.length >= maxResults) break;
    await searchDir(root, pattern, results, maxResults, 0);
  }

  return results;
}

async function searchDir(
  dir: string,
  pattern: RegExp,
  results: SearchResult[],
  maxResults: number,
  depth: number
): Promise<void> {
  if (depth > 12 || results.length >= maxResults) return;

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await searchDir(full, pattern, results, maxResults, depth + 1);
    } else if (entry.name.endsWith('.bsl')) {
      await searchFile(full, pattern, results, maxResults);
    }
  }
}

async function searchFile(
  filePath: string,
  pattern: RegExp,
  results: SearchResult[],
  maxResults: number
): Promise<void> {
  let text: string;
  try {
    text = await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return;
  }

  const { objectName, moduleType } = parseModulePath(filePath);
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (results.length >= maxResults) return;

    const line = lines[i];
    // Reset lastIndex for each line
    const linePattern = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = linePattern.exec(line)) !== null) {
      results.push({
        filePath,
        line: i,
        column: match.index,
        lineText: line.trimEnd(),
        objectName,
        moduleType,
      });
      if (results.length >= maxResults) return;
    }
  }
}

/** Извлекает имя объекта и тип модуля из пути */
function parseModulePath(filePath: string): { objectName: string; moduleType: string } {
  const norm = filePath.replace(/\\/g, '/');
  const parts = norm.split('/');
  const fileName = parts[parts.length - 1]?.replace('.bsl', '') ?? '';

  const moduleNames: Record<string, string> = {
    'Module': 'Модуль',
    'ObjectModule': 'МодульОбъекта',
    'ManagerModule': 'МодульМенеджера',
    'RecordSetModule': 'МодульНабораЗаписей',
    'CommandModule': 'МодульКоманды',
    'ValueManagerModule': 'МодульМенеджераЗначения',
  };
  const moduleType = moduleNames[fileName] ?? fileName;

  // Ищем Ext/ в пути — объект выше
  const extIdx = parts.lastIndexOf('Ext');
  let objectName = fileName;
  if (extIdx >= 1) {
    objectName = parts[extIdx - 1] ?? fileName;
    // Если есть ещё уровень — добавляем тип
    if (extIdx >= 2) {
      const typeFolder = parts[extIdx - 2];
      objectName = `${typeFolder}/${objectName}`;
    }
  }

  return { objectName, moduleType };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
