/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import styled, { css } from 'reshadow';

import { splitStyles, Split, ResizerControls, Pane, ErrorBoundary, useSplitUserState } from '@cloudbeaver/core-blocks';
import { useService } from '@cloudbeaver/core-di';
import { useStyles } from '@cloudbeaver/core-theming';
import { SideBarPanel, SideBarPanelService } from '@cloudbeaver/core-ui';
import { NavigationTree } from '@cloudbeaver/plugin-navigation-tree';

import { RightArea } from './RightArea';

const mainStyles = css`
  space {
    composes: theme-typography--body2 theme-background-primary from global;
  }
  Pane {
    composes: theme-background-surface theme-text-on-surface from global;
    display: flex;
    position: relative;
    overflow: hidden;
  }
`;

export const Main = observer(function Main() {
  const sideBarPanelService = useService(SideBarPanelService);

  const styles = useStyles(mainStyles, splitStyles);
  const splitState = useSplitUserState('main');

  const activeBars = sideBarPanelService.tabsContainer.getDisplayed();

  return styled(styles)(
    <space as="main">
      <Split {...splitState} sticky={30}>
        <Pane main>
          <ErrorBoundary remount>
            <NavigationTree />
          </ErrorBoundary>
        </Pane>
        <ResizerControls />
        <Pane>
          <Split disable={activeBars.length === 0}>
            <Pane>
              <RightArea />
            </Pane>
            <ResizerControls />
            <Pane main>
              <ErrorBoundary remount>
                <SideBarPanel container={sideBarPanelService.tabsContainer} />
              </ErrorBoundary>
            </Pane>
          </Split>
        </Pane>
      </Split>
    </space>
  );
});
