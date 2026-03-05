import * as vscode from 'vscode';
import { NodeKind } from './MetadataNode';

/** Возвращает путь к SVG-иконке для заданного типа узла */
export function getIconPath(nodeKind: NodeKind, extensionUri: vscode.Uri): vscode.Uri {
  const iconMap: Partial<Record<NodeKind, string>> = {
    configuration: 'configuration.svg',
    extension: 'extension.svg',
    'group-common': 'folder-common.svg',
    'group-type': 'folder-type.svg',
    Subsystem: 'subsystem.svg',
    CommonModule: 'common-module.svg',
    Role: 'role.svg',
    CommonForm: 'common-form.svg',
    CommonCommand: 'common-command.svg',
    CommonPicture: 'common-picture.svg',
    StyleItem: 'style-item.svg',
    DefinedType: 'defined-type.svg',
    Constant: 'constant.svg',
    Catalog: 'catalog.svg',
    Document: 'document.svg',
    Enum: 'enum.svg',
    InformationRegister: 'information-register.svg',
    AccumulationRegister: 'accumulation-register.svg',
    AccountingRegister: 'accounting-register.svg',
    CalculationRegister: 'calculation-register.svg',
    Report: 'report.svg',
    DataProcessor: 'data-processor.svg',
    BusinessProcess: 'business-process.svg',
    Task: 'task.svg',
    ExchangePlan: 'exchange-plan.svg',
    ChartOfCharacteristicTypes: 'chart-of-characteristic-types.svg',
    ChartOfAccounts: 'chart-of-accounts.svg',
    ChartOfCalculationTypes: 'chart-of-calculation-types.svg',
    DocumentJournal: 'document-journal.svg',
    ScheduledJob: 'scheduled-job.svg',
    EventSubscription: 'event-subscription.svg',
    HTTPService: 'http-service.svg',
    WebService: 'web-service.svg',
    FilterCriterion: 'filter-criterion.svg',
    Sequence: 'sequence.svg',
    SessionParameter: 'session-parameter.svg',
    FunctionalOption: 'functional-option.svg',
    Language: 'language.svg',
    Attribute: 'attribute.svg',
    TabularSection: 'tabular-section.svg',
    Column: 'attribute.svg',
    Form: 'form.svg',
    Command: 'command.svg',
    Template: 'template.svg',
    Dimension: 'dimension.svg',
    Resource: 'resource.svg',
    EnumValue: 'enum-value.svg',
  };

  const fileName = iconMap[nodeKind] ?? 'attribute.svg';
  return vscode.Uri.joinPath(extensionUri, 'src', 'icons', fileName);
}

