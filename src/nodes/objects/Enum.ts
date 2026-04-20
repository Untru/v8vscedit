import { NodeDescriptor } from '../_types';

export const EnumDescriptor: NodeDescriptor = {
  icon: 'enum',
  folderName: 'Enums',
  /** Как у справочника/документа: группы всегда в дереве, даже без элементов */
  children: ['EnumValue', 'Form', 'Command', 'Template'],
};

