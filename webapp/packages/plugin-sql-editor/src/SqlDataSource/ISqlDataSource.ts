/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import type { ILoadableState } from '@cloudbeaver/core-blocks';
import type { IConnectionExecutionContextInfo } from '@cloudbeaver/core-connections';
import type { ISyncExecutor } from '@cloudbeaver/core-executor';

import type { ESqlDataSourceFeatures } from './ESqlDataSourceFeatures';

export interface ISqlDataSource extends ILoadableState {
  readonly name: string | null;
  readonly script: string;
  readonly executionContext?: IConnectionExecutionContextInfo;
  readonly message?: string;
  readonly onSetScript: ISyncExecutor<string>;
  readonly features: ESqlDataSourceFeatures[];

  isReadonly(): boolean;
  isOutdated(): boolean;
  markOutdated(): void;
  markUpdated(): void;
  canRename(name: string | null): boolean;
  setName(name: string | null): void;
  setScript(script: string): void;
  setExecutionContext(executionContext?: IConnectionExecutionContextInfo): void;
  load(): Promise<void> | void;
  dispose(): Promise<void> | void;
}