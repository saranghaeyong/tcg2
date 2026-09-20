import {
  Player,
  CooldownState,
  PersonCard,
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getAllAvailableCards } from './storage';

// Local storage fallback keys
const STORAGE_KEYS = {
  CURRENT_PLAYER: 'pcc_current_player_v3',
  SESSION_TOKEN: 'pcc_session_token_v3',
  LOCAL_PLAYERS: 'pcc_local_players_v3',
  LOCAL_COLLECTIONS: 'pcc_local_collections_v3',
  LOCAL_PACKS: 'pcc_local_packs_v3',
};

// 1-hour cooldown constant (3600 seconds)
export const COOLDOWN_DURATION_SECONDS = 3600;
export const MAX_PACKS_PER_BATCH = 5;

// Secure browser WebCrypto hash for local fallback
async function hashPasswordLocal(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + '_salt_pcc_secure_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check cooldown state from a player's lastPackBatchAt & packsInCurrentBatch
export function calculateCooldownState(player: Player | null): CooldownState {
  if (!player) {
    return {
      packsAvailable: MAX_PACKS_PER_BATCH,
      maxPacks: MAX_PACKS_PER_BATCH,
      cooldownRemainingSeconds: 0,
      isCooldownActive: false,
      cooldownUntil: null,
    };
  }

  const packsAvailable =
    typeof player.packsInCurrentBatch === 'number'
      ? Math.max(0, Math.min(MAX_PACKS_PER_BATCH, player.packsInCurrentBatch))
      : MAX_PACKS_PER_BATCH;

  const { lastPackBatchAt } = player;

  // If player has packs available in this batch (> 0), cooldown is not active
  if (packsAvailable > 0) {
    return {
      packsAvailable,
      maxPacks: MAX_PACKS_PER_BATCH,
      cooldownRemainingSeconds: 0,
      isCooldownActive: false,
      cooldownUntil: null,
    };
  }

  // packsAvailable is 0 -> 1-hour cooldown is active or evaluating
  if (!lastPackBatchAt) {
    return {
      packsAvailable: 0,
      maxPacks: MAX_PACKS_PER_BATCH,
      cooldownRemainingSeconds: COOLDOWN_DURATION_SECONDS,
      isCooldownActive: true,
      cooldownUntil: new Date(Date.now() + COOLDOWN_DURATION_SECONDS * 1000).toISOString(),
    };
  }

  const lastBatchTime = new Date(lastPackBatchAt).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - lastBatchTime) / 1000));

  if (elapsedSeconds >= COOLDOWN_DURATION_SECONDS) {
    // 1-hour cooldown has elapsed: full 5 packs available!
    return {
      packsAvailable: MAX_PACKS_PER_BATCH,
      maxPacks: MAX_PACKS_PER_BATCH,
      cooldownRemainingSeconds: 0,
      isCooldownActive: false,
      cooldownUntil: null,
    };
  }

  // Inside current 1-hour cooldown window
  const remainingSeconds = COOLDOWN_DURATION_SECONDS - elapsedSeconds;
  return {
    packsAvailable: 0,
    maxPacks: MAX_PACKS_PER_BATCH,
    cooldownRemainingSeconds: remainingSeconds,
    isCooldownActive: true,
    cooldownUntil: new Date(lastBatchTime + COOLDOWN_DURATION_SECONDS * 1000).toISOString(),
  };
}

// Helper to detect if Supabase schema cache is missing tables/functions
export function isSchemaCacheMissing(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const msg = error.message || '';
  const details = error.details || '';
  return (
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('Could not find the function') ||
    details.includes('schema cache') ||
    details.includes('no matches were found in the schema cache')
  );
}

// Local fallback admin account initializer
async function ensureLocalAdminAccount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    const players: Record<string, any> = raw ? JSON.parse(raw) : {};
    if (!players['6102000']) {
      const adminHash = await hashPasswordLocal('6102000');
      players['6102000'] = {
        id: 'admin-6102000-root',
        username: '6102000',
        usernameNormalized: '6102000',
        displayName: 'System Administrator',
        role: 'ADMIN',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
        lastPackBatchAt: null,
        packsInCurrentBatch: 5,
        totalPacksOpened: 0,
        isActive: true,
        passwordHash: adminHash,
      };
      localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(players));
    }
  } catch {}
}
if (typeof window !== 'undefined') {
  ensureLocalAdminAccount();
}

