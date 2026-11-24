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

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  '',
);

export async function fetchBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok && response.status !== 503) {
    throw new Error(`Backend responded with HTTP ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
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
  const response = await fetch(`${API_BASE_URL}/api/me`, {
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
