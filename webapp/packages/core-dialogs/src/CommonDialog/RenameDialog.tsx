/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import styled, { css } from 'reshadow';

import { BASE_CONTAINERS_STYLES, Button, Container, InputField, SubmittingForm, useFocus, useObservableRef } from '@cloudbeaver/core-blocks';
import { Translate, useTranslate } from '@cloudbeaver/core-localization';
import { useStyles } from '@cloudbeaver/core-theming';
import { throttleAsync } from '@cloudbeaver/core-utils';

import { CommonDialogWrapper } from './CommonDialog/CommonDialogWrapper';
import type { DialogComponent } from './CommonDialogService';

const style = css`
  footer {
    align-items: center;
  }

  fill {
    flex: 1;
  }
`;

interface IRenameDialogState {
  value: string;
  message: string | undefined;
  valid: boolean;
  payload: RenameDialogPayload;
  validate: () => void;
  setMessage: (message: string) => void;
}

export interface RenameDialogPayload {
  value: string;
  objectName?: string;
  icon?: string;
  subTitle?: string;
  bigIcon?: boolean;
  viewBox?: string;
  confirmActionText?: string;
  create?: boolean;
  title?: string;
  validation?: (name: string, setMessage: (message: string) => void) => Promise<boolean> | boolean;
}

export const RenameDialog: DialogComponent<RenameDialogPayload, string> = observer(function RenameDialog({
  payload,
  resolveDialog,
  rejectDialog,
  className,
}) {
  const translate = useTranslate();
  const [focusedRef] = useFocus<HTMLFormElement>({ focusFirstChild: true });

  const { icon, subTitle, bigIcon, viewBox, value, objectName, create, confirmActionText } = payload;
  let { title } = payload;

  if (!title) {
    title = create ? 'ui_create' : 'ui_rename';
  }

  title = translate(title);

  if (objectName) {
    title += ` ${translate(objectName)}`;
  }

  const state = useObservableRef<IRenameDialogState>(() => ({
    value,
    message: undefined,
    valid: true,
    validate: throttleAsync(async () => {
      state.message = undefined;
      state.valid = (await state.payload.validation?.(
        state.value,
        state.setMessage.bind(state)
      )) ?? true;
    }, 300),
    setMessage(message) {
      this.message = message;
    },
  }), {
    value: observable.ref,
    valid: observable.ref,
    message: observable.ref,
  }, {
    payload,
  });

  useEffect(() => {
    state.validate();
  }, [value]);

  const errorMessage = state.valid ? ' ' : translate(state.message ?? 'ui_rename_taken_or_invalid');

  return styled(useStyles(style, BASE_CONTAINERS_STYLES))(
    <CommonDialogWrapper
      size='small'
      subTitle={subTitle}
      title={title}
      icon={icon}
      viewBox={viewBox}
      bigIcon={bigIcon}
      className={className}
      style={style}
      footer={(
        <>
          <Button
            type="button"
            mod={['outlined']}
            onClick={rejectDialog}
          >
            <Translate token='ui_processing_cancel' />
          </Button>
          <fill />
          <Button
            type="button"
            mod={['unelevated']}
            disabled={!state.valid}
            onClick={() => resolveDialog(state.value)}
          >
            <Translate token={confirmActionText || (create ? 'ui_create' : 'ui_rename')} />
          </Button>
        </>
      )}
      fixedWidth
      onReject={rejectDialog}
    >
      <SubmittingForm ref={focusedRef} onSubmit={() => resolveDialog(state.value)}>
        <Container center>
          <InputField
            name='value'
            state={state}
            error={!state.valid}
            description={errorMessage}
            onChange={() => state.validate()}
          >
            {translate('ui_name') + ':'}
          </InputField>
        </Container>
      </SubmittingForm>
    </CommonDialogWrapper>
  );
});
