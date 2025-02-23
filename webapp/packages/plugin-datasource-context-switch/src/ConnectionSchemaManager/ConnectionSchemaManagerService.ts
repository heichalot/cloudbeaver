/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { computed, observable, makeObservable, action, runInAction } from 'mobx';

import { ConnectionInfoResource, ConnectionsManagerService, ObjectContainer, DBDriverResource, isConnectionProvider, IConnectionProvider, isConnectionSetter, IConnectionSetter, IStructContainers, Connection, IConnectionInfoParams, serializeConnectionParam, IObjectCatalogProvider, IObjectCatalogSetter, IObjectSchemaProvider, IObjectSchemaSetter, isObjectCatalogProvider, isObjectCatalogSetter, isObjectSchemaProvider, isObjectSchemaSetter } from '@cloudbeaver/core-connections';
import { injectable } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';
import { ExtensionUtils, IExtension } from '@cloudbeaver/core-extensions';
import { type IObjectNavNodeProvider, type IDataContextActiveNode, isObjectNavNodeProvider } from '@cloudbeaver/core-navigation-tree';
import { ITab, NavigationTabsService } from '@cloudbeaver/plugin-navigation-tabs';


export interface IConnectionInfo {
  name?: string;
  driverIcon?: string;
}

interface IActiveItem<T> {
  id: string;
  context: T;
  getCurrentNavNode?: IObjectNavNodeProvider<T>;
  getCurrentConnectionId?: IConnectionProvider<T>;
  getCurrentSchemaId?: IObjectSchemaProvider<T>;
  getCurrentCatalogId?: IObjectCatalogProvider<T>;
  changeConnectionId?: IConnectionSetter<T>;
  changeCatalogId?: IObjectCatalogSetter<T>;
  changeSchemaId?: IObjectSchemaSetter<T>;
}

@injectable()
export class ConnectionSchemaManagerService {
  get activeNavNode(): IDataContextActiveNode | null | undefined {

    if (!this.activeItem?.getCurrentNavNode) {
      return null;
    }

    return this.activeItem.getCurrentNavNode(this.activeItem.context);
  }

  get activeConnectionKey(): IConnectionInfoParams | null | undefined {

    if (!this.activeItem?.getCurrentConnectionId) {
      return null;
    }

    return this.activeItem.getCurrentConnectionId(this.activeItem.context);
  }

  get currentConnectionKey(): IConnectionInfoParams | null | undefined {
    if (this.pendingConnectionKey !== null) {
      return this.pendingConnectionKey;
    }

    return this.activeConnectionKey;
  }

  get activeObjectCatalogId(): string | undefined {
    if (!this.activeItem?.getCurrentCatalogId) {
      return;
    }

    return this.activeItem.getCurrentCatalogId(this.activeItem.context);
  }

  get currentObjectCatalogId(): string | undefined {
    if (this.pendingCatalogId !== null) {
      return this.pendingCatalogId;
    }
    return this.activeObjectCatalogId;
  }

  get currentObjectSchemaId(): string | undefined {
    if (this.pendingSchemaId !== null) {
      return this.pendingSchemaId;
    }

    if (!this.activeItem?.getCurrentSchemaId) {
      return;
    }

    return this.activeItem.getCurrentSchemaId(this.activeItem.context);
  }

  get currentConnection(): Connection | undefined {
    if (!this.currentConnectionKey) {
      return;
    }

    return this.connectionInfo.get(this.currentConnectionKey);
  }

  get currentObjectCatalog(): ObjectContainer | undefined {
    if (!this.currentConnectionKey || !this.currentObjectCatalogId) {
      return;
    }

    return this.connectionsManagerService.getObjectContainerById(
      this.currentConnectionKey,
      this.currentObjectCatalogId
    );
  }

  get currentObjectSchema(): ObjectContainer | undefined {
    if (!this.currentConnectionKey || !this.currentObjectSchemaId) {
      return;
    }

    return this.connectionsManagerService.getObjectContainerById(
      this.currentConnectionKey,
      this.currentObjectCatalogId,
      this.currentObjectSchemaId
    );
  }

  get objectContainerList(): IStructContainers | undefined {
    if (!this.currentConnectionKey) {
      return;
    }

    return this.connectionsManagerService.containerContainers.get({
      ...this.currentConnectionKey,
      catalogId: this.currentObjectCatalogId,
    });
  }

  get isConnectionChangeable(): boolean {
    return !!this.activeItem?.changeConnectionId;
  }

  get isObjectCatalogChangeable(): boolean {
    return (
      !!this.activeItem?.changeCatalogId
      && !!this.objectContainerList?.supportsCatalogChange
    );
  }

  get isObjectSchemaChangeable(): boolean {
    return (
      !!this.activeItem?.changeSchemaId
      && !!this.objectContainerList?.supportsSchemaChange
    );
  }

  get isChangingConnection(): boolean {
    return this.changingConnection;
  }

  get isChangingConnectionContainer(): boolean {
    return this.changingConnectionContainer;
  }

  get activeItem(): IActiveItem<any> | null {
    const tab = this.navigationTabsService.currentTab;

    if (!tab) {
      return null;
    }

    const item: IActiveItem<ITab> = {
      id: tab.id,
      context: tab,
    };

    const handler = this.navigationTabsService.getTabHandler(tab.handlerId);

    if (handler?.extensions) {
      this.setExtensions(item, handler.extensions);
    }

    return item;
  }

  private pendingConnectionKey: IConnectionInfoParams | null;
  private pendingCatalogId: string | null | undefined;
  private pendingSchemaId: string | null | undefined;
  private changingConnection: boolean;
  private changingConnectionContainer: boolean;

