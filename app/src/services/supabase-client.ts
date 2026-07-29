import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl: unknown = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawAnonKey: unknown = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const url = typeof rawUrl === 'string' ? rawUrl : undefined;
const anonKey = typeof rawAnonKey === 'string' ? rawAnonKey : undefined;

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null | undefined;

/** Returns null in local builds until a real Supabase project is configured. */
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!url || !anonKey) {
    client = null;
    return client;
  }
  client = createClient(url, anonKey, {
    auth: {
      storage: secureStorage,
      storageKey: 'liftlog.supabase.session',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function assertSupabaseConfigured(): SupabaseClient {
  const configured = getSupabaseClient();
  if (!configured) {
    throw new Error('Supabase no esta configurado. Completa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return configured;
}
