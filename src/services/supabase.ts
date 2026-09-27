import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

function readPublicEnv(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith('your_')) return undefined;
  return normalized;
}

const supabaseUrl = readPublicEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabasePublishableKey = readPublicEnv(
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const nativeSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue !== null) return secureValue;

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;
    await SecureStore.setItemAsync(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },
  async removeItem(key: string): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      AsyncStorage.removeItem(key),
    ]);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  },
};

const authStorage = Platform.OS === 'web' ? AsyncStorage : nativeSecureStorage;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: authStorage,
      },
    })
  : null;
