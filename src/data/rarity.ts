import { Rarity, RarityDetails } from '../types';

export const RARITIES: Record<Rarity, RarityDetails> = {
  COMMON: {
    name: 'COMMON',
    label: 'Common',
    color: '#94a3b8',
    textColor: 'text-slate-300',
    borderColor: 'border-slate-500/40',
    glowColor: 'rgba(148, 163, 184, 0.25)',
    bgGradient: 'from-slate-900 via-slate-950 to-neutral-950',
    foilType: 'none',
    audioFrequency: 330,
  },
  UNCOMMON: {
    name: 'UNCOMMON',
    label: 'Uncommon',
    color: '#10b981',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    bgGradient: 'from-emerald-950/80 via-slate-950 to-neutral-950',
    foilType: 'subtle',
    audioFrequency: 440,
  },
  RARE: {
    name: 'RARE',
    label: 'Rare',
    color: '#38bdf8',
    textColor: 'text-sky-400',
    borderColor: 'border-sky-500/80',
    glowColor: 'rgba(56, 189, 248, 0.55)',
    bgGradient: 'from-sky-950/80 via-slate-950 to-neutral-950',
    foilType: 'silver',
    audioFrequency: 554,
  },
  EPIC: {
    name: 'EPIC',
    label: 'Epic',
    color: '#c084fc',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500',
    glowColor: 'rgba(192, 132, 252, 0.65)',
    bgGradient: 'from-purple-950/90 via-slate-950 to-neutral-950',
    foilType: 'purple',
    audioFrequency: 659,
  },
  ULTRA_RARE: {
    name: 'ULTRA_RARE',
    label: 'Ultra Rare',
    color: '#f43f5e',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500',
    glowColor: 'rgba(244, 63, 94, 0.75)',
    bgGradient: 'from-rose-950/90 via-neutral-950 to-purple-950/60',
    foilType: 'prism',
    audioFrequency: 784,
  },
  LEGENDARY: {
    name: 'LEGENDARY',
    label: 'Legendary',
    color: '#fbbf24',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-400',
    glowColor: 'rgba(251, 191, 36, 0.85)',
    bgGradient: 'from-amber-950/90 via-yellow-950/40 to-neutral-950',
    foilType: 'gold_celestial',
    audioFrequency: 988,
  },
};

export const RARITY_DROP_RATES: Record<Rarity, number> = {
  COMMON: 0.50,
  UNCOMMON: 0.25,
  RARE: 0.15,
  EPIC: 0.07,
  ULTRA_RARE: 0.025,
  LEGENDARY: 0.005,
};

// Slot distribution rules for a 5-card booster pack
export const PACK_SLOT_CONFIGS: { slot: number; description: string; pool: Rarity[] }[] = [
  { slot: 1, description: 'Base Person', pool: ['COMMON', 'UNCOMMON'] },
  { slot: 2, description: 'Base Person', pool: ['COMMON', 'UNCOMMON'] },
  { slot: 3, description: 'Elevated Tier', pool: ['UNCOMMON', 'RARE'] },
  { slot: 4, description: 'High Tier Slot', pool: ['RARE', 'EPIC', 'ULTRA_RARE'] },
  { slot: 5, description: 'Jackpot Climax Slot', pool: ['RARE', 'EPIC', 'ULTRA_RARE', 'LEGENDARY'] },
];

export function getRarityDetails(rarity: Rarity): RarityDetails {
  return RARITIES[rarity] || RARITIES.COMMON;
}
