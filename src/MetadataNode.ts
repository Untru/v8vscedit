import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Типы узлов
// ---------------------------------------------------------------------------

export type NodeKind =
  // Корневые
  | 'configuration'
  | 'extension'
  // Группы верхнего уровня
  | 'group-common'
  | 'group-type'
  // Типы объектов (группа + иконка)
  | 'Subsystem'
  | 'CommonModule'
  | 'Role'
  | 'CommonForm'
  | 'CommonCommand'
  | 'CommonPicture'
  | 'StyleItem'
  | 'DefinedType'
  | 'Constant'
  | 'Catalog'
  | 'Document'
  | 'Enum'
  | 'InformationRegister'
  | 'AccumulationRegister'
  | 'AccountingRegister'
  | 'CalculationRegister'
  | 'Report'
  | 'DataProcessor'
  | 'BusinessProcess'
  | 'Task'
  | 'ExchangePlan'
  | 'ChartOfCharacteristicTypes'
  | 'ChartOfAccounts'
  | 'ChartOfCalculationTypes'
  | 'DocumentJournal'
  | 'ScheduledJob'
  | 'EventSubscription'
  | 'HTTPService'
  | 'WebService'
  | 'FilterCriterion'
  | 'Sequence'
  | 'SessionParameter'
  | 'FunctionalOption'
  | 'Language'
  // Дочерние элементы
  | 'Attribute'
  | 'TabularSection'
  | 'Column'
  | 'Form'
  | 'Command'
  | 'Template'
  | 'Dimension'
  | 'Resource'
  | 'EnumValue';

/** Узел дерева метаданных */
export class MetadataNode extends vscode.TreeItem {
  constructor(
    /** Отображаемая метка */
    public readonly label: string,
    /** Тип узла */
    public readonly nodeKind: NodeKind,
    /** Состояние раскрытия */
    collapsibleState: vscode.TreeItemCollapsibleState,
    /** Путь к XML-файлу (для открытия по клику) */
    public readonly xmlPath?: string,
    /** Функция ленивой загрузки дочерних узлов */
    public readonly childrenLoader?: () => MetadataNode[],
    /** Тег объекта расширения: [OWN] / [BORROWED] */
    public readonly ownershipTag?: 'OWN' | 'BORROWED'
  ) {
    super(label, collapsibleState);
    // Суффикс -hasXml позволяет фильтровать пункты контекстного меню
    this.contextValue = xmlPath ? `${nodeKind}-hasXml` : nodeKind;

    if (ownershipTag) {
      this.description = ownershipTag === 'OWN' ? '[свой]' : '[заим.]';
    }
  }
}
