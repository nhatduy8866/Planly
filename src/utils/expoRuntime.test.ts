import { describe, expect, it } from '@jest/globals';
import { ExecutionEnvironment } from 'expo-constants';

import { isExpoGoRuntime } from './expoRuntime';

describe('isExpoGoRuntime', () => {
  it('detects the Expo Go store client', () => {
    expect(
      isExpoGoRuntime({
        appOwnership: 'expo',
        executionEnvironment: ExecutionEnvironment.StoreClient,
      }),
    ).toBe(true);
  });

  it('does not classify a development build as Expo Go', () => {
    expect(
      isExpoGoRuntime({
        appOwnership: null,
        executionEnvironment: ExecutionEnvironment.Standalone,
      }),
    ).toBe(false);
  });
});
