import { PersonCard, Rarity } from '../types';
import { getAllAvailableCards } from './storage';

export type PackType = 'STANDARD' | 'HIGH_ROLLER' | 'GOD_PACK' | 'LEGENDARY_TEST';

export interface PackOption {
  id: PackType;
  name: string;
  badge: string;
  description: string;
  foilTheme: string;
}

export const AVAILABLE_PACKS: PackOption[] = [
  {
    id: 'STANDARD',
    name: 'Person Booster Pack',
    badge: 'Classic Series',
    description: 'Contains 5 cards with elevated chances for Rare, Epic, or Legendary pulls.',
    foilTheme: 'metallic-silver',
  },
  {
    id: 'HIGH_ROLLER',
    name: 'Neon High-Roller Pack',
    badge: 'Epic Guaranteed',
    description: 'Special pack guaranteed to deliver at least 1 Epic or Ultra Rare card.',
    foilTheme: 'metallic-purple',
  },
  {
    id: 'GOD_PACK',
    name: 'All-Star God Pack',
    badge: 'Dev Test Mode',
    description: 'Guaranteed all 5 cards Rare or above to test all cinematic animations!',
    foilTheme: 'metallic-rainbow',
  },
  {
    id: 'LEGENDARY_TEST',
    name: 'Celestial Sovereign Pack',
    badge: 'Guaranteed Legendary',
    description: 'Guaranteed to trigger the climactic Legendary reveal on Card 5!',
    foilTheme: 'metallic-gold',
  },
];

// Helper to pick a rarity by weighted probability from an allowed pool
function pickRarityFromPool(pool: Rarity[]): Rarity {
  const weights: Record<Rarity, number> = {
    COMMON: 50,
    UNCOMMON: 30,
    RARE: 14,
    EPIC: 4.5,
    ULTRA_RARE: 1.2,
    LEGENDARY: 0.3,
  };

  const filteredPool = pool.filter((r) => weights[r] !== undefined);
  const totalWeight = filteredPool.reduce((sum, r) => sum + weights[r], 0);

  let rand = Math.random() * totalWeight;
  for (const r of filteredPool) {
    if (rand < weights[r]) {
      return r;
    }
    rand -= weights[r];
  }
  return filteredPool[0] || 'COMMON';
}

export function generatePack(packType: PackType = 'STANDARD'): PersonCard[] {
  const allCards = getAllAvailableCards();
  const selectedCards: PersonCard[] = [];
  const pickedIds = new Set<string>();

  // Slot plans
  let slotRarities: Rarity[] = [];

  switch (packType) {
    case 'HIGH_ROLLER':
      slotRarities = [
        pickRarityFromPool(['UNCOMMON', 'RARE']),
        pickRarityFromPool(['UNCOMMON', 'RARE']),
        pickRarityFromPool(['RARE', 'EPIC']),
        'EPIC',
        pickRarityFromPool(['EPIC', 'ULTRA_RARE', 'LEGENDARY']),
      ];
      break;

    case 'GOD_PACK':
      slotRarities = [
        pickRarityFromPool(['RARE', 'EPIC']),
        pickRarityFromPool(['RARE', 'EPIC']),
        pickRarityFromPool(['EPIC', 'ULTRA_RARE']),
        pickRarityFromPool(['ULTRA_RARE', 'LEGENDARY']),
        'LEGENDARY',
      ];
      break;

    case 'LEGENDARY_TEST':
      slotRarities = [
        'COMMON',
        'UNCOMMON',
        'RARE',
        'ULTRA_RARE',
        'LEGENDARY',
      ];
      break;

    case 'STANDARD':
    default:
      slotRarities = [
        pickRarityFromPool(['COMMON', 'UNCOMMON']),
        pickRarityFromPool(['COMMON', 'UNCOMMON']),
        pickRarityFromPool(['UNCOMMON', 'RARE']),
        pickRarityFromPool(['RARE', 'EPIC', 'ULTRA_RARE']),
        pickRarityFromPool(['RARE', 'EPIC', 'ULTRA_RARE', 'LEGENDARY']),
      ];
      break;
  }

  for (let i = 0; i < 5; i++) {
    const targetRarity = slotRarities[i];
    // Find unpicked cards matching target rarity
    let candidates = allCards.filter(
      (c) => c.rarity === targetRarity && !pickedIds.has(c.id)
    );

    // Fallback if no matching unpicked card
    if (candidates.length === 0) {
      candidates = allCards.filter((c) => !pickedIds.has(c.id));
    }
    // Secondary fallback
    if (candidates.length === 0) {
      candidates = allCards;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    pickedIds.add(chosen.id);
    selectedCards.push(chosen);
  }

  return selectedCards;
}