// ==============================================================================
// 1. REGISTER PLAYER
// Exact Signature: public.register_player(p_display_name, p_password, p_username)
// ==============================================================================
export async function registerPlayer(
  username: string,
  password: string,
  displayName?: string
): Promise<{ player: Player | null; error: string | null; cooldown: CooldownState }> {
  const trimmedUser = username.trim();
  const norm = trimmedUser.toLowerCase();

  if (norm.length < 3 || norm.length > 30) {
    return {
      player: null,
      error: 'Username must be between 3 and 30 characters.',
      cooldown: calculateCooldownState(null),
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
    return {
      player: null,
      error: 'Username can only contain letters, numbers, and underscores.',
      cooldown: calculateCooldownState(null),
    };
  }

  if (norm === '6102000') {
    return {
      player: null,
      error: 'Username already exists. Please choose another username.',
      cooldown: calculateCooldownState(null),
    };
  }

  if (password.length < 6) {
    return {
      player: null,
      error: 'Password must be at least 6 characters.',
      cooldown: calculateCooldownState(null),
    };
  }

  const supabase = getSupabase();

  // Try Supabase PostgreSQL RPC first
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('register_player', {
        p_username: trimmedUser,
        p_display_name: displayName?.trim() || trimmedUser,
        p_password: password,
      });

      if (error) {
        if (isSchemaCacheMissing(error)) {
          console.warn('[PCC Engine] Supabase register_player not in schema cache (PGRST202). Continuing with local engine.');
          // Gracefully fall through to local registration!
        } else {
          console.error('Supabase register_player error:', error);
          const msg = error.message || '';
          if (msg.includes('already exists') || error.code === '23505') {
            return {
              player: null,
              error: 'Username already exists. Please choose another username.',
              cooldown: calculateCooldownState(null),
            };
          }
          if (msg.includes('at least 6') || msg.includes('Password must be')) {
            return {
              player: null,
              error: 'Password must be at least 6 characters.',
              cooldown: calculateCooldownState(null),
            };
          }
          if (msg.includes('letters, numbers') || msg.includes('characters')) {
            return {
              player: null,
              error: msg,
              cooldown: calculateCooldownState(null),
            };
          }
          return {
            player: null,
            error: 'Authentication service error. Check the browser console.',
            cooldown: calculateCooldownState(null),
          };
        }
      } else {
        const playerRecord = data?.player || data;
        if (playerRecord && playerRecord.id) {
          const player: Player = {
            id: playerRecord.id,
            username: playerRecord.username || trimmedUser,
            usernameNormalized: norm,
            displayName:
              playerRecord.display_name ||
              playerRecord.displayName ||
              displayName?.trim() ||
              trimmedUser,
            role: (playerRecord.role as 'USER' | 'ADMIN') || 'USER',
            createdAt: playerRecord.created_at || new Date().toISOString(),
            lastLoginAt: playerRecord.last_login_at || new Date().toISOString(),
            lastPackBatchAt: null,
            packsInCurrentBatch: 5,
            totalPacksOpened: 0,
            isActive: true,
          };

          const sessionToken = data?.session_token || ('pcc-token-' + player.id + '-' + Date.now());

          // A newly registered account must start from the database's
          // authoritative state, never from stale browser/session state.
          let authoritativePlayer = player;
          let authoritativeCooldown: CooldownState = {
            packsAvailable: 5,
            maxPacks: 5,
            cooldownRemainingSeconds: 0,
            isCooldownActive: false,
            cooldownUntil: null,
          };

          try {
            const { data: stateData, error: stateError } = await supabase.rpc('get_player_state', {
              p_player_id: player.id,
              p_session_token: sessionToken,
            });

            if (!stateError && stateData?.success) {
              const packsAvailable = Number(stateData.packsAvailable ?? 5);
              const cooldownRemaining = Number(stateData.cooldownRemainingSeconds ?? 0);
              const cooldownActive = packsAvailable <= 0 && cooldownRemaining > 0;

              authoritativePlayer = {
                ...player,
                packsInCurrentBatch: packsAvailable,
                totalPacksOpened: Number(
                  stateData.player?.totalPacksOpened ?? player.totalPacksOpened
                ),
              };

              authoritativeCooldown = {
                packsAvailable,
                maxPacks: MAX_PACKS_PER_BATCH,
                cooldownRemainingSeconds: cooldownRemaining,
                isCooldownActive: cooldownActive,
                cooldownUntil: cooldownActive
                  ? new Date(Date.now() + cooldownRemaining * 1000).toISOString()
                  : null,
              };
            }
          } catch (stateError) {
            console.warn('Could not refresh new-player state after registration:', stateError);
          }

          saveSession(authoritativePlayer, sessionToken);

          return {
            player: authoritativePlayer,
            error: null,
            cooldown: authoritativeCooldown,
          };
        }
      }
    } catch (e: any) {
      console.warn('Supabase register exception, falling back to local engine:', e);
    }
  }

  // Local fallback registration when Supabase is not configured or schema not yet initialized
  try {
    await ensureLocalAdminAccount();
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    const players: Record<string, any> = raw ? JSON.parse(raw) : {};

    if (players[norm]) {
      return {
        player: null,
        error: 'Username already exists. Please choose another username.',
        cooldown: calculateCooldownState(null),
      };
    }

    const passwordHash = await hashPasswordLocal(password);
    const newId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newPlayer: Player = {
      id: newId,
      username: trimmedUser,
      usernameNormalized: norm,
      displayName: displayName?.trim() || trimmedUser,
      role: 'USER',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      lastPackBatchAt: null,
      packsInCurrentBatch: 5,
      totalPacksOpened: 0,
      isActive: true,
    };

    players[norm] = {
      ...newPlayer,
      passwordHash,
    };

    localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(players));
    saveSession(newPlayer, 'local-token-' + newId);

    return {
      player: newPlayer,
      error: null,
      cooldown: calculateCooldownState(newPlayer),
    };
  } catch (e: any) {
    console.error('Local registration error:', e);
    return {
      player: null,
      error: 'Authentication service error. Check the browser console.',
      cooldown: calculateCooldownState(null),
    };
  }
}

