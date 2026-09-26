import { act, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import renderer from 'react-test-renderer';

import { AccountSyncModal } from './AccountSyncModal';

const mockShowToast = jest.fn<(message: string) => void>();
const mockSignIn = jest.fn<(email: string, password: string) => Promise<void>>();
const mockSignOut = jest.fn<() => Promise<void>>();
const mockSignUp = jest.fn<
  (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
>();
let mockUser: { email: string } | null = null;

const mockColors = jest.requireActual<
  typeof import('../theme/colors')
>('../theme/colors').lightColors;

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('./animation/MotionModal', () => ({
  MotionModal: ({ children, visible }: { children: ReactNode; visible: boolean }) =>
    visible ? children : null,
}));

jest.mock('./AppToast', () => ({
  AppToastViewport: () => null,
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    configured: true,
    hydrated: true,
    signIn: mockSignIn,
    signOut: mockSignOut,
    signUp: mockSignUp,
    user: mockUser,
  }),
}));

jest.mock('../sync/CloudSyncContext', () => ({
  useCloudSync: () => ({
    lastSyncedAt: null,
    pendingCount: 0,
    status: 'synced',
    syncNow: jest.fn(async () => 'synced'),
  }),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: mockColors,
    locale: 'vi-VN',
    t: (key: string) => key,
  }),
}));

describe('AccountSyncModal feedback', () => {
  let tree: renderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    mockUser = null;
    mockSignIn.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue(undefined);
    mockSignUp.mockResolvedValue({ needsEmailConfirmation: false });
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.clearAllMocks();
  });

  function renderModal() {
    act(() => {
      tree = renderer.create(
        <AccountSyncModal visible onClose={jest.fn()} />,
      );
    });
  }

  function fillCredentials() {
    act(() => {
      tree?.root.findByProps({ placeholder: 'sync.email' }).props.onChangeText(
        'user@example.com',
      );
      tree?.root.findByProps({ placeholder: 'sync.password' }).props.onChangeText(
        'secret123',
      );
    });
  }

  it('shows a toast after signing in', async () => {
    renderModal();
    fillCredentials();

    await act(async () => {
      await tree?.root.findByProps({ accessibilityLabel: 'sync.signIn' }).props.onPress();
    });

    expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'secret123');
    expect(mockShowToast).toHaveBeenCalledWith('toast.signedIn');
  });

  it('shows the confirmation toast after creating an account', async () => {
    mockSignUp.mockResolvedValue({ needsEmailConfirmation: true });
    renderModal();
    fillCredentials();

    await act(async () => {
      await tree?.root.findByProps({ accessibilityLabel: 'sync.signUp' }).props.onPress();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'toast.accountCreatedCheckEmail',
    );
  });

  it('shows a toast after signing out', async () => {
    mockUser = { email: 'user@example.com' };
    renderModal();

    await act(async () => {
      await tree?.root.findByProps({ accessibilityLabel: 'sync.signOut' }).props.onPress();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith('toast.signedOut');
  });
});
