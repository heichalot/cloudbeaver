/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import { forwardRef, useRef } from 'react';
import styled from 'reshadow';

import { getComputed, IMenuState, Menu, MenuItemElement, menuPanelStyles, useObjectRef } from '@cloudbeaver/core-blocks';
import { useService } from '@cloudbeaver/core-di';
import { ComponentStyle, useStyles } from '@cloudbeaver/core-theming';
import { DATA_CONTEXT_MENU_NESTED, DATA_CONTEXT_SUBMENU_ITEM, IMenuData, IMenuSubMenuItem, MenuActionItem, MenuService, useMenu } from '@cloudbeaver/core-view';

import type { IMenuItemRendererProps } from './MenuItemRenderer';

interface ISubMenuElementProps extends Omit<React.ButtonHTMLAttributes<any>, 'style'> {
  menuData: IMenuData;
  subMenu: IMenuSubMenuItem;
  itemRenderer: React.FC<IMenuItemRendererProps>;
  menuModal?: boolean;
  menuRtl?: boolean;
  onItemClose?: () => void;
  style?: ComponentStyle;
}

export const SubMenuElement = observer<ISubMenuElementProps, HTMLButtonElement>(forwardRef(function SubMenuElement(
  {
    menuData,
    subMenu,
    itemRenderer,
    style,
    menuModal: modal,
    menuRtl: rtl,
    onItemClose,
    ...rest
  },
  ref
) {
  const menuService = useService(MenuService);
  const menu = useRef<IMenuState>();
  const styles = useStyles(menuPanelStyles, style);
  const subMenuData = useMenu({ menu: subMenu.menu, context: menuData.context });
  subMenuData.context.set(DATA_CONTEXT_MENU_NESTED, true);
  subMenuData.context.set(DATA_CONTEXT_SUBMENU_ITEM, subMenu);

  const handler = menuService.getHandler(subMenuData.context);
  const hidden = getComputed(() => handler?.isHidden?.(subMenuData.context));

  const handlers = useObjectRef(() => ({
    handleItemClose() {
      menu.current?.hide();
      this.onItemClose?.();
    },
    hasBindings() {
      return this.subMenuData.items.some(
        item => item instanceof MenuActionItem && item.action.binding !== null
      );
    },
    handleVisibleSwitch(visible: boolean) {
      if (visible) {
        this.subMenu.events?.onOpen?.();
        this.handler?.handler?.(this.subMenuData.context);
      }
    },
  }), { subMenuData, menuData, handler, subMenu, onItemClose }, ['handleItemClose', 'hasBindings', 'handleVisibleSwitch']);

  if (hidden) {
    return null;
  }

  const loading = getComputed(() => handler?.isLoading?.(subMenuData.context));
  const disabled = getComputed(() => handler?.isDisabled?.(subMenuData.context));
  const MenuItemRenderer = itemRenderer;
  const panelAvailable = subMenuData.available && !loading;

  return styled(styles)(
    <Menu
      ref={ref}
      menuRef={menu}
      label={subMenuData.menu.label}
      items={() => subMenuData.items.map(item => menu.current &&  (
        <MenuItemRenderer
          key={item.id}
          item={item}
          menuData={subMenuData}
          menu={menu.current}
          rtl={rtl}
          modal={modal}
          style={style}
          onItemClose={handlers.handleItemClose}
        />
      ))}
      rtl={rtl}
      modal={modal}
      style={style}
      placement={rtl ? 'left-start' : 'right-start'}
      panelAvailable={panelAvailable}
      disabled={disabled}
      getHasBindings={handlers.hasBindings}
      submenu
      onVisibleSwitch={handlers.handleVisibleSwitch}
      {...rest}
    >
      <MenuItemElement
        label={subMenu.label ?? subMenu.menu.label}
        icon={subMenu.icon ?? subMenu.menu.icon}
        tooltip={subMenu.tooltip ?? subMenu.menu.tooltip}
        panelAvailable={panelAvailable}
        loading={loading}
        style={style}
        menu
      />
    </Menu>
  );
}));