// ==============================================================================
// 2. LOGIN PLAYER
// Exact Signature: public.login_player(p_username, p_password)
// ==============================================================================
export async function loginPlayer(
  username: string,
  password: string
): Promise<{ player: Player | null; error: string | null; cooldown: CooldownState }> {
  const trimmedUser = username.trim();
  const norm = trimmedUser.toLowerCase();
  const supabase = getSupabase();

  // Try Supabase PostgreSQL RPC first
  if (supabase && isSupabaseConfigured()) {
    try {
      console.log("Login username:", trimmedUser);
      const { data, error } = await supabase.rpc("login_player", {
        p_username: trimmedUser,
        p_password: password,
      });

      if (error) {
        console.error("LOGIN RPC ERROR:", error);
        if (isSchemaCacheMissing(error)) {
          console.warn('[PCC Engine] Supabase login_player not in schema cache (PGRST202). Continuing with local engine.');
          // Gracefully fall through to local login!
        } else {
          const msg = error.message || '';
          if (msg.includes('deactivated') || msg.includes('inactive')) {
            return {
              player: null,
              error: 'This account has been deactivated. Please contact an administrator.',
              cooldown: calculateCooldownState(null),
            };
          }
          if (msg.includes('Incorrect') || msg.includes('password') || msg.includes('credentials')) {
            return {
              player: null,
              error: 'Incorrect username or password.',
              cooldown: calculateCooldownState(null),
            };
          }
          return {
            player: null,
            error: msg || 'Authentication service error. Check the browser console.',
            cooldown: calculateCooldownState(null),
          };
        }
      } else {
        console.log("LOGIN RPC DATA:", {
          success: data?.success,
          role: data?.player?.role || data?.role,
          username: data?.player?.username || data?.username,
        });
        const playerRecord = data?.player || data;
        const rawId = playerRecord?.id || data?.id || data?.player_id || ('player-' + (playerRecord?.username || trimmedUser));
        if (playerRecord && (playerRecord.id || data?.success || data?.username || playerRecord.username)) {
          const packsAvail = playerRecord.packs_in_current_batch ?? data?.packs_in_current_batch ?? 5;
          const lastBatchAt = playerRecord.last_pack_batch_at || data?.last_pack_batch_at || null;
          const rawRole = String(playerRecord.role || data?.role || 'user').trim().toUpperCase();
          const role: 'USER' | 'ADMIN' = rawRole === 'ADMIN' ? 'ADMIN' : 'USER';

          const player: Player = {
            id: rawId,
            username: playerRecord.username || data?.username || trimmedUser,
            usernameNormalized: norm,
            displayName:
              playerRecord.display_name ||
              data?.display_name ||
              playerRecord.displayName ||
              playerRecord.username ||
              data?.username ||
              trimmedUser,
            role,
            createdAt: playerRecord.created_at || data?.created_at || new Date().toISOString(),
            lastLoginAt: playerRecord.last_login_at || data?.last_login_at || new Date().toISOString(),
            lastPackBatchAt: lastBatchAt,
            packsInCurrentBatch: packsAvail,
            totalPacksOpened: playerRecord.total_packs_opened ?? data?.total_packs_opened ?? 0,
            isActive: playerRecord.is_active !== false && data?.is_active !== false,
          };

          const sessionToken = data?.session_token || ('pcc-token-' + player.id + '-' + Date.now());

          // Re-read the authoritative player state after login. This is important
          // because the browser must never reset a returning player's pack count
          // to the default 5 after logout/login.
          let authoritativePlayer = player;
          let authoritativeCooldown = calculateCooldownState(player);

          try {
            const { data: stateData, error: stateError } = await supabase.rpc('get_player_state', {
              p_player_id: player.id,
              p_session_token: sessionToken,
            });

            if (!stateError && stateData?.success) {
              const packsAvailable = Number(
                stateData.packsAvailable ?? player.packsInCurrentBatch ?? 5
              );
              const cooldownRemaining = Number(stateData.cooldownRemainingSeconds ?? 0);
              const cooldownActive = packsAvailable <= 0 && cooldownRemaining > 0;

              authoritativePlayer = {
                ...player,
                packsInCurrentBatch: packsAvailable,
              };

              authoritativeCooldown = {
                packsAvailable,
                maxPacks: MAX_PACKS_PER_BATCH,
                cooldownRemainingSeconds: cooldownRemaining,
                isCooldownActive: cooldownActive,
                cooldownUntil: cooldownActive
                  ? new Date(Date.now() + cooldownRemaining * 1000).toISOString()
                  : null,
              };
            } else if (stateError) {
              console.warn('Could not refresh authoritative pack state after login:', stateError.message);
            }
          } catch (stateError) {
            console.warn('Exception refreshing authoritative pack state after login:', stateError);
          }

          saveSession(authoritativePlayer, sessionToken);

          return {
            player: authoritativePlayer,
            error: null,
            cooldown: authoritativeCooldown,
          };
        }

        return {
          player: null,
          error: 'Incorrect username or password.',
          cooldown: calculateCooldownState(null),
        };
      }
    } catch (e: any) {
      console.warn('Supabase login exception, falling back to local engine:', e);
    }
  }

  // Local fallback verification when Supabase is not configured or schema not yet initialized
  try {
    await ensureLocalAdminAccount();
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    const players: Record<string, any> = raw ? JSON.parse(raw) : {};
    const record = players[norm];

    if (!record) {
      return {
        player: null,
        error: 'Incorrect username or password.',
        cooldown: calculateCooldownState(null),
      };
    }

    if (record.isActive === false) {
      return {
        player: null,
        error: 'This account has been deactivated. Please contact an administrator.',
        cooldown: calculateCooldownState(null),
      };
    }

    const testHash = await hashPasswordLocal(password);
    if (record.passwordHash !== testHash) {
      return {
        player: null,
        error: 'Incorrect username or password.',
        cooldown: calculateCooldownState(null),
      };
    }

    const player: Player = {
      id: record.id,
      username: record.username,
      usernameNormalized: norm,
      displayName: record.displayName || record.username,
      role: record.role || 'USER',
      createdAt: record.createdAt,
      lastLoginAt: new Date().toISOString(),
      lastPackBatchAt: record.lastPackBatchAt || null,
      packsInCurrentBatch: record.packsInCurrentBatch ?? 5,
      totalPacksOpened: record.totalPacksOpened || 0,
      isActive: true,
    };

    const cooldown = calculateCooldownState(player);
    record.lastLoginAt = player.lastLoginAt;
    players[norm] = record;
    localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(players));
    saveSession(player, 'local-token-' + player.id);

    return { player, error: null, cooldown };
  } catch (e: any) {
    console.error('Local login error:', e);
    return {
      player: null,
      error: 'Authentication service error. Check the browser console.',
      cooldown: calculateCooldownState(null),
    };
  }
}

