import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import renderer from 'react-test-renderer';

import { AiSaveSnackbar } from './AiSaveSnackbar';

jest.mock('../../preferences/PreferencesContext', () => {
  const { translate } = jest.requireActual<
    typeof import('../../i18n/translations')
  >('../../i18n/translations');
  const { lightColors } = jest.requireActual<
    typeof import('../../theme/colors')
  >('../../theme/colors');

  return {
    usePreferences: () => ({
      colors: lightColors,
      locale: 'vi-VN',
      t: (
        key: Parameters<typeof translate>[1],
        values?: Parameters<typeof translate>[2],
      ) => translate('vi', key, values),
    }),
  };
});

describe('AiSaveSnackbar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shows saved task details and the undo action', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <AiSaveSnackbar
          action="undo"
          feedback={{
            createdCount: 2,
            updatedCount: 0,
            tasks: [
              {
                id: 'first',
                title: 'Tập thể dục',
                date: '2026-09-11',
                startTime: '08:00',
              },
              {
                id: 'second',
                title: 'Học tiếng Anh',
                date: '2026-09-11',
                startTime: '14:00',
              },
            ],
          }}
          onAction={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });

    const output = JSON.stringify(tree!.toJSON());
    expect(output).toContain('Đã thêm 2 công việc');
    expect(output).toContain('08:00 · 14:00');
    expect(output).toContain('Hoàn tác');

    act(() => tree!.unmount());
  });

  it('renders nothing without feedback', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <AiSaveSnackbar
          action="undo"
          feedback={null}
          onAction={jest.fn()}
          onDismiss={jest.fn()}
        />,
      );
    });
    expect(tree!.toJSON()).toBeNull();
    act(() => tree!.unmount());
  });
});
