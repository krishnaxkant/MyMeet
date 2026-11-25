import { getSupabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedUser } from '../middleware/authMiddleware.js';
import { HttpError } from './meetingService.js';
import { getOrCreateProfile } from './profileService.js';

export type DevicePlatform = 'android' | 'web' | 'ios';

export interface UserDeviceRecord {
  id: string;
  user_id: string;
  platform: DevicePlatform;
  push_token: string;
  device_name: string | null;
  last_active_at: string;
  created_at: string;
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new HttpError(503, 'Supabase is not configured on the backend.');
  }
  return supabase;
}

export async function registerUserDevice(
  user: AuthenticatedUser,
  input: { platform: DevicePlatform; push_token: string; device_name?: string | null },
): Promise<UserDeviceRecord> {
  const pushToken = input.push_token.trim();
  if (!pushToken || pushToken.length > 512) {
    throw new HttpError(400, 'A valid push_token is required.');
  }

  const supabase = requireSupabase();
  await getOrCreateProfile(user.id, user.email, user.fullName);

  const { data, error } = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: user.id,
        platform: input.platform,
        push_token: pushToken,
        device_name: input.device_name?.trim() || null,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'push_token' },
    )
    .select('id, user_id, platform, push_token, device_name, last_active_at, created_at')
    .single<UserDeviceRecord>();

  if (error || !data) {
    throw new HttpError(500, `Failed to register device: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

export async function listUserDevices(userId: string): Promise<UserDeviceRecord[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, user_id, platform, push_token, device_name, last_active_at, created_at')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false });

  if (error) {
    throw new HttpError(500, `Failed to list devices: ${error.message}`);
  }

  return (data ?? []) as UserDeviceRecord[];
}

export async function removeUserDevice(userId: string, deviceId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('user_devices')
    .delete()
    .eq('id', deviceId)
    .eq('user_id', userId);

  if (error) {
    throw new HttpError(500, `Failed to remove device: ${error.message}`);
  }
}

export async function sendPushNotificationToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ attempted: number; delivered: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { attempted: 0, delivered: 0 };

  const { data, error } = await supabase
    .from('user_devices')
    .select('push_token')
    .eq('user_id', userId);

  if (error || !data || data.length === 0) {
    return { attempted: 0, delivered: 0 };
  }

  const expoTokens = (data as Array<{ push_token: string }>)
    .map((d) => d.push_token)
    .filter((tok) => tok.startsWith('ExponentPushToken[') || tok.startsWith('ExpoPushToken['));

  if (expoTokens.length === 0) {
    return { attempted: 0, delivered: 0 };
  }

  try {
    const messages = expoTokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(5000),
    });

    return {
      attempted: expoTokens.length,
      delivered: response.ok ? expoTokens.length : 0,
    };
  } catch (err) {
    console.warn('[push] Expo push delivery failed:', err);
    return { attempted: expoTokens.length, delivered: 0 };
  }
}