// ==============================================================================
// 3. ATOMIC PACK OPENING (SERVER VALIDATED & 1-HOUR COOLDOWN ENFORCED)
// ==============================================================================
export async function openPackAtomic(
  player: Player,
  packType: string = 'STANDARD'
): Promise<{
  success: boolean;
  cards: PersonCard[];
  newCardsCount: number;
  updatedPlayer: Player;
  cooldown: CooldownState;
  error: string | null;
}> {
  const supabase = getSupabase();

  // Try Supabase PostgreSQL RPC
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('open_pack', {
        p_player_id: player.id,
        p_pack_type: packType,
        p_session_token: getSavedSession().token,
      });

      if (!error && data && data.success) {
        const returnedCards: PersonCard[] = data.cards || [];
        const packsAvail = data.packsAvailable ?? 0;
        const isCooldown = packsAvail === 0;
        const cooldownRemaining = data.cooldownRemainingSeconds ?? (isCooldown ? 3600 : 0);

        const updatedPlayer: Player = {
          ...player,
          totalPacksOpened: data.totalPacksOpened ?? player.totalPacksOpened + 1,
          packsInCurrentBatch: packsAvail,
          lastPackBatchAt: isCooldown ? new Date().toISOString() : player.lastPackBatchAt,
        };

        // The server RPC is authoritative. Never fall back to local mode after a
        // Supabase transaction has returned a real error; doing so can create a
        // second, browser-only game state and make data appear to disappear.
        const cooldown: CooldownState = {
          packsAvailable: packsAvail,
          maxPacks: MAX_PACKS_PER_BATCH,
          cooldownRemainingSeconds: cooldownRemaining,
          isCooldownActive: isCooldown,
          cooldownUntil: isCooldown
            ? new Date(Date.now() + cooldownRemaining * 1000).toISOString()
            : null,
        };

        saveSession(updatedPlayer);

        return {
          success: true,
          cards: returnedCards,
          newCardsCount: data.newCardsCount ?? 0,
          updatedPlayer,
          cooldown,
          error: null,
        };
      }

      if (data && !data.success) {
        return {
          success: false,
          cards: [],
          newCardsCount: 0,
          updatedPlayer: player,
          cooldown: calculateCooldownState(player),
          error:
            data.message ||
            data.error ||
            'Failed to open pack. Please try again.',
        };
      }
    } catch (e: any) {
      console.error('Supabase atomic pack error:', e);
      return {
        success: false,
        cards: [],
        newCardsCount: 0,
        updatedPlayer: player,
        cooldown: calculateCooldownState(player),
        error: 'Database error while opening the pack. Please try again.',
      };
    }
  }

  // Local fallback atomic pack execution
  const currentCooldown = calculateCooldownState(player);
  if (currentCooldown.isCooldownActive || currentCooldown.packsAvailable <= 0) {
    return {
      success: false,
      cards: [],
      newCardsCount: 0,
      updatedPlayer: player,
      cooldown: currentCooldown,
      error: 'COOLDOWN_ACTIVE: You have opened all 5 packs in this batch. Please wait for cooldown to expire.',
    };
  }

  // Draw 5 cards from catalog
  const catalog = getAllAvailableCards();
  const drawnCards: PersonCard[] = [];
  const pickedIds = new Set<string>();

  for (let i = 0; i < 5; i++) {
    const unpicked = catalog.filter((c) => !pickedIds.has(c.id));
    const pool = unpicked.length > 0 ? unpicked : catalog;
    const card = pool[Math.floor(Math.random() * pool.length)];
    pickedIds.add(card.id);
    drawnCards.push(card);
  }

  const nextPacksAvailable = Math.max(0, currentCooldown.packsAvailable - 1);
  const isExhausted = nextPacksAvailable === 0;
  const now = new Date().toISOString();

  const updatedPlayer: Player = {
    ...player,
    packsInCurrentBatch: nextPacksAvailable,
    totalPacksOpened: player.totalPacksOpened + 1,
    lastPackBatchAt: isExhausted ? now : player.lastPackBatchAt,
  };

  // Persist player in local players table
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    if (raw) {
      const players = JSON.parse(raw);
      if (players[player.usernameNormalized]) {
        players[player.usernameNormalized] = {
          ...players[player.usernameNormalized],
          packsInCurrentBatch: updatedPlayer.packsInCurrentBatch,
          totalPacksOpened: updatedPlayer.totalPacksOpened,
          lastPackBatchAt: updatedPlayer.lastPackBatchAt,
        };
        localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(players));
      }
    }
  } catch {}

  saveSession(updatedPlayer);

  const updatedCooldown: CooldownState = {
    packsAvailable: nextPacksAvailable,
    maxPacks: MAX_PACKS_PER_BATCH,
    cooldownRemainingSeconds: isExhausted ? COOLDOWN_DURATION_SECONDS : 0,
    isCooldownActive: isExhausted,
    cooldownUntil: isExhausted
      ? new Date(Date.now() + COOLDOWN_DURATION_SECONDS * 1000).toISOString()
      : null,
  };

  return {
    success: true,
    cards: drawnCards,
    newCardsCount: 0,
    updatedPlayer,
    cooldown: updatedCooldown,
    error: null,
  };
}

