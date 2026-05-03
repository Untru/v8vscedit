import * as fs from 'fs';
import * as path from 'path';
import { parseConfigXml } from '../../../infra/xml';
import { MetadataTypeItem } from './_types';
import { buildEventSourceItemsFromConfiguration } from './EventSubscriptionPropertyService';

export interface TypeRegistryTreeGroup {
  id: string;
  title: string;
  items: MetadataTypeItem[];
}

/** Набор типов, который нужен конкретному свойству панели. */
export type TypeRegistryFilter = 'value' | 'commandParameter' | 'eventSource';

/**
 * Реестр доступных типов для окна выбора:
 * сначала стандартные типы платформы, затем типы текущей конфигурации.
 */
export class TypeRegistryService {
  getAvailableTypes(sourceXmlPath: string | undefined, filter: TypeRegistryFilter = 'value'): TypeRegistryTreeGroup[] {
    switch (filter) {
      case 'commandParameter':
        return this.getConfigurationTypes(sourceXmlPath);
      case 'eventSource':
        return [this.getGenericEventSourceTypes(), ...buildEventSourceItemsFromConfiguration(sourceXmlPath)];
      case 'value':
      default:
        return [this.getBaseTypes(), ...this.getConfigurationTypes(sourceXmlPath)];
    }
  }

  private getBaseTypes(): TypeRegistryTreeGroup {
    return {
      id: 'base',
      title: 'Стандартные типы',
      items: [
        { canonical: 'String', display: 'Строка', group: 'primitive' },
        { canonical: 'Number', display: 'Число', group: 'primitive' },
        { canonical: 'Boolean', display: 'Булево', group: 'primitive' },
        { canonical: 'Date', display: 'Дата', group: 'primitive' },
        { canonical: 'DateTime', display: 'ДатаВремя', group: 'primitive' },
        { canonical: 'ValueStorage', display: 'ХранилищеЗначения', group: 'primitive' },
      ],
    };
  }

  private getGenericEventSourceTypes(): TypeRegistryTreeGroup {
    return {
      id: 'eventSourceKinds',
      title: 'Типы источников',
      items: [
        { canonical: 'CatalogObject', display: 'СправочникОбъект', group: 'reference' },
        { canonical: 'CatalogManager', display: 'СправочникМенеджер', group: 'reference' },
        { canonical: 'DocumentObject', display: 'ДокументОбъект', group: 'reference' },
        { canonical: 'DocumentManager', display: 'ДокументМенеджер', group: 'reference' },
        { canonical: 'ConstantValueManager', display: 'КонстантаМенеджерЗначения', group: 'reference' },
        { canonical: 'ExchangePlanObject', display: 'ПланОбменаОбъект', group: 'reference' },
        { canonical: 'BusinessProcessObject', display: 'БизнесПроцессОбъект', group: 'reference' },
        { canonical: 'BusinessProcessManager', display: 'БизнесПроцессМенеджер', group: 'reference' },
        { canonical: 'TaskObject', display: 'ЗадачаОбъект', group: 'reference' },
        { canonical: 'ChartOfAccountsObject', display: 'ПланСчетовОбъект', group: 'reference' },
        { canonical: 'ChartOfCalculationTypesObject', display: 'ПланВидовРасчетаОбъект', group: 'reference' },
        { canonical: 'ChartOfCharacteristicTypesObject', display: 'ПланВидовХарактеристикОбъект', group: 'reference' },
        { canonical: 'InformationRegisterRecordSet', display: 'РегистрСведенийНаборЗаписей', group: 'reference' },
        { canonical: 'InformationRegisterManager', display: 'РегистрСведенийМенеджер', group: 'reference' },
        { canonical: 'AccumulationRegisterRecordSet', display: 'РегистрНакопленияНаборЗаписей', group: 'reference' },
        { canonical: 'AccountingRegisterRecordSet', display: 'РегистрБухгалтерииНаборЗаписей', group: 'reference' },
        { canonical: 'CalculationRegisterRecordSet', display: 'РегистрРасчетаНаборЗаписей', group: 'reference' },
        { canonical: 'SequenceRecordSet', display: 'ПоследовательностьНаборЗаписей', group: 'reference' },
        { canonical: 'RecalculationRecordSet', display: 'ПерерасчетНаборЗаписей', group: 'reference' },
        { canonical: 'ReportManager', display: 'ОтчетМенеджер', group: 'reference' },
        { canonical: 'DataProcessorManager', display: 'ОбработкаМенеджер', group: 'reference' },
      ],
    };
  }

  private getConfigurationTypes(sourceXmlPath: string | undefined): TypeRegistryTreeGroup[] {
    const configXml = resolveConfigurationXml(sourceXmlPath);
    if (!configXml || !fs.existsSync(configXml)) {
      return [];
    }
    try {
      const cfg = parseConfigXml(configXml);
      const groups: TypeRegistryTreeGroup[] = [];
      const mapped: Array<{ key: string; prefix: string; display: string }> = [
        { key: 'Catalog', prefix: 'CatalogRef.', display: 'СправочникСсылка.' },
        { key: 'Document', prefix: 'DocumentRef.', display: 'ДокументСсылка.' },
        { key: 'Enum', prefix: 'EnumRef.', display: 'ПеречислениеСсылка.' },
        { key: 'ChartOfAccounts', prefix: 'ChartOfAccountsRef.', display: 'ПланСчетовСсылка.' },
        { key: 'ChartOfCharacteristicTypes', prefix: 'ChartOfCharacteristicTypesRef.', display: 'ПланВидовХарактеристикСсылка.' },
        { key: 'ChartOfCalculationTypes', prefix: 'ChartOfCalculationTypesRef.', display: 'ПланВидовРасчетаСсылка.' },
        { key: 'ExchangePlan', prefix: 'ExchangePlanRef.', display: 'ПланОбменаСсылка.' },
        { key: 'BusinessProcess', prefix: 'BusinessProcessRef.', display: 'БизнесПроцессСсылка.' },
        { key: 'Task', prefix: 'TaskRef.', display: 'ЗадачаСсылка.' },
        { key: 'DefinedType', prefix: 'DefinedType.', display: 'ОпределяемыйТип.' },
      ];
      for (const entry of mapped) {
        const names = cfg.childObjects.get(entry.key) ?? [];
        if (names.length === 0) {
          continue;
        }
        groups.push({
          id: entry.key,
          title: entry.key,
          items: names.map((name) => ({
            canonical: `${entry.prefix}${name}`,
            display: `${entry.display}${name}`,
            group: entry.key === 'DefinedType' ? 'defined' : 'reference',
          })),
        });
      }
      return groups;
    } catch {
      return [];
    }
  }
}

function resolveConfigurationXml(sourceXmlPath: string | undefined): string | null {
  if (!sourceXmlPath) {
    return null;
  }
  let current = path.dirname(sourceXmlPath);
  while (true) {
    const cfg = path.join(current, 'Configuration.xml');
    if (fs.existsSync(cfg)) {
      return cfg;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
