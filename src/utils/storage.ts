import { CollectedCard, DbCard, PackHistoryItem, PersonCard, UserProfile } from '../types';
import { INITIAL_CARDS } from '../data/cards';
import { getSupabase, mapDbCardToPersonCard, mapPersonCardToDbCard } from './supabase';

const BASE_KEYS = {
  COLLECTION: 'pcc_collection_v2',
  HISTORY: 'pcc_history_v2',
  CUSTOM_CARDS: 'pcc_custom_cards_v2',
  PROFILE: 'pcc_profile_v2',
};

// In-memory catalog of cards fetched from Supabase
let cachedCloudCards: PersonCard[] = [];

export function getCachedCloudCards(): PersonCard[] {
  return cachedCloudCards;
}

export function setCachedCloudCards(cards: PersonCard[]): void {
  cachedCloudCards = cards;
}

// User-specific storage key generator
function getUserKey(base: string, userId?: string | null): string {
  const safeId = userId || 'guest';
  return `${base}_${safeId}`;
}

export function getCustomCards(): PersonCard[] {
  try {
    const raw = localStorage.getItem(BASE_KEYS.CUSTOM_CARDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomCard(card: PersonCard): void {
  try {
    const existing = getCustomCards();
    const updated = [card, ...existing.filter((c) => c.id !== card.id)];
    localStorage.setItem(BASE_KEYS.CUSTOM_CARDS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save custom card locally', e);
  }
}

// Combines starter cards, custom local cards, and Supabase cloud cards
export function getAllAvailableCards(): PersonCard[] {
  const custom = getCustomCards();
  const map = new Map<string, PersonCard>();

  // Base starter cards
  INITIAL_CARDS.forEach((c) => map.set(c.id, c));

  // Local custom cards
  custom.forEach((c) => map.set(c.id, c));

  // Supabase cloud cards (if any)
  cachedCloudCards.forEach((c) => map.set(c.id, c));

  return Array.from(map.values());
}

export function getStoredCollection(userId?: string | null): Record<string, CollectedCard> {
  try {
    const key = getUserKey(BASE_KEYS.COLLECTION, userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCollectionToStorage(
  collection: Record<string, CollectedCard>,
  userId?: string | null
): void {
  try {
    const key = getUserKey(BASE_KEYS.COLLECTION, userId);
    localStorage.setItem(key, JSON.stringify(collection));
  } catch (e) {
    console.error('Failed to save collection locally', e);
  }
}

export function addCardsToCollection(
  cards: PersonCard[],
  userId?: string | null
): {
  updatedCollection: Record<string, CollectedCard>;
  newCardsCount: number;
} {
  const current = getStoredCollection(userId);
  const now = new Date().toISOString();
  let newCardsCount = 0;

  cards.forEach((card) => {
    if (current[card.id]) {
      current[card.id].copies += 1;
      current[card.id].lastDiscoveredAt = now;
      current[card.id].card = card;
    } else {
      newCardsCount += 1;
      current[card.id] = {
        cardId: card.id,
        card,
        copies: 1,
        firstDiscoveredAt: now,
        lastDiscoveredAt: now,
      };
    }
  });

  saveCollectionToStorage(current, userId);
  return { updatedCollection: current, newCardsCount };
}

export function getStoredPackHistory(userId?: string | null): PackHistoryItem[] {
  try {
    const key = getUserKey(BASE_KEYS.HISTORY, userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordPackOpened(historyItem: PackHistoryItem, userId?: string | null): void {
  try {
    const key = getUserKey(BASE_KEYS.HISTORY, userId);
    const history = getStoredPackHistory(userId);
    const updated = [historyItem, ...history];
    localStorage.setItem(key, JSON.stringify(updated.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save pack history locally', e);
  }
}

export function getStoredProfile(userId?: string | null): UserProfile {
  try {
    const key = getUserKey(BASE_KEYS.PROFILE, userId);
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}

  return {
    name: 'Player One',
    title: 'Novice Collector',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    packsOpened: 0,
    totalCardsCollected: 0,
    level: 1,
  };
}

export function updateStoredProfile(profile: Partial<UserProfile>, userId?: string | null): UserProfile {
  const current = getStoredProfile(userId);
  const updated = { ...current, ...profile };
  try {
    const key = getUserKey(BASE_KEYS.PROFILE, userId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function resetEntireCollection(userId?: string | null): void {
  try {
    const cKey = getUserKey(BASE_KEYS.COLLECTION, userId);
    const hKey = getUserKey(BASE_KEYS.HISTORY, userId);
    localStorage.removeItem(cKey);
    localStorage.removeItem(hKey);
    updateStoredProfile(
      {
        packsOpened: 0,
        totalCardsCollected: 0,
        level: 1,
      },
      userId
    );
  } catch (e) {
    console.error('Failed to reset collection', e);
  }
}

// ==============================================================================
// ASYNC SUPABASE CLOUD DATABASE OPERATIONS
// ==============================================================================

// 1. Fetch Master Cards Catalog from Supabase
export async function fetchCardsFromSupabase(): Promise<PersonCard[]> {
  const supabase = getSupabase();

  if (!supabase) {
    console.warn('Supabase client is not connected');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('ERROR FETCHING CARDS FROM SUPABASE:', error);
      return [];
    }

    console.log('SUPABASE CARDS FETCHED:', data?.length ?? 0);

    if (data && data.length > 0) {
      const mapped = (data as DbCard[]).map(mapDbCardToPersonCard);

      setCachedCloudCards(mapped);

      console.log('CARD CATALOG UPDATED:', mapped.length);

      return mapped;
    }

    console.warn('Supabase cards query returned 0 cards');
    return [];
  } catch (e) {
    console.error('EXCEPTION FETCHING CARDS FROM SUPABASE:', e);
    return [];
  }
}

// 2. Fetch User Collected Cards from Supabase
export async function fetchUserCollectionFromSupabase(
  userId: string,
  sessionToken?: string | null
): Promise<Record<string, CollectedCard>> {
  const supabase = getSupabase();
  if (!supabase || !userId) return {};

  // IMPORTANT: Use the authoritative SECURITY DEFINER RPC first.
  // open_pack() writes the collection atomically and get_player_state() reads
  // the same transaction-owned data. This also avoids failures caused by older
  // player_cards column layouts or restrictive RLS policies.
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_player_state', {
      p_player_id: userId,
      p_session_token: sessionToken || undefined,
    });

    if (!rpcError && rpcData?.success && rpcData?.collection) {
      const collectionMap: Record<string, CollectedCard> = {};

      Object.entries(rpcData.collection).forEach(([cardId, item]: [string, any]) => {
        if (!item?.card) return;
        const rawCard = item.card as any;
        // get_player_state is the source of truth. Normalize either the
        // frontend-shaped card returned by the RPC or a DB-shaped card object.
        const card: PersonCard = rawCard.photo_url || rawCard.card_number
          ? mapDbCardToPersonCard(rawCard as DbCard)
          : rawCard as PersonCard;

        if (!card?.id || !card?.name) return;

        collectionMap[cardId] = {
          cardId,
          card,
          copies: Number(item.copies ?? 1),
          firstDiscoveredAt: item.firstDiscoveredAt || item.first_obtained_at || new Date().toISOString(),
          lastDiscoveredAt: item.lastDiscoveredAt || item.last_obtained_at || new Date().toISOString(),
        };
      });

      saveCollectionToStorage(collectionMap, userId);
      return collectionMap;
    }

    console.warn('Authoritative get_player_state collection read failed:', rpcError?.message || 'empty collection');
  } catch (e) {
    console.warn('Authoritative get_player_state collection exception:', e);
  }

  // Fallback for databases where the RPC is unavailable: read the canonical table directly.
  try {
    const { data, error } = await supabase
      .from('player_cards')
      .select(`
        id,
        player_id,
        card_id,
        count,
        first_obtained_at,
        last_obtained_at,
        cards (*)
      `)
      .eq('player_id', userId);

    if (!error) {
      const collectionMap: Record<string, CollectedCard> = {};
      const allAvailable = getAllAvailableCards();

      data?.forEach((row: any) => {
        const card = row.cards
          ? mapDbCardToPersonCard(row.cards as DbCard)
          : allAvailable.find((c) => c.id === row.card_id);

        if (card) {
          collectionMap[card.id] = {
            cardId: card.id,
            card,
            copies: Number(row.count ?? 1),
            firstDiscoveredAt: row.first_obtained_at,
            lastDiscoveredAt: row.last_obtained_at,
          };
        }
      });

      saveCollectionToStorage(collectionMap, userId);
      return collectionMap;
    }

    console.warn('Direct player_cards query failed:', error.message);
  } catch (e) {
    console.warn('Direct player_cards query exception:', e);
  }

  // Never overwrite an existing cloud collection with an empty result.
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_player_state', {
      p_player_id: userId,
      p_session_token: sessionToken || undefined,
    });

    if (!rpcError && rpcData?.success && rpcData?.collection) {
      const collectionMap: Record<string, CollectedCard> = {};

      Object.entries(rpcData.collection).forEach(([cardId, item]: [string, any]) => {
        if (!item?.card) return;
        const rawCard = item.card as any;
        // get_player_state is the source of truth. Normalize either the
        // frontend-shaped card returned by the RPC or a DB-shaped card object.
        const card: PersonCard = rawCard.photo_url || rawCard.card_number
          ? mapDbCardToPersonCard(rawCard as DbCard)
          : rawCard as PersonCard;

        if (!card?.id || !card?.name) return;

        collectionMap[cardId] = {
          cardId,
          card,
          copies: Number(item.copies ?? 1),
          firstDiscoveredAt: item.firstDiscoveredAt || item.first_obtained_at || new Date().toISOString(),
          lastDiscoveredAt: item.lastDiscoveredAt || item.last_obtained_at || new Date().toISOString(),
        };
      });

      saveCollectionToStorage(collectionMap, userId);
      return collectionMap;
    }

    console.warn('get_player_state collection read failed:', rpcError?.message || 'empty collection');
  } catch (e) {
    console.error('Exception fetching user collection from Supabase:', e);
  }

  // Never overwrite an existing cloud collection with an empty result.
  return getStoredCollection(userId);
}

// 3. Fetch User Pack History from Supabase
export async function fetchUserPacksFromSupabase(userId: string): Promise<PackHistoryItem[]> {
  const supabase = getSupabase();
  if (!supabase || !userId) return [];

  try {
    const { data: packsData, error: packsError } = await supabase
      .from('player_packs')
      .select('id, player_id, pack_type, pack_name, cards_count, opened_at')
      .eq('player_id', userId)
      .order('opened_at', { ascending: false })
      .limit(50);

    if (packsError || !packsData) return [];

    const packIds = packsData.map((p) => p.id);
    if (packIds.length === 0) return [];

    const { data: slotData, error: slotError } = await supabase
      .from('player_pack_cards')
      .select(`
        player_pack_id,
        slot_number,
        card_id,
        cards (*)
      `)
      .in('player_pack_id', packIds)
      .order('slot_number', { ascending: true });

    if (slotError) return [];

    const allAvailable = getAllAvailableCards();
    const slotsByPack: Record<string, PersonCard[]> = {};

    slotData?.forEach((slot: any) => {
      let card: PersonCard | undefined;
      if (slot.cards) {
        card = mapDbCardToPersonCard(slot.cards as DbCard);
      } else {
        card = allAvailable.find((c) => c.id === slot.card_id);
      }

      if (card) {
        if (!slotsByPack[slot.player_pack_id]) slotsByPack[slot.player_pack_id] = [];
        slotsByPack[slot.player_pack_id].push(card);
      }
    });

    const historyItems: PackHistoryItem[] = packsData.map((p) => ({
      id: p.id,
      packNumber: packsData.length - packsData.indexOf(p),
      packName: p.pack_name || 'Person Booster Pack',
      openedAt: p.opened_at,
      cards: slotsByPack[p.id] || [],
      newCardsCount: p.cards_count ?? 0,
    }));

    // Cache locally
    const key = getUserKey(BASE_KEYS.HISTORY, userId);
    localStorage.setItem(key, JSON.stringify(historyItems));

    return historyItems;
  } catch (e) {
    console.error('Exception fetching packs from Supabase:', e);
    return [];
  }
}

// 4. Save opened pack & cards into Supabase (Direct table fallback when RPC not used)
export async function recordPackOpenedToSupabase(params: {
  userId: string;
  packType: string;
  packName: string;
  cards: PersonCard[];
  newCardsCount: number;
}): Promise<void> {
  const supabase = getSupabase();
  const { userId, packName, cards, newCardsCount } = params;
  if (!supabase || !userId) return;

  try {
    // 1. Get next pack number
    const { count } = await supabase
      .from('player_packs')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', userId);

    const packNumber = (count || 0) + 1;
    const now = new Date().toISOString();

    // 2. Insert into `player_packs` table with canonical schema
    const { data: packRow, error: packError } = await supabase
      .from('player_packs')
      .insert([
        {
          player_id: userId,
          pack_number: packNumber,
          pack_name: packName,
          new_cards_count: newCardsCount,
          opened_at: now,
        },
      ])
      .select()
      .single();

    if (packError || !packRow) {
      console.warn('Failed to insert player_pack into Supabase:', packError?.message);
    }

    const packId = packRow?.id;

    // 3. Insert slot records into `player_pack_cards` (canonical: pack_id, position, card_id)
    if (packId) {
      const slotInserts = cards.map((card, idx) => ({
        pack_id: packId,
        card_id: card.id.includes('-') && card.id.length === 36 ? card.id : null,
        position: idx + 1,
        created_at: now,
      })).filter((s) => s.card_id !== null);

      if (slotInserts.length > 0) {
        await supabase.from('player_pack_cards').insert(slotInserts);
      }
    }

    // 4. Upsert player collected cards in `player_cards` table (canonical: copies, first_collected_at, last_collected_at)
    for (const card of cards) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(card.id);
      if (!isUuid) continue;

      const { data: existing } = await supabase
        .from('player_cards')
        .select('id, copies')
        .eq('player_id', userId)
        .eq('card_id', card.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('player_cards')
          .update({
            copies: (existing.copies || 1) + 1,
            last_collected_at: now,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('player_cards').insert([
          {
            player_id: userId,
            card_id: card.id,
            copies: 1,
            first_collected_at: now,
            last_collected_at: now,
          },
        ]);
      }
    }

    // 5. Update Player stats in `players` table (canonical: total_packs_opened)
    const { data: playerStats } = await supabase
      .from('players')
      .select('total_packs_opened')
      .eq('id', userId)
      .maybeSingle();

    if (playerStats) {
      await supabase
        .from('players')
        .update({
          total_packs_opened: (playerStats.total_packs_opened || 0) + 1,
        })
        .eq('id', userId);
    }
  } catch (e) {
    console.error('Exception recording pack to Supabase:', e);
  }
}

// 5. Admin: Create new card in Supabase `cards` table
export async function createCardInSupabase(
  card: PersonCard,
  userId?: string
): Promise<{ card: PersonCard | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { card: null, error: 'Supabase client is not connected' };
  }

  try {
    const payload = mapPersonCardToDbCard(card, userId);
    const { data, error } = await supabase
      .from('cards')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return { card: null, error: error.message };
    }

    const createdCard = mapDbCardToPersonCard(data as DbCard);
    setCachedCloudCards([createdCard, ...cachedCloudCards]);
    return { card: createdCard, error: null };
  } catch (e: any) {
    return { card: null, error: e.message || 'Failed to create card in database' };
  }
}

// 6. Admin: Update card in Supabase
export async function updateCardInSupabase(
  card: PersonCard
): Promise<{ card: PersonCard | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { card: null, error: 'Supabase not connected' };

  try {
    const payload = mapPersonCardToDbCard(card);
    const { data, error } = await supabase
      .from('cards')
      .update(payload)
      .eq('id', card.id)
      .select()
      .single();

    if (error) return { card: null, error: error.message };

    const updated = mapDbCardToPersonCard(data as DbCard);
    setCachedCloudCards(cachedCloudCards.map((c) => (c.id === updated.id ? updated : c)));
    return { card: updated, error: null };
  } catch (e: any) {
    return { card: null, error: e.message || 'Failed to update card' };
  }
}

// 7. Admin: Delete card from Supabase
export async function deleteCardFromSupabase(
  cardId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'Supabase not connected' };

  try {
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) return { success: false, error: error.message };

    setCachedCloudCards(cachedCloudCards.filter((c) => c.id !== cardId));
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to delete card' };
  }
}

// 8. Admin: Seed initial starter cards into Supabase `cards` table
export async function seedInitialCardsToSupabase(
  userId?: string
): Promise<{ count: number; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { count: 0, error: 'Supabase not connected' };

  try {
    const payloads = INITIAL_CARDS.map((c) => mapPersonCardToDbCard(c, userId));
    const { data, error } = await supabase.from('cards').insert(payloads).select();

    if (error) return { count: 0, error: error.message };

    const mapped = (data as DbCard[]).map(mapDbCardToPersonCard);
    setCachedCloudCards([...mapped, ...cachedCloudCards]);
    return { count: data.length, error: null };
  } catch (e: any) {
    return { count: 0, error: e.message || 'Failed to seed starter cards' };
  }
}

// Convenience alias helpers
export const fetchCardsCatalogFromSupabase = fetchCardsFromSupabase;

export async function savePackToSupabase(
  pack: PackHistoryItem,
  userId?: string
): Promise<void> {
  if (!userId) return;
  await recordPackOpenedToSupabase({
    userId,
    packType: 'STANDARD',
    packName: pack.packName,
    cards: pack.cards,
    newCardsCount: pack.newCardsCount,
  });
}

export async function saveUserCardsToSupabase(
  cards: PersonCard[],
  userId?: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !userId) return;
  try {
    for (const card of cards) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(card.id);
      if (!isUuid) continue;

      const { data: existing } = await supabase
        .from('player_cards')
        .select('id, copies')
        .eq('player_id', userId)
        .eq('card_id', card.id)
        .maybeSingle();

      const now = new Date().toISOString();
      if (existing) {
        await supabase
          .from('player_cards')
          .update({
            copies: (existing.copies || 1) + 1,
            last_collected_at: now,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('player_cards').insert([
          {
            player_id: userId,
            card_id: card.id,
            copies: 1,
            first_collected_at: now,
            last_collected_at: now,
          },
        ]);
      }
    }
  } catch (e) {
    console.error('Exception saving user cards to Supabase:', e);
  }
}
