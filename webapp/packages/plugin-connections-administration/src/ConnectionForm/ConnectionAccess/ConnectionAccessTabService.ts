/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { AdministrationScreenService, EAdminPermission } from '@cloudbeaver/core-administration';
import { ConnectionInfoResource, createConnectionParam, IConnectionInfoParams } from '@cloudbeaver/core-connections';
import { Bootstrap, injectable } from '@cloudbeaver/core-di';
import type { IExecutionContextProvider } from '@cloudbeaver/core-executor';
import { PROJECT_GLOBAL_ID } from '@cloudbeaver/core-projects';
import { PermissionsService } from '@cloudbeaver/core-root';
import type { MetadataValueGetter } from '@cloudbeaver/core-utils';
import { connectionConfigContext, ConnectionFormService, connectionFormStateContext, IConnectionFormProps, IConnectionFormState, IConnectionFormSubmitData } from '@cloudbeaver/plugin-connections';

import { ConnectionAccess } from './ConnectionAccess';
import type { IConnectionAccessTabState } from './IConnectionAccessTabState';

@injectable()
export class ConnectionAccessTabService extends Bootstrap {
  private readonly key: string;

  constructor(
    private readonly connectionFormService: ConnectionFormService,
    private readonly administrationScreenService: AdministrationScreenService,
    private readonly connectionInfoResource: ConnectionInfoResource,
    private readonly permissionsResource: PermissionsService
  ) {
    super();
    this.key = 'access';
  }

  register(): void {
    this.connectionFormService.tabsContainer.add({
      key: this.key,
      name: 'connections_connection_edit_access',
      title: 'connections_connection_edit_access',
      order: 4,
      stateGetter: context => this.stateGetter(context),
      isHidden: (_, context) => context?.state.projectId !== PROJECT_GLOBAL_ID
        || !this.permissionsResource.has(EAdminPermission.admin),
      isDisabled: (tabId, props) => !props?.state.config.driverId
        || this.administrationScreenService.isConfigurationMode,
      panel: () => ConnectionAccess,
    });

    this.connectionFormService.formSubmittingTask
      .addHandler(this.save.bind(this));

    this.connectionFormService.formStateTask
      .addHandler(this.formState.bind(this));
  }

  load(): void { }

  private stateGetter(context: IConnectionFormProps): MetadataValueGetter<string, IConnectionAccessTabState> {
    return () => ({
      loading: false,
      loaded: false,
      editing: false,
      grantedSubjects: [],
      initialGrantedSubjects: [],
    });
  }

  private async save(
    data: IConnectionFormSubmitData,
    contexts: IExecutionContextProvider<IConnectionFormSubmitData>
  ) {
    if (
      data.submitType === 'test'
      || data.state.projectId !== PROJECT_GLOBAL_ID // TODO: must be controlled by user's project access rights
      || !this.permissionsResource.has(EAdminPermission.admin)
    ) {
      return;
    }
    const status = contexts.getContext(this.connectionFormService.connectionStatusContext);

    if (!status.saved) {
      return;
    }

    const config = contexts.getContext(connectionConfigContext);
    const state = this.connectionFormService.tabsContainer.getTabState<IConnectionAccessTabState>(
      data.state.partsState,
      this.key,
      { state: data.state }
    );

    if (!config.connectionId || !state.loaded) {
      return;
    }

    const key = createConnectionParam(data.state.projectId, config.connectionId);

    const changed = await this.isChanged(key, state.grantedSubjects);

    if (changed) {
      await this.connectionInfoResource.setAccessSubjects(
        key,
        state.grantedSubjects
      );
      state.initialGrantedSubjects = state.grantedSubjects.slice();
    }
  }

  private async formState(
    data: IConnectionFormState,
    contexts: IExecutionContextProvider<IConnectionFormState>
  ) {
    if (data.type === 'public') {
      return;
    }
    const config = contexts.getContext(connectionConfigContext);
    const state = this.connectionFormService.tabsContainer.getTabState<IConnectionAccessTabState>(
      data.partsState,
      this.key,
      { state: data }
    );

    if (!config.connectionId || !data.projectId) {
      return;
    }

    const key = createConnectionParam(data.projectId, config.connectionId);
    const changed = await this.isChanged(key, state.grantedSubjects);

    if (changed) {
      const stateContext = contexts.getContext(connectionFormStateContext);

      stateContext.markEdited();
    }
  }

  private async isChanged(connectionKey: IConnectionInfoParams, next: string[]): Promise<boolean> {
    const current = await this.connectionInfoResource.loadAccessSubjects(connectionKey);
    if (current.length !== next.length) {
      return true;
    }

    return current.some(value => !next.some(subjectId => subjectId === value.subjectId));
  }
}
