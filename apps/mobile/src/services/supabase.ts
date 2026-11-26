import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

function sanitizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[a-z0-9.-]+\.supabase\.co/i);
  return (match ? match[0] : trimmed).replace(/\/+$/, '');
}

const supabaseUrl = sanitizeSupabaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '',
);
const supabaseAnonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra.supabaseAnonKey ||
  ''
).trim();

const isPlaceholder = (value: string): boolean => {
  return (
    !value ||
    value.includes('your-project') ||
    value.includes('your-supabase-') ||
    value.includes('your-anon-key')
  );
};

export const isMobileSupabaseConfigured =
  !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

export const supabase: SupabaseClient | null = isMobileSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