// ==============================================================================
// 4. SESSION MANAGEMENT
// ==============================================================================
export function getSavedSession(): { player: Player | null; token: string | null } {
  try {
    const rawPlayer = localStorage.getItem(STORAGE_KEYS.CURRENT_PLAYER);
    const token = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    if (rawPlayer) {
      const player: Player = JSON.parse(rawPlayer);
      return { player, token };
    }
  } catch {}
  return { player: null, token: null };
}

export function saveSession(player: Player, token?: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_PLAYER, JSON.stringify(player));
    if (token) {
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
    }
  } catch {}
}

export async function invalidateCurrentSessionToServer(token?: string | null): Promise<void> {
  const currentToken = token || getSavedSession().token;
  if (!currentToken) return;

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.from('player_sessions').delete().eq('session_token', currentToken);
    } catch (e) {
      console.warn('Could not delete server-side session from database:', e);
    }
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    // Clear temporary and transient session cache keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('pcc_temp_') || k.startsWith('pcc_session_') || k.startsWith('pcc_transient_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch {}
}

export async function validateCurrentSession(): Promise<{
  player: Player | null;
  error: string | null;
  cooldown: CooldownState;
}> {
  const { player: savedPlayer, token } = getSavedSession();
  if (!savedPlayer || !token) {
    return { player: null, error: null, cooldown: calculateCooldownState(null) };
  }

  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('validate_session', {
        p_token: token,
      });

      if (!error && data && data.valid && data.player) {
        const pRecord = data.player;
        const rawRole = String(pRecord.role || 'USER').toUpperCase();
        const role: 'USER' | 'ADMIN' = rawRole === 'ADMIN' ? 'ADMIN' : 'USER';
        const validatedPlayer: Player = {
          id: pRecord.id,
          username: pRecord.username,
          usernameNormalized: pRecord.username.toLowerCase(),
          displayName: pRecord.display_name || pRecord.displayName || pRecord.username,
          role,
          createdAt: pRecord.created_at,
          lastLoginAt: pRecord.last_login_at || new Date().toISOString(),
          lastPackBatchAt: pRecord.last_pack_batch_at || null,
          packsInCurrentBatch: pRecord.packs_in_current_batch ?? 5,
          totalPacksOpened: pRecord.total_packs_opened || 0,
          isActive: true,
        };

        // Re-read the authoritative player state after session validation.
        // This prevents logout/login from ever reverting a partially-used pack
        // batch to a browser-cached/default value.
        let authoritativePlayer = validatedPlayer;
        let authoritativeCooldown = calculateCooldownState(validatedPlayer);

        try {
          const { data: stateData, error: stateError } = await supabase.rpc('get_player_state', {
            p_player_id: validatedPlayer.id,
            p_session_token: token,
          });

          if (!stateError && stateData?.success) {
            const packsAvailable = Number(
              stateData.packsAvailable ?? validatedPlayer.packsInCurrentBatch ?? 5
            );
            const cooldownRemaining = Number(stateData.cooldownRemainingSeconds ?? 0);
            const cooldownActive = packsAvailable <= 0 && cooldownRemaining > 0;

            authoritativePlayer = {
              ...validatedPlayer,
              packsInCurrentBatch: packsAvailable,
            };

            authoritativeCooldown = {
              packsAvailable,
              maxPacks: MAX_PACKS_PER_BATCH,
              cooldownRemainingSeconds: cooldownRemaining,
              isCooldownActive: cooldownActive,
              cooldownUntil: cooldownActive
                ? new Date(Date.now() + cooldownRemaining * 1000).toISOString()
                : null,
            };
          } else if (stateError) {
            console.warn('Could not refresh authoritative state after session validation:', stateError.message);
          }
        } catch (stateError) {
          console.warn('Exception refreshing authoritative state after session validation:', stateError);
        }

        saveSession(authoritativePlayer, token);
        return {
          player: authoritativePlayer,
          error: null,
          cooldown: authoritativeCooldown,
        };
      } else if (data && !data.valid) {
        // Explicitly expired or deactivated server-side
        clearSession();
        return { player: null, error: data.error || 'Session expired', cooldown: calculateCooldownState(null) };
      }
    } catch (e) {
      console.warn('Supabase validate_session check failed, falling back:', e);
    }
  }

  // Fallback to local session check
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    if (raw) {
      const players = JSON.parse(raw);
      const rec = players[savedPlayer.usernameNormalized];
      if (rec && rec.isActive === false) {
        clearSession();
        return { player: null, error: 'This account has been deactivated.', cooldown: calculateCooldownState(null) };
      }
    }
  } catch {}

  return {
    player: savedPlayer,
    error: null,
    cooldown: calculateCooldownState(savedPlayer),
  };
}

