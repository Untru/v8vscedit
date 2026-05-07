import type { BasedOnReferenceItem } from '../../../infra/xml';
import type { MetadataReferenceListItem } from './_types';

export function toMetadataReferenceListItem(item: BasedOnReferenceItem): MetadataReferenceListItem {
  return {
    canonical: item.ref,
    display: toMetadataReferenceDisplay(item.ref),
  };
}

export function toMetadataReferenceDisplay(ref: string): string {
  const dotIndex = ref.indexOf('.');
  if (dotIndex <= 0) {
    return ref;
  }
  const kind = ref.slice(0, dotIndex);
  const name = ref.slice(dotIndex + 1);
  if (kind === 'Catalog') {
    return `Справочники.${name}`;
  }
  if (kind === 'Document') {
    return `Документы.${name}`;
  }
  return ref;
}

export function extractFormNameFromReference(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const marker = '.Form.';
  const markerIndex = trimmed.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return trimmed.slice(markerIndex + marker.length);
  }
  return trimmed;
}

export function getReferencePickerTitle(key: string): string {
  if (key === 'BasedOn') {
    return 'Добавить основание';
  }
  if (key === 'BasedFor') {
    return 'Добавить объект, вводимый на основании текущего';
  }
  return 'Добавить владельца';
}

export function getEmptyReferencePickerMessage(key: string): string {
  if (key === 'BasedOn' || key === 'BasedFor') {
    return 'Все доступные справочники и документы уже добавлены.';
  }
  return 'Все доступные справочники уже добавлены во владельцы.';
}

/** Экранирует строку для безопасной вставки в HTML */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toNumberOrUndefined(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export function arePropertyEditValuesEqual(
  left: string | boolean | string[],
  right: string | boolean | string[]
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.every((value, index) => value === sortedRight[index]);
  }
  return left === right;
}
