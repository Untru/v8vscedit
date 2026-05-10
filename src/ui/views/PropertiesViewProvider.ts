import * as vscode from 'vscode';
import type { MetadataNode } from '../tree/TreeNode';
import { getHandlerForNode } from '../tree/nodeBuilders/index';
import type { RepositoryService } from '../../infra/repository/RepositoryService';
import type { SupportInfoService } from '../../infra/support/SupportInfoService';
import type { ExchangePlanContentService } from '../../infra/xml/ExchangePlanContentService';
import type { SubsystemXmlService } from '../../infra/xml/SubsystemXmlService';
import { PropertiesViewController } from './properties/PropertiesViewController';
import { PropertyViewRegistry } from './properties/rendering/PropertyViewRegistry';
import {
  renderNoPropertiesState,
  renderPropertiesHtmlDocument,
} from './properties/rendering/PropertiesWebviewHtml';

/** Управляет вкладкой свойств объекта метаданных (singleton WebviewPanel) */
export class PropertiesViewProvider implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private activeNode: MetadataNode | undefined;
  private readonly controller: PropertiesViewController;
  private readonly viewRegistry = new PropertyViewRegistry();

  constructor(
    subsystemXmlService: SubsystemXmlService,
    exchangePlanContentService: ExchangePlanContentService,
    supportService?: SupportInfoService,
    repositoryService?: RepositoryService,
    /** Вызывается сразу после успешного переименования до срабатывания файлового watcher'а */
    onAfterRename?: (configRoot: string, oldXmlPath: string, newXmlPath: string) => void,
    onAfterSubsystemMembershipSave?: () => void
  ) {
    this.controller = new PropertiesViewController(
      subsystemXmlService,
      exchangePlanContentService,
      {
        refreshActiveView: () => this.refreshActiveView(),
        replaceActiveNode: (node) => {
          this.activeNode = node;
          if (this.panel) {
            this.panel.title = this.buildTitle(node);
          }
        },
      },
      supportService,
      repositoryService,
      onAfterRename,
      onAfterSubsystemMembershipSave
    );
  }

  /**
   * Открывает вкладку свойств для узла.
   * Если вкладка уже открыта — заменяет содержимое и переключается на неё,
   * новую группу редактора не создаёт.
   */
  show(node: MetadataNode): void {
    this.activeNode = node;
    this.controller.setActiveNode(node);
    if (this.panel) {
      this.panel.title = this.buildTitle(node);
      this.panel.webview.html = this.renderHtml(node);
      this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Active, false);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        '1cPropertiesView',
        this.buildTitle(node),
        { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.webview.html = this.renderHtml(node);
      this.panel.webview.onDidReceiveMessage((msg) => this.controller.handleWebviewMessage(msg));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.activeNode = undefined;
        this.controller.clearActiveNode();
      });
    }
  }

  dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    this.controller.clearActiveNode();
  }

  /** Формирует заголовок вкладки */
  private buildTitle(node: MetadataNode): string {
    return `${node.textLabel} — Свойства`;
  }

  /** Формирует HTML страницы */
  private renderHtml(node: MetadataNode): string {
    return renderPropertiesHtmlDocument(this.renderBody(node));
  }

  /** Формирует содержимое страницы */
  private renderBody(node: MetadataNode): string {
    const handler = getHandlerForNode(node);
    const canShowProperties = handler?.canShowProperties?.(node) ?? false;

    if (!handler?.getProperties || !canShowProperties) {
      return renderNoPropertiesState(node);
    }

    const renderContext = this.controller.buildRenderContext(node, handler.getProperties(node));
    if (
      renderContext.properties.length === 0 &&
      !renderContext.subsystemSnapshot &&
      !renderContext.exchangePlanContentSnapshot
    ) {
      return renderNoPropertiesState(node);
    }

    return this.viewRegistry.render(renderContext);
  }

  private refreshActiveView(): void {
    if (!this.panel || !this.activeNode) {
      return;
    }
    this.panel.webview.html = this.renderHtml(this.activeNode);
  }
}
