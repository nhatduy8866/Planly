import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { nativeSecureStorage } from './supabase';

jest.mock(
  '@react-native-async-storage/async-storage',
  () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  deleteItemAsync: require('@jest/globals').jest.fn(async () => undefined),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  getItemAsync: require('@jest/globals').jest.fn(async () => null),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  setItemAsync: require('@jest/globals').jest.fn(async () => undefined),
}));

describe('nativeSecureStorage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('migrates a legacy plaintext session into secure storage', async () => {
    await AsyncStorage.setItem('auth-token', 'legacy-session');

    await expect(nativeSecureStorage.getItem('auth-token')).resolves.toBe(
      'legacy-session',
    );

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth-token',
      'legacy-session',
    );
    await expect(AsyncStorage.getItem('auth-token')).resolves.toBeNull();
  });

  it('writes only to secure storage on native platforms', async () => {
    await AsyncStorage.setItem('auth-token', 'old-session');

    await nativeSecureStorage.setItem('auth-token', 'new-session');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth-token',
      'new-session',
    );
    await expect(AsyncStorage.getItem('auth-token')).resolves.toBeNull();
  });

  it('removes both secure and legacy copies', async () => {
    await AsyncStorage.setItem('auth-token', 'legacy-session');

    await nativeSecureStorage.removeItem('auth-token');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth-token');
    await expect(AsyncStorage.getItem('auth-token')).resolves.toBeNull();
  });
});
