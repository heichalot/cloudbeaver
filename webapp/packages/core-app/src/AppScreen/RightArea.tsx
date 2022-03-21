/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import styled, { css } from 'reshadow';

import {
  Pane,
  ResizerControls,
  SlideBox,
  SlideElement,
  slideBoxStyles,
  Split,
  splitHorizontalStyles,
  splitStyles,
  SlideOverlay,
  ErrorBoundary
} from '@cloudbeaver/core-blocks';
import { useService } from '@cloudbeaver/core-di';
import { useStyles } from '@cloudbeaver/core-theming';
import { OptionsPanelService } from '@cloudbeaver/core-ui';

import { NavigationTabsBar } from '../shared/NavigationTabs/NavigationTabsBar';
import { ToolsPanel } from '../shared/ToolsPanel/ToolsPanel';
import { ToolsPanelService } from '../shared/ToolsPanel/ToolsPanelService';

const styles = css`
    Pane {
      composes: theme-background-surface theme-text-on-surface from global;
      flex: 1;
      display: flex;
      overflow: auto;
    }
    Pane:last-child {
      flex: 0 0 30%;
    }
    SlideBox {
      flex: 1;
    }
  `;

export const RightArea = observer(function RightArea() {
  const toolsPanelService = useService(ToolsPanelService);
  const optionsPanelService = useService(OptionsPanelService);
  const OptionsPanel = optionsPanelService.getPanelComponent();

  const activeTools = toolsPanelService.tabsContainer.getDisplayed();

  return styled(useStyles(styles, splitStyles, splitHorizontalStyles, slideBoxStyles))(
    <SlideBox open={optionsPanelService.active}>
      <SlideElement>
        <ErrorBoundary remount><OptionsPanel /></ErrorBoundary>
      </SlideElement>
      <SlideElement>
        <Split sticky={30} split="horizontal" mode={activeTools.length ? undefined : 'minimize'} keepRatio>
          <Pane>
            <ErrorBoundary remount>
              <NavigationTabsBar />
            </ErrorBoundary>
          </Pane>
          {!!activeTools.length && <ResizerControls />}
          <Pane main>
            <ErrorBoundary remount>
              <ToolsPanel container={toolsPanelService.tabsContainer} />
            </ErrorBoundary>
          </Pane>
        </Split>
        <SlideOverlay onClick={() => optionsPanelService.close()} />
      </SlideElement>
    </SlideBox>
  );
});
