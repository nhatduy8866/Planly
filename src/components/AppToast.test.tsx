import { act } from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import renderer from 'react-test-renderer';

import { AppToastViewport, ToastProvider, useToast } from './AppToast';

const mockColors = jest.requireActual<
  typeof import('../theme/colors')
>('../theme/colors').lightColors;

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: mockColors,
    t: (key: string) => key,
  }),
}));

describe('AppToast', () => {
  let showToast: (message: string) => void = () => undefined;
  let tree: renderer.ReactTestRenderer | undefined;

  function Harness() {
    ({ showToast } = useToast());
    return null;
  }

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  it('shows a message and lets the user dismiss it', () => {
    act(() => {
      tree = renderer.create(
        <ToastProvider>
          <Harness />
          <AppToastViewport />
        </ToastProvider>,
      );
    });

    act(() => showToast('Đã cập nhật công việc'));

    expect(JSON.stringify(tree?.toJSON())).toContain('Đã cập nhật công việc');

    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'common.close' })
        .props.onPress();
    });

    expect(tree?.toJSON()).toBeNull();
  });
});
