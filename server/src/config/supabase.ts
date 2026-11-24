import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

export type SupabaseStatus = 'connected' | 'not_configured' | 'error';

export interface SupabaseHealthResult {
  status: SupabaseStatus;
  message: string;
}

const isPlaceholder = (value: string): boolean => {
  return (
    !value ||
    value.includes('your-project') ||
    value.includes('your-supabase-') ||
    value.includes('your-anon-key') ||
    value.includes('your-service-role-key')
  );
};

export const isSupabaseConfigured = (): boolean => {
  return (
    !isPlaceholder(env.supabaseUrl) &&
    (!isPlaceholder(env.supabaseServiceRoleKey) || !isPlaceholder(env.supabaseAnonKey))
  );
};

let client: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    const key = !isPlaceholder(env.supabaseServiceRoleKey)
      ? env.supabaseServiceRoleKey
      : env.supabaseAnonKey;

    client = createClient(env.supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return client;
};

export const checkSupabaseConnection = async (): Promise<SupabaseHealthResult> => {
  if (!isSupabaseConfigured()) {
    return {
      status: 'not_configured',
      message: 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env to connect Supabase.',
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return {
        status: 'not_configured',
        message: 'Supabase client is not configured.',
      };
    }

    // Verify connectivity against the Supabase Auth health endpoint
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, '')}/auth/v1/health`, {
      headers: {
        apikey: !isPlaceholder(env.supabaseServiceRoleKey)
          ? env.supabaseServiceRoleKey
          : env.supabaseAnonKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        status: 'error',
        message: `Supabase health check returned HTTP ${response.status}.`,
      };
    }

    return {
      status: 'connected',
      message: 'Connected to Supabase successfully.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error';
    return {
      status: 'error',
      message: `Failed to reach Supabase: ${message}`,
    };
  }
};
