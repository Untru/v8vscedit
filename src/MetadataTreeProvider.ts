import * as vscode from 'vscode';
import * as path from 'path';
import { MetadataNode, NodeKind } from './MetadataNode';
import { getIconUris } from './nodes/presentation/icon';
import { COMMON_SUBGROUPS, TOP_GROUPS } from './MetadataGroups';
import { ConfigInfo, parseConfigXml } from './ConfigParser';
import { ConfigEntry } from './ConfigFinder';
import { buildNode } from './nodes/_base';
import { getNodeDescriptor } from './nodes';
import { getObjectHandler } from './handlers';
import { SupportInfoService, SupportMode } from './services/SupportInfoService';
import { RepoLockService, RepoLockStatus } from './services/RepoLockService';

export class MetadataTreeProvider implements vscode.TreeDataProvider<MetadataNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MetadataNode | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private roots: MetadataNode[] = [];

  constructor(
    private entries: ConfigEntry[],
    private readonly extensionUri: vscode.Uri,
    private readonly supportService?: SupportInfoService,
    private readonly repoLockService?: RepoLockService
  ) {
    this.buildRoots();
  }

  /** Пересобирает корневые узлы */
  refresh(): void {
    this.buildRoots();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Обновляет список конфигураций и пересобирает дерево */
  updateEntries(entries: ConfigEntry[]): void {
    this.entries = entries;
    this.refresh();
  }

  getTreeItem(element: MetadataNode): vscode.TreeItem {
    element.iconPath = getIconUris(element.nodeKind, element.ownershipTag, this.extensionUri);
    this.applySupportDecoration(element);
    this.applyRepoLockDecoration(element);
    return element;
  }

  /**
   * Добавляет к contextValue суффикс `-support{N}` (для inline-иконки при наведении)
   * и метку режима поддержки в description (всегда видима).
   * Вызывается только для узлов с xmlPath и только если для конфигурации
   * загружены данные поддержки.
   */
  private applySupportDecoration(element: MetadataNode): void {
    if (!element.xmlPath || !this.supportService) { return; }
    if (!this.supportService.hasConfigData(element.xmlPath)) { return; }

    const mode = this.supportService.getSupportMode(element.xmlPath);

    // Суффикс contextValue для показа inline-иконки при наведении
    const baseCtx = (element.contextValue ?? '').replace(/-support\d$/, '');
    element.contextValue = `${baseCtx}-support${mode}`;
  }

  /**
   * Добавляет к contextValue суффикс статуса захвата в хранилище:
   * `-repoFree`, `-repoLockedByMe`, `-repoLockedByOther`.
   * Для корневого узла конфигурации добавляет `-repoConnected`.
   */
  private applyRepoLockDecoration(element: MetadataNode): void {
    if (!this.repoLockService) { return; }

    const configRoot = element.configRoot;
    if (!configRoot) { return; }

    const baseCtx = (element.contextValue ?? '')
      .replace(/-repo(?:Connected|Free|LockedByMe|LockedByOther)/g, '');
    const label = typeof element.label === 'string' ? element.label : '';
    const baseTooltip = typeof element.tooltip === 'string'
      ? element.tooltip.replace(/\r?\nЗахвачен:.*$/u, '')
      : element.tooltip;

    // Для корневого узла конфигурации — только маркер подключения
    if (element.nodeKind === 'configuration' || element.nodeKind === 'extension') {
      if (this.repoLockService.isConnected(configRoot)) {
        element.contextValue = `${baseCtx}-repoConnected`;
      } else {
        element.contextValue = baseCtx;
      }
      return;
    }

    // Для объектов метаданных — статус захвата
    element.contextValue = baseCtx;
    element.tooltip = baseTooltip;

    if (!this.repoLockService.isConnected(configRoot)) { return; }
    if (!this.repoLockService.hasLockData(configRoot)) { return; }
    if (!this.repoLockService.isLockable(element.nodeKind)) { return; }

    const status = this.repoLockService.getLockStatus(configRoot, element.nodeKind, label);

    let suffix: string;
    switch (status) {
      case RepoLockStatus.LockedByMe:
        suffix = '-repoLockedByMe';
        break;
      case RepoLockStatus.LockedByOther:
        suffix = '-repoLockedByOther';
        break;
      default:
        suffix = '-repoFree';
        break;
    }

    const info = this.repoLockService.getLockInfo(configRoot, element.nodeKind, label);
    if (info?.lockedBy) {
      element.tooltip = `${typeof baseTooltip === 'string' ? baseTooltip : label}\nЗахвачен: ${info.lockedBy}`;
    }

    element.contextValue = `${baseCtx}${suffix}`;
  }

  getChildren(element?: MetadataNode): MetadataNode[] {
    if (!element) {
      if (this.roots.length === 0) {
        return [
          new MetadataNode(
            'Загрузка...',
            'group-type',
            vscode.TreeItemCollapsibleState.None,
            undefined,
            undefined,
            undefined,
            true
          ),
        ];
      }
      return this.roots;
    }
    if (element.childrenLoader) {
      return element.childrenLoader();
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // Построение дерева
  // ---------------------------------------------------------------------------

  private buildRoots(): void {
    // Предзагружаем данные поддержки для каждой найденной конфигурации
    if (this.supportService) {
      for (const entry of this.entries) {
        this.supportService.loadConfig(entry.rootPath);
      }
    }
    this.roots = this.entries.map((entry) => this.buildConfigNode(entry));
  }

  /** Строит корневой узел конфигурации или расширения */
  private buildConfigNode(entry: ConfigEntry): MetadataNode {
    const configXmlPath = path.join(entry.rootPath, 'Configuration.xml');
    const info = parseConfigXml(configXmlPath);

    // Для корневого узла показываем только имя, без префикса "Конфигурация".
    const label = info.name;

    const nodeKind: NodeKind = entry.kind === 'cf' ? 'configuration' : 'extension';

    const descriptor = getNodeDescriptor(nodeKind);
    const node = buildNode(descriptor, {
      label,
      kind: nodeKind,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      xmlPath: configXmlPath,
      childrenLoader: () => this.buildConfigChildren(entry, info),
      ownershipTag: undefined,
    });
    node.configRoot = entry.rootPath;

    if (info.synonym) {
      node.tooltip = info.synonym;
    }

    return node;
  }

  /**
   * Строит полный набор корневых групп: «Общие» + остальные.
   * Группы создаются безусловно — наполнение реализуется через обработчики.
   */
  private buildConfigChildren(entry: ConfigEntry, info: ConfigInfo): MetadataNode[] {
    const result: MetadataNode[] = [];

    const commonDescriptor = getNodeDescriptor('group-common');
    result.push(
      buildNode(commonDescriptor, {
        label: 'Общие',
        kind: 'group-common',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        xmlPath: undefined,
        childrenLoader: () => this.buildCommonSubgroups(entry, info),
        ownershipTag: undefined,
      })
    );

    for (const group of TOP_GROUPS) {
      const descriptor = getNodeDescriptor(group.kind);
      const mergeTypes = Boolean(group.mergeTypes && group.types.length > 1);

      let mergedChildren: MetadataNode[] | undefined;
      const handler = mergeTypes ? undefined : getObjectHandler(group.types[0]);
      const names = !mergeTypes && handler ? this.collectNames(info, group.types) : [];

      if (mergeTypes) {
        if (group.kind === 'Document') {
          // Как в конфигураторе: сначала ветка «Нумераторы», затем «Последовательности», потом документы
          mergedChildren = this.buildDocumentsBranchChildren(entry, info);
        } else {
          const parts: MetadataNode[] = [];
          for (const t of group.types) {
            const h = getObjectHandler(t);
            const typeNames = info.childObjects.get(t) ?? [];
            if (h && typeNames.length > 0) {
              parts.push(
                ...h.buildTreeNodes({
                  configRoot: entry.rootPath,
                  configKind: entry.kind,
                  namePrefix: info.namePrefix,
                  names: typeNames,
                })
              );
            }
          }
          mergedChildren = this.tagConfigRoot(parts, entry.rootPath);
        }
      }

      const hasChildren = mergeTypes
        ? Boolean(mergedChildren && mergedChildren.length > 0)
        : Boolean(handler && names.length > 0);

      result.push(
        buildNode(descriptor, {
          label: group.label,
          kind: group.kind,
          collapsibleState: hasChildren
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          xmlPath: undefined,
          childrenLoader: hasChildren
            ? () =>
                this.tagConfigRoot(
                  mergeTypes && mergedChildren
                    ? mergedChildren
                    : handler!.buildTreeNodes({
                        configRoot: entry.rootPath,
                        configKind: entry.kind,
                        namePrefix: info.namePrefix,
                        names,
                      }),
                  entry.rootPath
                )
            : undefined,
          ownershipTag: undefined,
        })
      );
    }

    return result;
  }

  /**
   * Дочерние узлы группы «Документы»: подветки нумераторов и последовательностей,
   * затем объекты документов (плоский merge давал неверный вид без промежуточных папок).
   */
  private buildDocumentsBranchChildren(entry: ConfigEntry, info: ConfigInfo): MetadataNode[] {
    const children: MetadataNode[] = [];
    const numNames = info.childObjects.get('DocumentNumerator') ?? [];
    const seqNames = info.childObjects.get('Sequence') ?? [];
    const docNames = info.childObjects.get('Document') ?? [];

    const numHandler = getObjectHandler('DocumentNumerator');
    const numDesc = getNodeDescriptor('NumeratorsBranch')!;
    const hasNum = Boolean(numHandler && numNames.length > 0);
    children.push(
      buildNode(numDesc, {
        label: 'Нумераторы',
        kind: 'NumeratorsBranch',
        collapsibleState: hasNum
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        xmlPath: undefined,
        childrenLoader: hasNum
          ? () =>
              this.tagConfigRoot(
                numHandler!.buildTreeNodes({
                  configRoot: entry.rootPath,
                  configKind: entry.kind,
                  namePrefix: info.namePrefix,
                  names: numNames,
                }),
                entry.rootPath
              )
          : undefined,
        ownershipTag: undefined,
        hidePropertiesCommand: true,
      })
    );

    const seqHandler = getObjectHandler('Sequence');
    const seqDesc = getNodeDescriptor('SequencesBranch')!;
    const hasSeq = Boolean(seqHandler && seqNames.length > 0);
    children.push(
      buildNode(seqDesc, {
        label: 'Последовательности',
        kind: 'SequencesBranch',
        collapsibleState: hasSeq
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        xmlPath: undefined,
        childrenLoader: hasSeq
          ? () =>
              this.tagConfigRoot(
                seqHandler!.buildTreeNodes({
                  configRoot: entry.rootPath,
                  configKind: entry.kind,
                  namePrefix: info.namePrefix,
                  names: seqNames,
                }),
                entry.rootPath
              )
          : undefined,
        ownershipTag: undefined,
        hidePropertiesCommand: true,
      })
    );

    const docHandler = getObjectHandler('Document');
    if (docHandler && docNames.length > 0) {
      children.push(
        ...this.tagConfigRoot(
          docHandler.buildTreeNodes({
            configRoot: entry.rootPath,
            configKind: entry.kind,
            namePrefix: info.namePrefix,
            names: docNames,
          }),
          entry.rootPath
        )
      );
    }

    return children;
  }

  /** Строит полный набор подгрупп внутри «Общие» */
  private buildCommonSubgroups(entry: ConfigEntry, info: ConfigInfo): MetadataNode[] {
    return COMMON_SUBGROUPS.map((sg) => {
      const descriptor = getNodeDescriptor(sg.kind);
      const handler = getObjectHandler(sg.types[0]);
      const names = handler ? this.collectNames(info, sg.types) : [];
      const hasChildren = Boolean(handler && names.length > 0);

      return buildNode(descriptor, {
        label: sg.label,
        kind: sg.kind,
        collapsibleState: hasChildren
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        xmlPath: undefined,
        childrenLoader: hasChildren
          ? () =>
              this.tagConfigRoot(
                handler!.buildTreeNodes({
                  configRoot: entry.rootPath,
                  configKind: entry.kind,
                  namePrefix: info.namePrefix,
                  names,
                }),
                entry.rootPath
              )
          : undefined,
        ownershipTag: undefined,
      });
    });
  }

  /** Проставляет configRoot на массиве узлов и возвращает его */
  private tagConfigRoot(nodes: MetadataNode[], configRoot: string): MetadataNode[] {
    for (const n of nodes) { n.configRoot = configRoot; }
    return nodes;
  }

  /** Собирает имена объектов по нескольким типам из ChildObjects */
  private collectNames(info: ConfigInfo, types: string[]): string[] {
    const result: string[] = [];
    for (const t of types) {
      result.push(...(info.childObjects.get(t) ?? []));
    }
    return result;
  }
}

