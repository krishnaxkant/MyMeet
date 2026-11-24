import { getSupabaseAdmin } from '../config/supabase.js';

export interface UserProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  full_name?: string | null;
  avatar_url?: string | null;
}

export const getOrCreateProfile = async (
  userId: string,
  email: string,
  defaultFullName?: string,
): Promise<UserProfileRecord> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase is not configured on the backend.');
  }

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle<UserProfileRecord>();

  if (selectError) {
    throw new Error(`Failed to fetch profile: ${selectError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: defaultFullName?.trim() || null,
      },
      { onConflict: 'id' },
    )
    .select('id, email, full_name, avatar_url, created_at, updated_at')
    .single<UserProfileRecord>();

  if (insertError || !created) {
    throw new Error(`Failed to create profile: ${insertError?.message ?? 'Unknown error'}`);
  }

  return created;
};

export const updateUserProfile = async (
  userId: string,
  email: string,
  input: UpdateProfileInput,
): Promise<UserProfileRecord> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase is not configured on the backend.');
  }

  await getOrCreateProfile(userId, email);

  const updates: UpdateProfileInput = {};

  if (input.full_name !== undefined) {
    const trimmed = input.full_name === null ? null : input.full_name.trim();
    updates.full_name = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if (input.avatar_url !== undefined) {
    const trimmed = input.avatar_url === null ? null : input.avatar_url.trim();
    updates.avatar_url = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, email, full_name, avatar_url, created_at, updated_at')
    .single<UserProfileRecord>();

  if (error || !data) {
    throw new Error(`Failed to update profile: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
};
