import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DbCard, PersonCard } from '../types';

const STORAGE_KEYS = {
  CUSTOM_URL: 'pcc_supabase_custom_url',
  CUSTOM_ANON_KEY: 'pcc_supabase_custom_anon_key',
};

// Get environment credentials or user-provided runtime credentials
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const customUrl = localStorage.getItem(STORAGE_KEYS.CUSTOM_URL) || '';
  const customKey = localStorage.getItem(STORAGE_KEYS.CUSTOM_ANON_KEY) || '';

  const url = (customUrl || envUrl).trim();
  const anonKey = (customKey || envKey).trim();

  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    !url.includes('your-project-id') &&
    !anonKey.includes('your-supabase-anon') &&
    url.startsWith('https://')
  );
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfiguredUrl = '';
let currentConfiguredKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();

  if (!isSupabaseConfigured()) {
    return null;
  }

  // Re-instantiate if keys changed
  if (!supabaseInstance || currentConfiguredUrl !== url || currentConfiguredKey !== anonKey) {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    currentConfiguredUrl = url;
    currentConfiguredKey = anonKey;
  }

  return supabaseInstance;
}

export function saveCustomSupabaseCredentials(url: string, anonKey: string): boolean {
  try {
    if (url && anonKey) {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_URL, url.trim());
      localStorage.setItem(STORAGE_KEYS.CUSTOM_ANON_KEY, anonKey.trim());
      supabaseInstance = null; // Force reload
      return true;
    } else {
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_URL);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_ANON_KEY);
      supabaseInstance = null;
      return true;
    }
  } catch {
    return false;
  }
}

// Convert Supabase DbCard to frontend PersonCard model
export function mapDbCardToPersonCard(db: DbCard): PersonCard {
  return {
    id: db.id,
    name: db.name,
    age: db.age,
    photo: db.photo_url,
    rarity: db.rarity,
    category: db.category,
    description: db.description || '',
    cardNumber: db.card_number,
    background: db.background || 'linear-gradient(135deg, #1e293b, #0f172a)',
    accent: db.accent || '#94a3b8',
    stats: {
      charisma: db.charisma,
      energy: db.energy,
      style: db.style,
    },
    custom: true,
  };
}

// Convert PersonCard to DbCard insert payload
export function mapPersonCardToDbCard(card: PersonCard, userId?: string): Omit<DbCard, 'id' | 'created_at'> {
  return {
    name: card.name,
    age: card.age,
    photo_url: card.photo,
    rarity: card.rarity,
    category: card.category,
    description: card.description,
    card_number: card.cardNumber,
    background: card.background,
    accent: card.accent,
    charisma: card.stats.charisma,
    energy: card.stats.energy,
    style: card.stats.style,
    created_by: userId || null,
  };
}

// Upload real photo to Supabase Storage 'card-images' bucket
export async function uploadCardPhoto(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { url: null, error: 'Supabase client is not configured' };
  }

  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `card-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(uploadData.path);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: any) {
    console.error('Upload exception:', err);
    return { url: null, error: err.message || 'Failed to upload photo' };
  }
}
