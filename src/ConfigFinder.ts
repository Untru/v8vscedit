import * as fs from 'fs';
import * as path from 'path';

/** Описание найденной конфигурации или расширения */
export interface ConfigEntry {
  /** Абсолютный путь к каталогу с Configuration.xml */
  rootPath: string;
  /** Тип: основная конфигурация или расширение */
  kind: 'cf' | 'cfe';
}

/** Максимальная глубина рекурсии поиска Configuration.xml */
const MAX_DEPTH = 10;

/** Папки, которые не нужно обходить */
const SKIP_DIRS = new Set(['node_modules', '.git', '.cursor', 'dist', 'out']);

/**
 * Рекурсивно ищет каталоги с файлом Configuration.xml.
 * Определяет тип: расширение (cfe) — если Configuration.xml содержит
 * тег ConfigurationExtensionPurpose, иначе — основная конфигурация (cf).
 */
export async function findConfigurations(rootDir: string): Promise<ConfigEntry[]> {
  const results: ConfigEntry[] = [];
  await scanDir(rootDir, 0, results);
  return results;
}

async function scanDir(dir: string, depth: number, results: ConfigEntry[]): Promise<void> {
  if (depth > MAX_DEPTH) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const hasConfig = entries.some(
    (e) => e.isFile() && e.name === 'Configuration.xml'
  );

  if (hasConfig) {
    const kind = detectKind(path.join(dir, 'Configuration.xml'));
    results.push({ rootPath: dir, kind });
    // Не углубляемся внутрь найденной конфигурации
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    await scanDir(path.join(dir, entry.name), depth + 1, results);
  }
}

/**
 * Определяет тип по наличию тега ConfigurationExtensionPurpose в Configuration.xml.
 * Читает только первые 8 КБ файла — тег всегда в начале Properties.
 */
function detectKind(configXmlPath: string): 'cf' | 'cfe' {
  try {
    const fd = fs.openSync(configXmlPath, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    const chunk = buf.toString('utf-8', 0, bytesRead);
    if (chunk.includes('<ConfigurationExtensionPurpose>')) {
      return 'cfe';
    }
  } catch {
    // При ошибке считаем конфигурацией
  }
  return 'cf';
}
