/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { untracked } from 'mobx';

import { UserInfoResource } from '@cloudbeaver/core-authentication';
import { CONNECTION_FOLDER_NAME_VALIDATION } from '@cloudbeaver/core-connections';
import { Bootstrap, injectable } from '@cloudbeaver/core-di';
import { DialogueStateResult, CommonDialogService } from '@cloudbeaver/core-dialogs';
import { NotificationService } from '@cloudbeaver/core-events';
import type { IExecutionContextProvider } from '@cloudbeaver/core-executor';
import { LocalizationService } from '@cloudbeaver/core-localization';
import { NavTreeResource, NavNodeManagerService, NavNodeInfoResource, type INodeMoveData, navNodeMoveContext, getNodesFromContext, ENodeMoveType, type NavNode } from '@cloudbeaver/core-navigation-tree';
import { ProjectInfoResource, ProjectsService } from '@cloudbeaver/core-projects';
import { CachedMapAllKey, ResourceKey, resourceKeyList, ResourceKeyUtils } from '@cloudbeaver/core-sdk';
import { createPath } from '@cloudbeaver/core-utils';
import { ActionService, MenuService, ACTION_NEW_FOLDER, DATA_CONTEXT_MENU, IAction, IDataContextProvider } from '@cloudbeaver/core-view';
import { DATA_CONTEXT_ELEMENTS_TREE, MENU_ELEMENTS_TREE_TOOLS, type IElementsTree } from '@cloudbeaver/plugin-navigation-tree';
import { FolderDialog } from '@cloudbeaver/plugin-projects';

import { NAV_NODE_TYPE_RM_PROJECT } from '../NAV_NODE_TYPE_RM_PROJECT';
import { NavResourceNodeService } from '../NavResourceNodeService';
import { ResourceManagerResource } from '../ResourceManagerResource';
import { ResourceProjectsResource } from '../ResourceProjectsResource';
import { RESOURCES_NODE_PATH } from '../RESOURCES_NODE_PATH';
import { NAV_NODE_TYPE_RM_RESOURCE } from './NAV_NODE_TYPE_RM_RESOURCE';
import { ResourcesProjectsNavNodeService } from './ResourcesProjectsNavNodeService';

interface ITargetNode {
  projectId: string;
  folderId?: string;

  projectNodeId: string;
  selectProject: boolean;
}

@injectable()
export class ResourceFoldersBootstrap extends Bootstrap {

  constructor(
    private readonly localizationService: LocalizationService,
    private readonly navTreeResource: NavTreeResource,
    private readonly notificationService: NotificationService,
    private readonly userInfoResource: UserInfoResource,
    private readonly navNodeManagerService: NavNodeManagerService,
    private readonly navResourceNodeService: NavResourceNodeService,
    private readonly resourceManagerResource: ResourceManagerResource,
    private readonly resourceProjectsResource: ResourceProjectsResource,
    private readonly projectsService: ProjectsService,
    private readonly projectInfoResource: ProjectInfoResource,
    private readonly commonDialogService: CommonDialogService,
    private readonly actionService: ActionService,
    private readonly menuService: MenuService,
    private readonly navNodeInfoResource: NavNodeInfoResource,
    private readonly resourcesProjectsNavNodeService: ResourcesProjectsNavNodeService
  ) {
    super();
  }

  register(): void | Promise<void> {
    this.navNodeInfoResource.onItemAdd.addHandler(this.syncWithNavTree.bind(this));
    this.navNodeInfoResource.onItemDelete.addHandler(this.syncWithNavTree.bind(this));
    this.navNodeManagerService.onMove.addHandler(this.moveConnectionToFolder.bind(this));

    this.actionService.addHandler({
      id: 'tree-tools-menu-resource-folders-handler',
      isActionApplicable: (context, action) => {
        const tree = context.tryGet(DATA_CONTEXT_ELEMENTS_TREE);

        if (
          ![ACTION_NEW_FOLDER].includes(action)
          || !tree?.baseRoot.startsWith(RESOURCES_NODE_PATH)
          || !this.userInfoResource.data
        ) {
          return false;
        }

        const targetNode = this.getTargetNode(tree);

        return targetNode !== undefined;
      },
      isDisabled: (context, action) => {
        const tree = context.tryGet(DATA_CONTEXT_ELEMENTS_TREE);

        if (!tree) {
          return true;
        }

        untracked(async () => await this.resourceProjectsResource.load());
        return this.getTargetNode(tree) === undefined;
      },
      handler: this.elementsTreeActionHandler.bind(this),
    });

    this.menuService.addCreator({
      isApplicable: context => context.get(DATA_CONTEXT_MENU) === MENU_ELEMENTS_TREE_TOOLS,
      getItems: (context, items) => {
        if (!items.includes(ACTION_NEW_FOLDER)) {
          return [
            ...items,
            ACTION_NEW_FOLDER,
          ];
        }

        return items;
      },
    });
  }
  load(): void | Promise<void> { }