// ==============================================================================
// 5. ADMIN FUNCTIONS
// ==============================================================================
export async function fetchAdminPlayers(
  adminId: string
): Promise<{ players: any[]; error: string | null }> {
  const supabase = getSupabase();

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('admin_get_players', {
        p_admin_id: adminId,
        p_token: getSavedSession().token,
      });

      if (!error && data && data.success) {
        return { players: data.players || [], error: null };
      }
    } catch (e: any) {
      console.warn('Supabase admin_get_players error:', e);
    }
  }

  // Fallback to local players
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    const playersMap = raw ? JSON.parse(raw) : {};
    const playerList = Object.values(playersMap).map((p: any) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      role: p.role,
      createdAt: p.createdAt,
      lastLoginAt: p.lastLoginAt,
      totalPacksOpened: p.totalPacksOpened || 0,
      cardsCollectedCount: 0,
      isActive: p.isActive !== false,
      // Passwords NEVER returned!
    }));

    return { players: playerList, error: null };
  } catch (e: any) {
    return { players: [], error: e.message || 'Failed to list players' };
  }
}

export async function adminTogglePlayerStatus(
  adminId: string,
  targetPlayerId: string,
  isActive: boolean
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabase();

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('admin_toggle_player_status', {
        p_admin_id: adminId,
        p_target_player_id: targetPlayerId,
        p_is_active: isActive,
        p_token: getSavedSession().token,
      });

      if (!error && data && data.success) {
        return { success: true, error: null };
      }
    } catch {}
  }

  // Local fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    if (raw) {
      const players = JSON.parse(raw);
      for (const k of Object.keys(players)) {
        if (players[k].id === targetPlayerId) {
          players[k].isActive = isActive;
        }
      }
      localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(players));
    }
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to update status' };
  }
}

