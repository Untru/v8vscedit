import * as fs from 'fs';
import * as path from 'path';
import { MetaPathResolver } from '../fs/MetaPathResolver';
import { ConfigXmlReader } from './ConfigXmlReader';
import { ObjectXmlReader } from './ObjectXmlReader';
import { extractNestingAwareBlock } from './XmlUtils';

export type BasedOnMetaKind = 'Catalog' | 'Document';

export interface BasedOnReferenceItem {
  ref: string;
  kind: BasedOnMetaKind;
  name: string;
  xmlPath: string;
}

export interface BasedOnSnapshot {
  objectRef: string;
  basedOn: BasedOnReferenceItem[];
  basedFor: BasedOnReferenceItem[];
  available: BasedOnReferenceItem[];
}

export interface BasedOnEditResult {
  changed: boolean;
  changedFiles: string[];
}

const SUPPORTED_KINDS: readonly BasedOnMetaKind[] = ['Catalog', 'Document'];

/** Двусторонний редактор связей «Ввод на основании» для справочников и документов. */
export class BasedOnXmlService {
  private readonly configReader = new ConfigXmlReader();
  private readonly pathResolver = new MetaPathResolver();
  private readonly objectReader = new ObjectXmlReader();

  readSnapshot(configRoot: string, objectKind: BasedOnMetaKind, objectName: string): BasedOnSnapshot {
    const objectRef = this.buildRef(objectKind, objectName);
    const available = this.readAvailableObjects(configRoot);
    const byRef = new Map(available.map((item) => [item.ref, item]));
    const current = byRef.get(objectRef);
    const basedOnRefs = current ? this.readBasedOnRefs(current.xmlPath) : [];
    const basedForRefs = available
      .filter((item) => item.ref !== objectRef && this.readBasedOnRefs(item.xmlPath).includes(objectRef))
      .map((item) => item.ref);

    return {
      objectRef,
      basedOn: basedOnRefs.map((ref) => byRef.get(ref) ?? this.buildMissingItem(configRoot, ref)).filter(isReferenceItem),
      basedFor: basedForRefs.map((ref) => byRef.get(ref) ?? this.buildMissingItem(configRoot, ref)).filter(isReferenceItem),
      available,
    };
  }

  setBasedOn(configRoot: string, objectKind: BasedOnMetaKind, objectName: string, refs: string[]): BasedOnEditResult {
    const xmlPath = this.pathResolver.resolveXml(configRoot, objectKind, objectName);
    if (!xmlPath) {
      return { changed: false, changedFiles: [] };
    }
    return this.writeBasedOn(xmlPath, uniqueRefs(refs));
  }

  setBasedFor(configRoot: string, objectKind: BasedOnMetaKind, objectName: string, refs: string[]): BasedOnEditResult {
    const objectRef = this.buildRef(objectKind, objectName);
    const selected = new Set(uniqueRefs(refs));
    const changedFiles: string[] = [];

    for (const target of this.readAvailableObjects(configRoot)) {
      if (target.ref === objectRef) {
        continue;
      }
      const current = this.readBasedOnRefs(target.xmlPath);
      const hasRef = current.includes(objectRef);
      const shouldHaveRef = selected.has(target.ref);
      if (hasRef === shouldHaveRef) {
        continue;
      }
      const next = shouldHaveRef
        ? [...current, objectRef]
        : current.filter((ref) => ref !== objectRef);
      const written = this.writeBasedOn(target.xmlPath, next);
      changedFiles.push(...written.changedFiles);
    }

    return { changed: changedFiles.length > 0, changedFiles };
  }

  readAvailableObjects(configRoot: string): BasedOnReferenceItem[] {
    const configXmlPath = path.join(configRoot, 'Configuration.xml');
    if (!fs.existsSync(configXmlPath)) {
      return [];
    }
    const info = this.configReader.read(configXmlPath);
    const result: BasedOnReferenceItem[] = [];
    for (const kind of SUPPORTED_KINDS) {
      for (const name of info.childObjects.get(kind) ?? []) {
        const xmlPath = this.pathResolver.resolveXml(configRoot, kind, name);
        if (!xmlPath) {
          continue;
        }
        result.push({
          ref: this.buildRef(kind, name),
          kind,
          name,
          xmlPath,
        });
      }
    }
    return result.sort((left, right) => this.refOrder(left, right));
  }

  private readBasedOnRefs(xmlPath: string): string[] {
    try {
      const xml = fs.readFileSync(xmlPath, 'utf-8');
      const inner = extractNestingAwareBlock(xml, 'BasedOn') ?? '';
      return uniqueRefs(Array.from(inner.matchAll(/<xr:Item\b[^>]*>([^<]+)<\/xr:Item>/g)).map((match) => match[1].trim()));
    } catch {
      return [];
    }
  }

  private writeBasedOn(xmlPath: string, refs: string[]): BasedOnEditResult {
    const changed = this.objectReader.updatePropertyInObject(xmlPath, {
      targetKind: 'Self',
      targetName: '',
      propertyKey: 'BasedOn',
      valueKind: 'metadataReferenceList',
      value: uniqueRefs(refs),
    });
    return changed ? { changed: true, changedFiles: [xmlPath] } : { changed: false, changedFiles: [] };
  }

  private buildRef(kind: BasedOnMetaKind, name: string): string {
    return `${kind}.${name}`;
  }

  private buildMissingItem(configRoot: string, ref: string): BasedOnReferenceItem | null {
    const parsed = parseSupportedRef(ref);
    if (!parsed) {
      return null;
    }
    return {
      ref,
      kind: parsed.kind,
      name: parsed.name,
      xmlPath: this.pathResolver.resolveXml(configRoot, parsed.kind, parsed.name) ?? '',
    };
  }

  private refOrder(left: BasedOnReferenceItem, right: BasedOnReferenceItem): number {
    if (left.kind !== right.kind) {
      return SUPPORTED_KINDS.indexOf(left.kind) - SUPPORTED_KINDS.indexOf(right.kind);
    }
    return left.name.localeCompare(right.name, 'ru');
  }
}

function parseSupportedRef(ref: string): { kind: BasedOnMetaKind; name: string } | null {
  const dotIndex = ref.indexOf('.');
  if (dotIndex <= 0 || dotIndex >= ref.length - 1) {
    return null;
  }
  const kind = ref.slice(0, dotIndex);
  if (kind !== 'Catalog' && kind !== 'Document') {
    return null;
  }
  return { kind, name: ref.slice(dotIndex + 1) };
}

function uniqueRefs(refs: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs.map((item) => item.trim()).filter(Boolean)) {
    if (!parseSupportedRef(ref) || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    result.push(ref);
  }
  return result;
}

function isReferenceItem(item: BasedOnReferenceItem | null): item is BasedOnReferenceItem {
  return item !== null;
}
