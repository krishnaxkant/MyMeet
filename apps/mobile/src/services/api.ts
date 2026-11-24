import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface SupabaseHealthInfo {
  status: 'connected' | 'not_configured' | 'error';
  message: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  supabase: SupabaseHealthInfo;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfilePayload {
  full_name?: string | null;
  avatar_url?: string | null;
}

function isEmulatorOrLoopbackUrl(url: string): boolean {
  return (
    url.includes('://10.0.2.2') ||
    url.includes('://localhost') ||
    url.includes('://127.0.0.1')
  );
}

function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  // If explicitly configured to a real LAN/production host, always honor it
  if (configured && !isEmulatorOrLoopbackUrl(configured)) {
    return configured.replace(/\/$/, '');
  }

  // On a physical device using Expo Go, hostUri gives the exact reachable LAN IP of the PC
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000`;
    }
  }

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchBackendHealth(): Promise<HealthResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok && response.status !== 503) {
    throw new Error(`Backend responded with HTTP ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    profile?: UserProfile;
    message?: string;
  };

  if (!response.ok || !payload.profile) {
    throw new Error(payload.message || `Failed to load profile (HTTP ${response.status})`);
  }

  return payload.profile;
}

export async function updateProfile(
  accessToken: string,
  updates: UpdateProfilePayload,
): Promise<UserProfile> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/me`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(updates),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    profile?: UserProfile;
    message?: string;
  };

  if (!response.ok || !payload.profile) {
    throw new Error(payload.message || `Failed to update profile (HTTP ${response.status})`);
  }

  return payload.profile;
}
