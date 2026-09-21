import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

import type { Task } from '../types';
import { TaskFormModal } from './TaskFormModal';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: new Proxy(
      {},
      { get: () => '#000000' },
    ),
    locale: 'vi-VN',
    t: (key: string) => key,
    theme: 'light',
  }),
}));

const batchTask: Task = {
  batchId: 'batch-1',
  completed: false,
  createdAt: '2026-09-21T00:00:00.000Z',
  date: '2026-09-21',
  description: 'Mô tả',
  id: 'task-1',
  order: 0,
  priority: 'medium',
  startTime: '09:00',
  title: 'Công việc lặp',
  updatedAt: '2026-09-21T00:00:00.000Z',
};

describe('TaskFormModal recurring group edits', () => {
  let tree: renderer.ReactTestRenderer | undefined;

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  it('asks for the edit scope after Save instead of showing it in Advanced', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn(async () => undefined);

    await act(async () => {
      tree = renderer.create(
        <TaskFormModal
          defaultDate="2026-09-21"
          onClose={onClose}
          onSubmit={onSubmit}
          task={batchTask}
          visible
        />,
      );
    });
    const rendered = tree!;

    expect(
      rendered.root.findAllByProps({ accessibilityLabel: 'taskForm.batchEdit' }),
    ).toHaveLength(0);

    const formSaveButton = rendered.root.findByProps({
      accessibilityLabel: 'common.save',
    });
    await act(async () => {
      formSaveButton.props.onPress();
    });

    const groupOption = rendered.root.findByProps({
      accessibilityLabel: 'taskForm.batchEdit',
    });
    expect(groupOption.props.accessibilityState).toEqual({ checked: false });
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => groupOption.props.onPress());
    expect(
      rendered.root.findByProps({ accessibilityLabel: 'taskForm.batchEdit' }).props
        .accessibilityState,
    ).toEqual({ checked: true });

    const confirmSaveButton = rendered.root
      .findAllByProps({ accessibilityLabel: 'common.save' })
      .filter((node) => typeof node.props.onPress === 'function')
      .at(-1);
    await act(async () => {
      confirmSaveButton?.props.onPress();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        applyToBatch: true,
        title: batchTask.title,
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