  constructor(
    private readonly navigationTabsService: NavigationTabsService,
    private readonly connectionInfo: ConnectionInfoResource,
    private readonly connectionsManagerService: ConnectionsManagerService,
    private readonly dbDriverResource: DBDriverResource,
    private readonly notificationService: NotificationService
  ) {
    this.changingConnection = false;
    this.changingConnectionContainer = false;
    this.pendingConnectionKey = null;
    this.pendingCatalogId = null;
    this.pendingSchemaId = null;

    makeObservable<
    ConnectionSchemaManagerService,
    'activeItem'
    | 'changingConnection'
    | 'changingConnectionContainer'
    | 'pendingConnectionKey'
    | 'pendingCatalogId'
    | 'pendingSchemaId'
    | 'setExtensions'
    >(this, {
      currentObjectCatalog: computed,
      currentObjectSchema: computed,
      objectContainerList: computed,
      currentConnectionKey: computed,
      activeConnectionKey: computed,
      currentObjectCatalogId: computed,
      activeObjectCatalogId: computed,
      currentObjectSchemaId: computed,
      isConnectionChangeable: computed,
      isObjectCatalogChangeable: computed,
      isObjectSchemaChangeable: computed,
      activeItem: computed,
      changingConnection: observable,
      changingConnectionContainer: observable,
      pendingConnectionKey: observable,
      pendingCatalogId: observable,
      pendingSchemaId: observable,
      setExtensions: action,
    });
  }

  /**
   * Trigger when user select connection in dropdown
   */
  async selectConnection(connectionKey: IConnectionInfoParams): Promise<void> {
    if (!this.activeItem?.changeConnectionId) {
      return;
    }
    try {
      runInAction(() => {
        this.changingConnection = true;
        this.pendingConnectionKey = connectionKey;
        this.pendingSchemaId = undefined;
        this.pendingCatalogId = undefined;
      });
      await this.activeItem.changeConnectionId(connectionKey, this.activeItem.context);
      await this.updateContainer(connectionKey);
    } finally {
      runInAction(() => {
        this.changingConnection = false;
        this.pendingConnectionKey = null;
        this.pendingSchemaId = null;
        this.pendingCatalogId = null;
      });
    }
  }

  async onConnectionUpdate(): Promise<void> {
    await this.updateContainer(this.currentConnectionKey);
  }

  /**
   * Trigger when user select catalog in dropdown
   */
  async selectCatalog(catalogId: string, resetSchemaId = true): Promise<void> {
    if (!this.activeItem?.changeCatalogId) {
      throw new Error('The try to change catalog without connection');
    }

    try {

      runInAction(() => {
        this.changingConnectionContainer = true;
        this.pendingCatalogId = catalogId;

        if (resetSchemaId) {
          this.pendingSchemaId = undefined;
        }
      });

      await this.activeItem.changeCatalogId(catalogId, this.activeItem.context);
      await this.updateContainer(this.currentConnectionKey, catalogId);
    } finally {
      runInAction(() => {
        if (resetSchemaId) {
          this.pendingSchemaId = null;
        }
        this.pendingCatalogId = null;
        this.changingConnectionContainer = false;
      });
    }
  }

  /**
   * Trigger when user select schema in dropdown
   */
  async selectSchema(schemaId: string, catalogId?: string): Promise<void> {
    if (!this.activeItem?.changeSchemaId) {
      throw new Error('The try to change schema without connection');
    }

    try {
      runInAction(() => {
        this.changingConnectionContainer = true;
        this.pendingSchemaId = schemaId;
      });

      if (catalogId) {
        await this.selectCatalog(catalogId, false);
      }

      await this.activeItem.changeSchemaId(schemaId, this.activeItem.context);
    } finally {
      runInAction(() => {
        this.pendingSchemaId = null;
        this.changingConnectionContainer = false;
      });
    }
  }

  async updateContainer(key?: IConnectionInfoParams | null, catalogId?: string): Promise<void> {
    if (!key) {
      key = this.currentConnectionKey;
    }

    if (!catalogId) {
      catalogId = this.currentObjectCatalogId;
    }

    if (!key) {
      return;
    }

    const connection = this.connectionInfo.get(key);

    if (!connection) {
      console.warn(`Connection Schema Manager: connection (${serializeConnectionParam(key)}) not exists`);
      return;
    }

    try {
      await this.dbDriverResource.loadAll();
    } catch (exception: any) {
      this.notificationService.logException(exception, 'Can\'t load database drivers', '', true);
    }

    if (!connection.connected) {
      return;
    }

    try {
      await this.connectionsManagerService.loadObjectContainer(key, catalogId);
    } catch (exception: any) {
      this.notificationService.logException(
        exception,
        `Can't load objectContainers for ${serializeConnectionParam(key)}@${catalogId}`,
        '',
        true
      );
    }
  }

  private setExtensions<T>(item: IActiveItem<T>, extensions: Array<IExtension<T>>) {
    ExtensionUtils.from(extensions)
      .on(isObjectNavNodeProvider, extension => { item.getCurrentNavNode = extension; })
      .on(isConnectionProvider, extension => { item.getCurrentConnectionId = extension; })
      .on(isObjectCatalogProvider, extension => { item.getCurrentCatalogId = extension; })
      .on(isObjectSchemaProvider, extension => { item.getCurrentSchemaId = extension; })

      .on(isConnectionSetter, extension => { item.changeConnectionId = extension; })
      .on(isObjectCatalogSetter, extension => { item.changeCatalogId = extension; })
      .on(isObjectSchemaSetter, extension => { item.changeSchemaId = extension; });
  }
}
