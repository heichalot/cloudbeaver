/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import styled, { css, use } from 'reshadow';

import { AuthProvider, UserInfoResource } from '@cloudbeaver/core-authentication';
import { SubmittingForm, Loader, ErrorMessage, TextPlaceholder, Link, useErrorDetails } from '@cloudbeaver/core-blocks';
import { useService } from '@cloudbeaver/core-di';
import { CommonDialogWrapper, DialogComponent } from '@cloudbeaver/core-dialogs';
import { Translate, useTranslate } from '@cloudbeaver/core-localization';
import { useStyles } from '@cloudbeaver/core-theming';
import { TabsState, TabList, Tab, TabTitle, UNDERLINE_TAB_STYLES, BASE_TAB_STYLES } from '@cloudbeaver/core-ui';

import { AuthenticationService } from '../AuthenticationService';
import type { IAuthOptions } from '../IAuthOptions';
import { AuthDialogFooter } from './AuthDialogFooter';
import { AuthProviderForm } from './AuthProviderForm/AuthProviderForm';
import { ConfigurationsList } from './AuthProviderForm/ConfigurationsList';
import { FEDERATED_AUTH } from './FEDERATED_AUTH';
import { useAuthDialogState } from './useAuthDialogState';

const styles = css`
    CommonDialogWrapper {
      min-height: 520px !important;
      max-height: max(100vh - 48px, 520px) !important;
    }
    SubmittingForm {
      overflow: auto;
      &[|form] {
        margin: auto;
      }
    }
    SubmittingForm, AuthProviderForm {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    TabList {
      justify-content: center;
    }
    Tab {
      text-transform: uppercase;
      &:global([aria-selected=true]) {
        font-weight: 500 !important;
      }
    }
    AuthProviderForm {
      flex-direction: column;
      padding: 18px 24px;
    }
    ConfigurationsList {
      margin-top: 12px;
    }
    ErrorMessage {
      composes: theme-background-secondary theme-text-on-secondary from global;
      flex: 1;
    }
`;

export const AuthDialog: DialogComponent<IAuthOptions, null> = observer(function AuthDialog({
  payload: {
    providerId,
    configurationId,
    linkUser = false,
    accessRequest = false,
  },
  options,
  rejectDialog,
}) {
  const dialogData = useAuthDialogState(accessRequest, providerId, configurationId);
  const errorDetails = useErrorDetails(dialogData.exception);
  const authenticationService = useService(AuthenticationService);
  const userInfo = useService(UserInfoResource);
  const translate = useTranslate();
  const state = dialogData.state;

  const additional = userInfo.data !== null
    && state.activeProvider?.id !== undefined
    && !userInfo.hasToken(state.activeProvider.id);

  const showTabs = (dialogData.providers.length + dialogData.configurations.length) > 1;
  const federate = state.tabId === FEDERATED_AUTH;

  let dialogTitle = translate('authentication_login_dialog_title');
  let subTitle: string | undefined;
  let icon: string | undefined;

  if (state.activeProvider) {
    dialogTitle += `: ${state.activeProvider.label}`;
    subTitle = state.activeProvider.description;
    icon = state.activeProvider.icon;

    if (state.activeConfiguration) {
      dialogTitle  += `: ${state.activeConfiguration.displayName}`;
      subTitle = state.activeConfiguration.description;
      icon = state.activeConfiguration.iconURL || icon;
    }
  } else if (federate) {
    dialogTitle += `: ${translate('authentication_auth_federated')}`;
    subTitle = 'authentication_identity_provider_dialog_subtitle';
  }

  if (additional) {
    subTitle = 'authentication_request_token';
  }

  async function login() {
    await dialogData.login(linkUser);
    rejectDialog();
  }

  function navToSettings() {
    rejectDialog();
    authenticationService.configureAuthProvider?.();
  }

  function renderForm(provider: AuthProvider | null) {
    if (!provider) {
      return <TextPlaceholder>{translate('authentication_select_provider')}</TextPlaceholder>;
    }

    if (dialogData.configure) {
      return (
        <TextPlaceholder>
          {translate('authentication_provider_disabled')}
          {authenticationService.configureAuthProvider && (
            <Link onClick={() => { navToSettings(); }}>
              <Translate token="ui_configure" />
            </Link>
          )}
        </TextPlaceholder>
      );
    }

    return (
      <AuthProviderForm
        provider={provider}
        credentials={state.credentials}
        authenticate={dialogData.authenticating}
      />
    );
  }

  return styled(useStyles(BASE_TAB_STYLES, styles, UNDERLINE_TAB_STYLES))(
    <TabsState currentTabId={state.tabId} onChange={tabData => { state.setTabId(tabData.tabId); }}>
      <CommonDialogWrapper
        size='large'
        aria-label={translate('authentication_login_dialog_title')}
        title={dialogTitle}
        icon={icon}
        subTitle={subTitle}
        footer={!federate && (
          <AuthDialogFooter
            authAvailable={!dialogData.configure}
            isAuthenticating={dialogData.authenticating}
            onLogin={login}
          >
            {dialogData.exception && (
              <ErrorMessage
                text={errorDetails.details?.message || ''}
                hasDetails={errorDetails.details?.hasDetails}
                onShowDetails={errorDetails.open}
              />
            )}
          </AuthDialogFooter>
        )}
        noBodyPadding
        onReject={options?.persistent ? undefined : rejectDialog}
      >
        {showTabs && (
          <TabList aria-label='Auth providers'>
            {dialogData.providers.map(provider => (
              <Tab
                key={provider.id}
                tabId={provider.id}
                title={provider.description || provider.label}
                disabled={dialogData.authenticating}
                onClick={() => { state.setActiveProvider(provider); }}
              >
                <TabTitle>{provider.label}</TabTitle>
              </Tab>
            ))}
            {dialogData.configurations.length > 0 && (
              <Tab
                key={FEDERATED_AUTH}
                tabId={FEDERATED_AUTH}
                title={translate('authentication_auth_federated')}
                disabled={dialogData.authenticating}
                onClick={() => { state.setActiveProvider(null); }}
              >
                <TabTitle>{translate('authentication_auth_federated')}</TabTitle>
              </Tab>
            )}
          </TabList>
        )}
        <SubmittingForm {...use({ form: !federate })} onSubmit={login}>
          <Loader state={dialogData.loadingState}>
            {() => federate
              ? (
                <ConfigurationsList
                  activeProvider={state.activeProvider}
                  activeConfiguration={state.activeConfiguration}
                  providers={dialogData.configurations}
                  onAuthorize={(provider, configuration) => {
                    state.setActiveConfiguration(provider, configuration);
                  }}
                  onClose={rejectDialog}
                />
              )
              : renderForm(state.activeProvider)}
          </Loader>
        </SubmittingForm>
      </CommonDialogWrapper>
    </TabsState>
  );
});