  private async moveConnectionToFolder(
    {
      type,
      targetNode,
      moveContexts,
    }: INodeMoveData,
    contexts: IExecutionContextProvider<INodeMoveData>
  ) {
    const move = contexts.getContext(navNodeMoveContext);
    const nodes = getNodesFromContext(moveContexts);
    const nodeIdList = nodes.map(node => node.id);
    const children = this.navTreeResource.get(targetNode.id) ?? [];
    const targetProject = this.resourcesProjectsNavNodeService.getProject(targetNode.id);

    if (!targetProject?.canEditResources || (!targetNode.folder && targetNode.nodeType !== NAV_NODE_TYPE_RM_PROJECT)) {
      return;
    }

    const supported = nodes.every(node => {
      if (
        ![NAV_NODE_TYPE_RM_PROJECT, NAV_NODE_TYPE_RM_RESOURCE].includes(node.nodeType!)
        || targetProject !== this.resourcesProjectsNavNodeService.getProject(node.id)
        || children.includes(node.id)
        || targetNode.id === node.id
      ) {
        return false;
      }

      return true;
    });

    if (!supported) {
      return;
    }

    if (type === ENodeMoveType.CanDrop && targetNode.nodeType) {
      move.setCanMove(true);
    } else {
      try {
        await this.navTreeResource.moveTo(resourceKeyList(nodeIdList), targetNode.id);
        await this.navTreeResource.refreshTree(RESOURCES_NODE_PATH, true);
      } catch (exception: any) {
        this.notificationService.logException(exception, 'plugin_resource_manager_folder_move_failed');
      }
    }
  }


  private async elementsTreeActionHandler(contexts: IDataContextProvider, action: IAction) {
    const tree = contexts.get(DATA_CONTEXT_ELEMENTS_TREE);

    if (tree === undefined) {
      return;
    }
    await this.resourceProjectsResource.load();

    switch (action) {
      case ACTION_NEW_FOLDER: {
        const targetNode = this.getTargetNode(tree);

        if (!targetNode) {
          return;
        }

        let parentFolder: string | undefined;

        if (targetNode.folderId) {
          const folderData = this.navResourceNodeService.getResourceData(targetNode.folderId);

          if (folderData) {
            parentFolder = folderData.resourcePath;
          }
        }

        await this.resourceManagerResource.load({ projectId: targetNode.projectId, folder: parentFolder });

        const result = await this.commonDialogService.open(FolderDialog, {
          value: this.localizationService.translate('ui_folder_new'),
          projectId: targetNode.projectId,
          title: 'core_view_action_new_folder',
          subTitle: parentFolder,
          icon: '/icons/folder.svg#root',
          create: true,
          selectProject: targetNode.selectProject,
          validation: async ({ folder, projectId }, setMessage) => {
            const trimmed = folder.trim();

            if (trimmed.length === 0 || !folder.match(CONNECTION_FOLDER_NAME_VALIDATION)) {
              setMessage('connections_connection_folder_validation');
              return false;
            }

            await this.resourceManagerResource.load({ projectId: projectId, folder: parentFolder });

            return !this.resourceManagerResource.hasResource({ projectId: projectId, folder: parentFolder }, trimmed);
          },
        });

        if (result !== DialogueStateResult.Rejected && result !== DialogueStateResult.Resolved) {
          try {
            await this.resourceManagerResource.createResource(
              result.projectId,
              createPath(parentFolder, result.folder),
              true
            );

            this.navTreeResource.refreshTree(this.resourcesProjectsNavNodeService.getProjectNodeId(result.projectId));
          } catch (exception: any) {
            this.notificationService.logException(exception, 'Error occurred while renaming');
          }
        }

        break;
      }
    }
  }

  private async syncWithNavTree(key: ResourceKey<string>) {
    const isFolder = ResourceKeyUtils.some(
      key,
      nodeId => this.navResourceNodeService.getResourceData(nodeId) !== undefined
    );

    if (isFolder) {
      this.resourceManagerResource.markOutdated();
    }
  }

  private getTargetNode(tree: IElementsTree): ITargetNode | undefined {
    untracked(() => this.projectInfoResource.load(CachedMapAllKey));
    const selected = tree.getSelected();

    if (selected.length === 0) {
      const editableProjects = this.projectsService.activeProjects.filter(project => project.canEditResources);

      if (editableProjects.length > 0) {
        const project = editableProjects[0];

        return {
          projectId: project.id,
          projectNodeId: this.resourcesProjectsNavNodeService.getProjectNodeId(project.id),
          selectProject: editableProjects.length > 1,
        };
      }
      return;
    }

    const targetFolder = selected[0];
    const parentIds = [...this.navNodeInfoResource.getParents(targetFolder), targetFolder];
    const parents = this.navNodeInfoResource.get(resourceKeyList(parentIds));
    const projectNode = parents.find(parent => parent?.nodeType === NAV_NODE_TYPE_RM_PROJECT);

    if (!projectNode) {
      return;
    }


    const project = this.resourcesProjectsNavNodeService.getByNodeId(projectNode.id);

    if (!project?.canEditResources) {
      return;
    }

    const targetFolderNode = parents
      .slice()
      .reverse()
      .find(parent => parent?.nodeType === NAV_NODE_TYPE_RM_RESOURCE && parent.folder);

    return {
      projectId: project.id,
      folderId: targetFolderNode?.id,
      projectNodeId: projectNode.id,
      selectProject: false,
    };
  }
}