/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { createContext } from 'react';

import type { IPosition } from './useGridSelectionContext';

export interface IDataGridSelectionContext {
  selectedCells: Map<number, number[]>;
  select: (columnKey: string, rowIdx: number, multiple: boolean, range: boolean) => void;
  selectRange: (startPosition: IPosition, lastPosition: IPosition, multiple: boolean, temporary: boolean) => void;
  selectColumn: (columnKey: string, multiple: boolean) => void;
  selectTable: () => void;
  isSelected: (columnKey: string, rowIdx: number) => boolean;
}

export const DataGridSelectionContext = createContext<IDataGridSelectionContext | null>(null);
