export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'ULTRA_RARE' | 'LEGENDARY';

export interface CardStats {
  charisma: number;
  energy: number;
  style: number;
}

export interface PersonCard {
  id: string;
  name: string;
  age: number;
  photo: string;
  rarity: Rarity;
  category: string;
  description: string;
  cardNumber: string;
  background: string;
  accent: string;
  stats: CardStats;
  custom?: boolean;
}

export interface CollectedCard {
  cardId: string;
  card: PersonCard;
  copies: number;
  firstDiscoveredAt: string;
  lastDiscoveredAt: string;
}

export interface PackHistoryItem {
  id: string;
  packNumber: number;
  packName: string;
  openedAt: string;
  cards: PersonCard[];
  newCardsCount: number;
}

export interface UserProfile {
  name: string;
  title: string;
  avatar: string;
  packsOpened: number;
  totalCardsCollected: number;
  level: number;
}

export interface AppSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  reducedMotion: boolean;
}

export type ActiveTab = 'HOME' | 'COLLECTION' | 'PACKS' | 'PROFILE' | 'SETTINGS' | 'ADMIN';

export type UserRole = 'USER' | 'ADMIN';

// --- AUTHENTICATED PLAYER MODEL ---
export interface Player {
  id: string;
  username: string;
  usernameNormalized: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
  lastPackBatchAt: string | null;
  packsInCurrentBatch: number;
  totalPacksOpened: number;
  isActive: boolean;
}

// --- COOLDOWN & PACK ALLOWANCE STATE ---
export interface CooldownState {
  packsAvailable: number; // 0 to 5
  maxPacks: number; // 5
  cooldownRemainingSeconds: number; // 0 to 3600
  isCooldownActive: boolean;
  cooldownUntil: string | null; // ISO timestamp
}

// --- DATABASE ENTITY SCHEMAS (SUPABASE) ---
export interface DbPlayer {
  id: string;
  username: string;
  username_normalized: string;
  password_hash?: string;
  display_name: string | null;
  created_at: string;
  last_login_at: string;
  role: UserRole;
  last_pack_batch_at: string | null;
  packs_in_current_batch: number;
  total_packs_opened: number;
  is_active: boolean;
  cards_collected_count?: number;
}

export interface DbCard {
  id: string;
  name: string;
  age: number;
  photo_url: string;
  rarity: Rarity;
  category: string;
  description: string;
  card_number: string;
  background: string;
  accent: string;
  charisma: number;
  energy: number;
  style: number;
  is_active?: boolean;
  created_by?: string | null;
  created_at?: string;
}

export interface DbPlayerCard {
  id: string;
  player_id: string;
  card_id: string;
  copies: number;
  first_collected_at: string;
  last_collected_at: string;
  cards?: DbCard;
}

export interface DbPlayerPack {
  id: string;
  player_id: string;
  pack_name?: string;
  opened_at: string;
  pack_number: number;
  new_cards_count?: number;
}

export interface DbPlayerPackCard {
  id: string;
  pack_id: string;
  card_id: string;
  position: number;
  created_at: string;
  cards?: DbCard;
}

// Legacy alias for compatibility
export type DbProfile = DbPlayer;

export interface RarityDetails {
  name: string;
  label: string;
  color: string;
  textColor: string;
  borderColor: string;
  glowColor: string;
  bgGradient: string;
  foilType: 'none' | 'subtle' | 'silver' | 'purple' | 'prism' | 'gold_celestial';
  audioFrequency: number;
}
