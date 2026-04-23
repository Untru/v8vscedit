import { decode } from 'iconv-lite';

/**
 * Нормализует кодировку вывода внешней команды.
 * На Windows консольные утилиты часто пишут в OEM-866/Win1251 вместо UTF-8.
 */
export function decodeProcessOutput(chunk: Buffer): string {
  const utf8Text = chunk.toString('utf-8');
  if (process.platform !== 'win32') {
    return utf8Text;
  }

  if (!utf8Text.includes('�')) {
    return utf8Text;
  }

  const cp866Text = decode(chunk, 'cp866');
  const cp1251Text = decode(chunk, 'win1251');
  return pickMostReadableText([cp866Text, cp1251Text, utf8Text]);
}

/** Выбирает вариант строки с наибольшим числом кириллических символов. */
export function pickMostReadableText(candidates: string[]): string {
  let best = candidates[0] ?? '';
  let bestScore = -1;

  for (const candidate of candidates) {
    const cyr = (candidate.match(/[А-Яа-яЁё]/g) ?? []).length;
    const replacement = (candidate.match(/�/g) ?? []).length;
    const score = cyr * 2 - replacement * 3;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}