export async function adminResetPassword(
  adminId: string,
  targetPlayerId: string,
  newPass: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabase();

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('admin_reset_player_password', {
        p_admin_id: adminId,
        p_target_player_id: targetPlayerId,
        p_new_password: newPass,
        p_token: getSavedSession().token,
      });

      if (!error && data && data.success) {
        return { success: true, error: null };
      }
    } catch {}
  }

  // Local fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_PLAYERS);
    if (raw) {
      const players = JSON.parse(raw);
      const newHash = await hashPasswordLocal(newPass);
      for (const k of Object.keys(players)) {
        if (players[k].id === targetPlayerId) {
          players[k].passwordHash = newHash;
        }
      }
      localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(players));
    }
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to reset password' };
  }
}

// Complete Application Reset (Admin Only)
// Permanently clears player accounts, sessions, collections, and history.
// Preserves the cards table, schema, and config.
// Recreates the administrator account (6102000).
export async function adminResetApplication(
  adminId: string,
  confirmationCode: string
): Promise<{ success: boolean; error: string | null; adminAccount?: any }> {
  if (confirmationCode !== 'RESET-CONFIRM-6102000') {
    return { success: false, error: 'Invalid confirmation code. Please enter RESET-CONFIRM-6102000.' };
  }

  const supabase = getSupabase();

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('admin_reset_application', {
        p_admin_id: adminId,
        p_confirmation_code: confirmationCode,
        p_token: getSavedSession().token,
      });

      if (error) {
        console.error('Supabase admin_reset_application error:', error);
        return { success: false, error: error.message || 'Database reset failed' };
      }

      if (data && data.success) {
        // Clear local storage and caches after database reset
        clearLocalUserDataAfterAppReset();
        return { success: true, error: null, adminAccount: data.adminAccount };
      } else {
        return { success: false, error: data?.error || 'Database reset failed' };
      }
    } catch (e: any) {
      console.warn('Exception during supabase admin_reset_application:', e);
      return { success: false, error: e.message || 'Database reset failed' };
    }
  }

  // Local fallback mode when Supabase is not configured
  try {
    const adminHash = await hashPasswordLocal('6102000');
    const freshAdminAccount = {
      id: 'admin-6102000-root',
      username: '6102000',
      usernameNormalized: '6102000',
      displayName: 'System Administrator',
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      lastPackBatchAt: null,
      packsInCurrentBatch: 5,
      totalPacksOpened: 0,
      isActive: true,
      passwordHash: adminHash,
    };

    const freshPlayers: Record<string, any> = {
      '6102000': freshAdminAccount,
    };

    localStorage.setItem(STORAGE_KEYS.LOCAL_PLAYERS, JSON.stringify(freshPlayers));
    clearLocalUserDataAfterAppReset();

    return {
      success: true,
      error: null,
      adminAccount: {
        username: '6102000',
        displayName: 'System Administrator',
        role: 'ADMIN',
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Local reset failed' };
  }
}

function clearLocalUserDataAfterAppReset() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== STORAGE_KEYS.LOCAL_PLAYERS && !k.startsWith('pcc_supabase_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch {}
}

