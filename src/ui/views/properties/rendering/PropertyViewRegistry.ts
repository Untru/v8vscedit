import { META_TYPES, type MetaKind } from '../../../../domain/MetaTypes';
import type { MetadataNode } from '../../../tree/TreeNode';
import { ConfigurationPropertiesView } from './objectViews/ConfigurationPropertiesView';
import { GenericPropertiesView } from './objectViews/GenericPropertiesView';
import { MetadataObjectPropertiesView } from './objectViews/MetadataObjectPropertiesView';
import type { ObjectPropertiesView, PropertiesRenderContext } from './_types';

/** Выбирает view-реализацию для конкретного объекта панели свойств. */
export class PropertyViewRegistry {
  private readonly fallback = new GenericPropertiesView();
  private readonly views: ObjectPropertiesView[];

  constructor(customViews: ObjectPropertiesView[] = []) {
    const metadataViews = (Object.keys(META_TYPES) as MetaKind[])
      .filter((kind) => kind !== 'configuration' && kind !== 'extension')
      .map((kind) => new MetadataObjectPropertiesView(kind));
    this.views = [
      ...customViews,
      new ConfigurationPropertiesView(),
      ...metadataViews,
    ];
  }

  render(context: PropertiesRenderContext): string {
    return this.resolve(context.node).render(context);
  }

  resolve(node: MetadataNode): ObjectPropertiesView {
    return this.views.find((view) => view.canRender(node)) ?? this.fallback;
  }
}
