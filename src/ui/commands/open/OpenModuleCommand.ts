import * as vscode from 'vscode';
import {
  getCommonCommandModulePath,
  getCommonFormModulePath,
  getCommandModulePathForChild,
  getCommonModuleCodePath,
  getConstantModulePath,
  getFormModulePathForChild,
  getManagerModulePath,
  getObjectModulePath,
  getServiceModulePath,
} from '../../../infra/fs/MetaPathResolver';
import { MetadataNode } from '../../tree/TreeNode';
import { CommandServices, NodeArg } from '../_shared';
import { setEditorReadonly } from './OpenXmlCommand';

/** Регистрирует команды открытия BSL-модулей для всех слотов. */
export function registerOpenModuleCommands(
  context: vscode.ExtensionContext,
  services: CommandServices
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('v8vscedit.openCommonModuleCode', async (node: NodeArg) => {
      const modulePath = getCommonModuleCodePath(toNodePathInfo(node));
      if (!modulePath) {
        void vscode.window.showWarningMessage('Файл модуля общего модуля не найден в выгрузке.');
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    }),

    vscode.commands.registerCommand('v8vscedit.openObjectModule', async (node: NodeArg) => {
      const modulePath = getObjectModulePath(toNodePathInfo(node));
      if (!modulePath) {
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    }),

    vscode.commands.registerCommand('v8vscedit.openManagerModule', async (node: NodeArg) => {
      const modulePath = getManagerModulePath(toNodePathInfo(node));
      if (!modulePath) {
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    }),

    vscode.commands.registerCommand('v8vscedit.openConstantModule', async (node: NodeArg) => {
      const modulePath = getConstantModulePath(toNodePathInfo(node));
      if (!modulePath) {
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    }),

    vscode.commands.registerCommand('v8vscedit.openServiceModule', async (node: NodeArg) => {
      const modulePath = getServiceModulePath(toNodePathInfo(node));
      if (!modulePath) {
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    }),

    vscode.commands.registerCommand('v8vscedit.openFormModule', async (node: NodeArg) => {
      const isCommonForm = node.nodeKind === 'CommonForm';
      const modulePath = isCommonForm
        ? getCommonFormModulePath(toNodePathInfo(node))
        : getFormModulePathForChild(toNodePathInfo(node));
      if (!modulePath) {
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    }),

    vscode.commands.registerCommand('v8vscedit.openCommandModule', async (node: NodeArg) => {
      const isCommonCommand = node.nodeKind === 'CommonCommand';
      const modulePath = isCommonCommand
        ? getCommonCommandModulePath(toNodePathInfo(node))
        : getCommandModulePathForChild(toNodePathInfo(node));
      if (!modulePath) {
        return;
      }

      const xmlPath = node.xmlPath;
      await openModule(services, modulePath, xmlPath);
    })
  );
}

async function openModule(
  services: CommandServices,
  modulePath: string,
  ownerXmlPath: string | undefined,
  preview = true
): Promise<void> {
  const supportLocked = ownerXmlPath ? services.supportService?.isLocked(ownerXmlPath) ?? false : false;
  const repositoryLocked = services.repositoryService.isEditRestricted(ownerXmlPath ?? modulePath);
  const locked = supportLocked || repositoryLocked;
  const editor = await vscode.window.showTextDocument(vscode.Uri.file(modulePath), { preview });

  if (locked) {
    await setEditorReadonly(editor);
  }
}

function toNodePathInfo(node: NodeArg): { xmlPath?: string; kind?: string; label?: string } {
  if (node instanceof MetadataNode) {
    return {
      xmlPath: node.xmlPath,
      kind: node.nodeKind,
      label: node.textLabel,
    };
  }

  return {
    xmlPath: node.xmlPath,
    kind: node.nodeKind,
    label: typeof node.label === 'string' ? node.label : undefined,
  };
}
