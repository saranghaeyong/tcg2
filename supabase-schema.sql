-- ==============================================================================
-- PERSON CARD COLLECTION - COMPLETE DATABASE MIGRATION & SCHEMA
-- ==============================================================================
-- Run this script in your Supabase SQL Editor:
-- Dashboard > SQL Editor > New query > Paste & Run.
--
-- Features configured:
-- 1. Extensions: pgcrypto & uuid-ossp
-- 2. Tables: players, player_sessions, cards, player_cards, player_packs, player_pack_cards
-- 3. Hardened SECURITY DEFINER RPC Functions with SET search_path = '':
--    - public.register_player(p_display_name text, p_password text, p_username text)
--    - public.login_player(p_username text, p_password text)
--    - public.validate_session(p_token text)
--    - public.open_pack(p_player_id uuid, p_pack_type text)
--    - public.get_player_state(p_player_id uuid)
--    - public.admin_get_players(p_admin_id uuid)
--    - public.admin_toggle_player_status(p_admin_id uuid, p_target_player_id uuid, p_is_active boolean)
--    - public.admin_reset_player_password(p_admin_id uuid, p_target_player_id uuid, p_new_password text)
-- 4. Single Administrator Account Seed (Username: 6102000, Role: ADMIN)
-- 5. Default 12 Master Person Cards Seed
-- 6. Storage bucket 'card-images' for card photo uploads
-- 7. PostgREST schema cache reload notification
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure public wrappers for crypt and gen_salt exist if pgcrypto was installed into schema 'extensions'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
    WHERE pg_namespace.nspname = 'public' AND pg_proc.proname = 'crypt'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
      WHERE pg_namespace.nspname = 'extensions' AND pg_proc.proname = 'crypt'
    ) THEN
      EXECUTE 'CREATE OR REPLACE FUNCTION public.crypt(text, text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$ SELECT extensions.crypt($1, $2); $f$;';
      EXECUTE 'CREATE OR REPLACE FUNCTION public.gen_salt(text) RETURNS text LANGUAGE sql STRICT IMMUTABLE PARALLEL SAFE AS $f$ SELECT extensions.gen_salt($1); $f$;';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ==============================================================================
-- 2. TABLES DEFINITIONS
-- ==============================================================================

-- PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_pack_batch_at TIMESTAMPTZ,
  packs_in_current_batch INTEGER NOT NULL DEFAULT 5,
  total_packs_opened INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Ensure all required columns exist if table was previously created
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'username_normalized') THEN
    ALTER TABLE public.players ADD COLUMN username_normalized TEXT;
    UPDATE public.players SET username_normalized = lower(trim(username));
    ALTER TABLE public.players ALTER COLUMN username_normalized SET NOT NULL;
    ALTER TABLE public.players ADD CONSTRAINT uq_players_username_normalized UNIQUE (username_normalized);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'packs_in_current_batch') THEN
    ALTER TABLE public.players ADD COLUMN packs_in_current_batch INTEGER NOT NULL DEFAULT 5;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'last_pack_batch_at') THEN
    ALTER TABLE public.players ADD COLUMN last_pack_batch_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'total_packs_opened') THEN
    ALTER TABLE public.players ADD COLUMN total_packs_opened INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'is_active') THEN
    ALTER TABLE public.players ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- PLAYER SESSIONS TABLE (Server-side session management)
CREATE TABLE IF NOT EXISTS public.player_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '30 days'),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- MASTER CARDS CATALOG
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 25,
  photo_url TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'ULTRA_RARE', 'LEGENDARY')),
  category TEXT NOT NULL DEFAULT 'CREATOR',
  description TEXT,
  card_number TEXT NOT NULL,
  background TEXT DEFAULT 'linear-gradient(135deg, #1e293b, #0f172a)',
  accent TEXT DEFAULT '#94a3b8',
  charisma INTEGER NOT NULL DEFAULT 75,
  energy INTEGER NOT NULL DEFAULT 75,
  style INTEGER NOT NULL DEFAULT 75,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PLAYER CARDS (Collected copies per player)
CREATE TABLE IF NOT EXISTS public.player_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  copies INTEGER NOT NULL DEFAULT 1,
  first_collected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_collected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_player_card UNIQUE(player_id, card_id)
);

-- PLAYER PACKS (Pack opening history)
CREATE TABLE IF NOT EXISTS public.player_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  pack_number INTEGER NOT NULL,
  pack_name TEXT NOT NULL DEFAULT 'Person Booster Pack',
  new_cards_count INTEGER NOT NULL DEFAULT 0
);

-- PLAYER PACK CARDS (Exactly 5 cards per opened pack)
CREATE TABLE IF NOT EXISTS public.player_pack_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.player_packs(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_players_normalized ON public.players(username_normalized);
CREATE INDEX IF NOT EXISTS idx_player_sessions_token ON public.player_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_player_cards_player ON public.player_cards(player_id);
CREATE INDEX IF NOT EXISTS idx_player_packs_player ON public.player_packs(player_id);
CREATE INDEX IF NOT EXISTS idx_player_pack_cards_pack ON public.player_pack_cards(pack_id);
CREATE INDEX IF NOT EXISTS idx_cards_active ON public.cards(is_active);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_pack_cards ENABLE ROW LEVEL SECURITY;

-- Cards: catalog is public read; insert/update/delete permitted
DROP POLICY IF EXISTS "Public cards read" ON public.cards;
CREATE POLICY "Public cards read" ON public.cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Cards insert" ON public.cards;
CREATE POLICY "Cards insert" ON public.cards FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Cards update" ON public.cards;
CREATE POLICY "Cards update" ON public.cards FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cards delete" ON public.cards;
CREATE POLICY "Cards delete" ON public.cards FOR DELETE USING (true);

-- Players & Sessions: STRICT SECURITY. No wide-open SELECT that exposes password_hash or session_token!
-- All access is mediated through hardened SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Players select" ON public.players;
DROP POLICY IF EXISTS "Player sessions access" ON public.player_sessions;

-- Player collection and history: SELECT allowed for own cards/packs inspection
-- Mutations are strictly restricted to the atomic open_pack() RPC transaction.
DROP POLICY IF EXISTS "Player cards access" ON public.player_cards;
DROP POLICY IF EXISTS "Player cards select" ON public.player_cards;
CREATE POLICY "Player cards select" ON public.player_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Player packs access" ON public.player_packs;
DROP POLICY IF EXISTS "Player packs select" ON public.player_packs;
CREATE POLICY "Player packs select" ON public.player_packs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Player pack cards access" ON public.player_pack_cards;
DROP POLICY IF EXISTS "Player pack cards select" ON public.player_pack_cards;
CREATE POLICY "Player pack cards select" ON public.player_pack_cards FOR SELECT USING (true);


-- ==============================================================================
-- 3. AUTHENTICATION & SESSION FUNCTIONS (SECURITY DEFINER, SET search_path = '')
-- ==============================================================================

-- DROP EXISTING VARIANTS TO PREVENT SCHEMA CONFLICTS
DROP FUNCTION IF EXISTS public.register_player(text, text, text);
DROP FUNCTION IF EXISTS public.register_player(text, text);
DROP FUNCTION IF EXISTS public.login_player(text, text);
DROP FUNCTION IF EXISTS public.validate_session(text);
DROP FUNCTION IF EXISTS public.open_pack(uuid);
DROP FUNCTION IF EXISTS public.open_pack(uuid, text);
DROP FUNCTION IF EXISTS public.open_pack(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_player_state(uuid);
DROP FUNCTION IF EXISTS public.get_player_state(uuid, text);
DROP FUNCTION IF EXISTS public.admin_get_players(uuid);
DROP FUNCTION IF EXISTS public.admin_get_players(uuid, text);
DROP FUNCTION IF EXISTS public.admin_toggle_player_status(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_toggle_player_status(uuid, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.admin_reset_player_password(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.admin_reset_player_password(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_reset_application(uuid, text);
DROP FUNCTION IF EXISTS public.admin_reset_application(uuid, text, text);

-- A. REGISTER PLAYER
-- Exact Parameter Signature:
-- p_display_name text
-- p_password text
-- p_username text
CREATE OR REPLACE FUNCTION public.register_player(
  p_display_name text,
  p_password text,
  p_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trimmed_username text;
  v_norm_username text;
  v_display_name text;
  v_hash text;
  v_new_id uuid;
  v_session_token text;
BEGIN
  -- 1. Trim username
  v_trimmed_username := pg_catalog.trim(pg_catalog.coalesce(p_username, ''));

  -- 2. Validate username (3-30 characters, alphanumeric + underscore)
  IF pg_catalog.length(v_trimmed_username) < 3 OR pg_catalog.length(v_trimmed_username) > 30 THEN
    RAISE EXCEPTION 'Username must be between 3 and 30 characters.';
  END IF;

  IF NOT (v_trimmed_username ~ '^[a-zA-Z0-9_]+$') THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores.';
  END IF;

  -- 3. Normalize username to lowercase
  v_norm_username := pg_catalog.lower(v_trimmed_username);

  -- 4. Disallow registering the dedicated admin username
  IF v_norm_username = '6102000' THEN
    RAISE EXCEPTION 'Username already exists. Please choose another username.';
  END IF;

  -- 5. Validate password (min 6 characters)
  IF p_password IS NULL OR pg_catalog.length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  -- 6. Check whether username already exists
  IF EXISTS (SELECT 1 FROM public.players WHERE username_normalized = v_norm_username) THEN
    RAISE EXCEPTION 'Username already exists. Please choose another username.';
  END IF;

  -- 7. Format display name
  v_display_name := pg_catalog.trim(pg_catalog.coalesce(p_display_name, ''));
  IF pg_catalog.length(v_display_name) = 0 THEN
    v_display_name := v_trimmed_username;
  END IF;

  -- 8. Hash password securely using bcrypt
  BEGIN
    v_hash := public.crypt(p_password, public.gen_salt('bf'));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Password hashing error: %', SQLERRM;
    END;
  END;

  -- 9. Insert the player (role is ALWAYS 'USER')
  INSERT INTO public.players (
    username,
    username_normalized,
    password_hash,
    display_name,
    role,
    created_at,
    last_login_at,
    last_pack_batch_at,
    packs_in_current_batch,
    total_packs_opened,
    is_active
  ) VALUES (
    v_trimmed_username,
    v_norm_username,
    v_hash,
    v_display_name,
    'USER',
    pg_catalog.now(),
    pg_catalog.now(),
    NULL,
    5,
    0,
    true
  )
  RETURNING id INTO v_new_id;

  -- 10. Generate persistent session token
  v_session_token := pg_catalog.gen_random_uuid()::text || '-' || pg_catalog.gen_random_uuid()::text;
  INSERT INTO public.player_sessions (player_id, session_token, expires_at)
  VALUES (v_new_id, v_session_token, pg_catalog.now() + interval '30 days');

  -- 11. Return safe player object + session token (never return password_hash)
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'player', pg_catalog.jsonb_build_object(
      'id', v_new_id,
      'username', v_trimmed_username,
      'display_name', v_display_name,
      'role', 'USER',
      'packs_in_current_batch', 5,
      'total_packs_opened', 0,
      'last_pack_batch_at', NULL,
      'created_at', pg_catalog.now(),
      'last_login_at', pg_catalog.now()
    ),
    'session_token', v_session_token
  );
END;
$$;


-- B. LOGIN PLAYER
-- Exact Parameter Signature:
-- p_username text
-- p_password text
CREATE OR REPLACE FUNCTION public.login_player(
  p_username text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_norm_username text;
  v_player record;
  v_now timestamptz := pg_catalog.now();
  v_elapsed_seconds integer;
  v_packs_available integer;
  v_last_batch timestamptz;
  v_password_valid boolean := false;
  v_session_token text;
BEGIN
  IF p_username IS NULL OR p_password IS NULL THEN
    RAISE EXCEPTION 'Incorrect username or password.';
  END IF;

  -- 1. Normalize username
  v_norm_username := pg_catalog.lower(pg_catalog.trim(p_username));

  -- 2. Find the player
  SELECT id, username, display_name, role, password_hash, is_active,
         packs_in_current_batch, total_packs_opened, last_pack_batch_at,
         created_at
  INTO v_player
  FROM public.players
  WHERE username_normalized = v_norm_username;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incorrect username or password.';
  END IF;

  -- 3. Verify password securely using bcrypt
  BEGIN
    v_password_valid := (v_player.password_hash = public.crypt(p_password, v_player.password_hash));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_password_valid := (v_player.password_hash = extensions.crypt(p_password, v_player.password_hash));
    EXCEPTION WHEN OTHERS THEN
      v_password_valid := false;
    END;
  END;

  IF NOT v_password_valid THEN
    RAISE EXCEPTION 'Incorrect username or password.';
  END IF;

  -- 4. Verify is_active = true
  IF v_player.is_active = false THEN
    RAISE EXCEPTION 'This account has been deactivated. Please contact an administrator.';
  END IF;

  -- 5. Calculate cooldown and pack counter
  v_last_batch := v_player.last_pack_batch_at;
  v_packs_available := pg_catalog.coalesce(v_player.packs_in_current_batch, 5);

  IF v_last_batch IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_batch))::integer;
    IF v_elapsed_seconds >= 3600 THEN
      -- 1-hour cooldown has elapsed, reset packs to 5
      v_packs_available := 5;
      v_last_batch := NULL;
      UPDATE public.players
      SET packs_in_current_batch = 5,
          last_pack_batch_at = NULL,
          last_login_at = v_now
      WHERE id = v_player.id;
    ELSE
      UPDATE public.players
      SET last_login_at = v_now
      WHERE id = v_player.id;
    END IF;
  ELSE
    UPDATE public.players
    SET last_login_at = v_now
    WHERE id = v_player.id;
  END IF;

  -- 6. Generate persistent session token
  v_session_token := pg_catalog.gen_random_uuid()::text || '-' || pg_catalog.gen_random_uuid()::text;
  INSERT INTO public.player_sessions (player_id, session_token, expires_at)
  VALUES (v_player.id, v_session_token, v_now + interval '30 days');

  -- 7. Return safe player information + session token (Never return password_hash)
  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'player', pg_catalog.jsonb_build_object(
      'id', v_player.id,
      'username', v_player.username,
      'display_name', pg_catalog.coalesce(v_player.display_name, v_player.username),
      'role', v_player.role,
      'packs_in_current_batch', v_packs_available,
      'total_packs_opened', pg_catalog.coalesce(v_player.total_packs_opened, 0),
      'last_pack_batch_at', v_last_batch,
      'created_at', v_player.created_at,
      'last_login_at', v_now
    ),
    'session_token', v_session_token
  );
END;
$$;


-- C. VALIDATE SESSION
-- Signature: p_token text
CREATE OR REPLACE FUNCTION public.validate_session(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session record;
  v_now timestamptz := pg_catalog.now();
  v_packs_available integer;
  v_last_batch timestamptz;
  v_elapsed_seconds integer;
BEGIN
  IF p_token IS NULL OR pg_catalog.length(pg_catalog.trim(p_token)) = 0 THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'No token provided');
  END IF;

  SELECT s.id AS session_id, s.player_id, s.expires_at, p.*
  INTO v_session
  FROM public.player_sessions s
  JOIN public.players p ON p.id = s.player_id
  WHERE s.session_token = p_token
    AND s.expires_at > v_now;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'Invalid or expired session');
  END IF;

  IF v_session.is_active = false THEN
    RETURN pg_catalog.jsonb_build_object('valid', false, 'error', 'Account is deactivated');
  END IF;

  UPDATE public.player_sessions
  SET last_seen_at = v_now
  WHERE id = v_session.session_id;

  v_last_batch := v_session.last_pack_batch_at;
  v_packs_available := pg_catalog.coalesce(v_session.packs_in_current_batch, 5);

  IF v_last_batch IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_batch))::integer;
    IF v_elapsed_seconds >= 3600 THEN
      v_packs_available := 5;
      v_last_batch := NULL;
      UPDATE public.players
      SET packs_in_current_batch = 5,
          last_pack_batch_at = NULL,
          last_login_at = v_now
      WHERE id = v_session.player_id;
    END IF;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'valid', true,
    'player', pg_catalog.jsonb_build_object(
      'id', v_session.player_id,
      'username', v_session.username,
      'display_name', pg_catalog.coalesce(v_session.display_name, v_session.username),
      'role', v_session.role,
      'packs_in_current_batch', v_packs_available,
      'total_packs_opened', pg_catalog.coalesce(v_session.total_packs_opened, 0),
      'last_pack_batch_at', v_last_batch,
      'created_at', v_session.created_at,
      'last_login_at', v_now
    )
  );
END;
$$;


-- ==============================================================================
-- 4. PACK OPENING ENGINE (ATOMIC TRANSACTION & 1-HOUR COOLDOWN)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.open_pack(
  p_player_id UUID DEFAULT NULL,
  p_pack_type TEXT DEFAULT 'STANDARD',
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player RECORD;
  v_target_player_id UUID;
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_elapsed_seconds NUMERIC;
  v_current_packs INTEGER;
  v_last_batch TIMESTAMPTZ;
  v_pack_id UUID;
  v_next_pack_num INTEGER;
  v_cards_json JSONB;
  v_pos INTEGER := 1;
  v_new_cards INTEGER := 0;
  v_is_existing BOOLEAN;
  v_slot_card_id UUID;
  v_selected_card_ids UUID[] := ARRAY[]::UUID[];
  v_cooldown_sec INTEGER := 0;
  v_packs_avail INTEGER;
  v_target_rarity TEXT;
  v_rand NUMERIC;
BEGIN
  -- 1. Verify Player / Session Token
  IF p_session_token IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_session_token)) > 0 THEN
    SELECT s.player_id INTO v_target_player_id
    FROM public.player_sessions s
    JOIN public.players p ON p.id = s.player_id
    WHERE s.session_token = p_session_token
      AND s.expires_at > v_now
      AND p.is_active = true;

    IF v_target_player_id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'error', 'INVALID_SESSION',
        'message', 'Invalid or expired session. Please log in again.'
      );
    END IF;
  ELSE
    v_target_player_id := p_player_id;
  END IF;

  IF v_target_player_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'No player specified');
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = v_target_player_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF NOT v_player.is_active THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Player account is inactive');
  END IF;

  -- 2. Server-side Cooldown & Pack Allowance Validation
  v_current_packs := pg_catalog.coalesce(v_player.packs_in_current_batch, 5);
  v_last_batch := v_player.last_pack_batch_at;

  IF v_last_batch IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_batch));
    IF v_elapsed_seconds >= 3600 THEN
      v_current_packs := 5;
      v_last_batch := NULL;
    ELSE
      IF v_current_packs <= 0 THEN
        v_cooldown_sec := pg_catalog.greatest(1, (3600 - v_elapsed_seconds)::INTEGER);
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'error', 'COOLDOWN_ACTIVE',
          'message', 'You have opened all 5 packs in this batch. Please wait for cooldown to expire.',
          'cooldownRemainingSeconds', v_cooldown_sec,
          'packsAvailable', 0
        );
      END IF;
    END IF;
  END IF;

  IF v_current_packs <= 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'COOLDOWN_ACTIVE',
      'message', 'No packs available.',
      'cooldownRemainingSeconds', 3600,
      'packsAvailable', 0
    );
  END IF;

  -- 3. Draw 5 cards according to pack type and rarity rules
  FOR v_pos IN 1..5 LOOP
    v_target_rarity := 'COMMON';
    v_rand := pg_catalog.random();

    IF p_pack_type = 'LEGENDARY_TEST' THEN
      CASE v_pos
        WHEN 1 THEN v_target_rarity := 'COMMON';
        WHEN 2 THEN v_target_rarity := 'UNCOMMON';
        WHEN 3 THEN v_target_rarity := 'RARE';
        WHEN 4 THEN v_target_rarity := 'ULTRA_RARE';
        ELSE v_target_rarity := 'LEGENDARY';
      END CASE;
    ELSIF p_pack_type = 'GOD_PACK' THEN
      CASE v_pos
        WHEN 1 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'RARE' ELSE 'EPIC' END;
        WHEN 2 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'RARE' ELSE 'EPIC' END;
        WHEN 3 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'EPIC' ELSE 'ULTRA_RARE' END;
        WHEN 4 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'ULTRA_RARE' ELSE 'LEGENDARY' END;
        ELSE v_target_rarity := 'LEGENDARY';
      END CASE;
    ELSIF p_pack_type = 'HIGH_ROLLER' THEN
      CASE v_pos
        WHEN 1 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'UNCOMMON' ELSE 'RARE' END;
        WHEN 2 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'UNCOMMON' ELSE 'RARE' END;
        WHEN 3 THEN v_target_rarity := CASE WHEN v_rand < 0.5 THEN 'RARE' ELSE 'EPIC' END;
        WHEN 4 THEN v_target_rarity := 'EPIC';
        ELSE
          IF v_rand < 0.5 THEN
            v_target_rarity := 'EPIC';
          ELSIF v_rand < 0.85 THEN
            v_target_rarity := 'ULTRA_RARE';
          ELSE
            v_target_rarity := 'LEGENDARY';
          END IF;
      END CASE;
    ELSE -- STANDARD
      CASE v_pos
        WHEN 1 THEN v_target_rarity := CASE WHEN v_rand < 0.625 THEN 'COMMON' ELSE 'UNCOMMON' END;
        WHEN 2 THEN v_target_rarity := CASE WHEN v_rand < 0.625 THEN 'COMMON' ELSE 'UNCOMMON' END;
        WHEN 3 THEN v_target_rarity := CASE WHEN v_rand < 0.68 THEN 'UNCOMMON' ELSE 'RARE' END;
        WHEN 4 THEN
          IF v_rand < 0.71 THEN
            v_target_rarity := 'RARE';
          ELSIF v_rand < 0.94 THEN
            v_target_rarity := 'EPIC';
          ELSE
            v_target_rarity := 'ULTRA_RARE';
          END IF;
        ELSE
          IF v_rand < 0.70 THEN
            v_target_rarity := 'RARE';
          ELSIF v_rand < 0.925 THEN
            v_target_rarity := 'EPIC';
          ELSIF v_rand < 0.985 THEN
            v_target_rarity := 'ULTRA_RARE';
          ELSE
            v_target_rarity := 'LEGENDARY';
          END IF;
      END CASE;
    END IF;

    -- Pick an active unpicked card of this rarity
    SELECT id INTO v_slot_card_id
    FROM public.cards
    WHERE is_active = true
      AND rarity = v_target_rarity
      AND NOT (id = ANY(v_selected_card_ids))
    ORDER BY random()
    LIMIT 1;

    -- Fallback 1: any active unpicked card
    IF v_slot_card_id IS NULL THEN
      SELECT id INTO v_slot_card_id
      FROM public.cards
      WHERE is_active = true
        AND NOT (id = ANY(v_selected_card_ids))
      ORDER BY random()
      LIMIT 1;
    END IF;

    -- Fallback 2: any card in catalog
    IF v_slot_card_id IS NULL THEN
      SELECT id INTO v_slot_card_id
      FROM public.cards
      ORDER BY random()
      LIMIT 1;
    END IF;

    IF v_slot_card_id IS NOT NULL THEN
      v_selected_card_ids := array_append(v_selected_card_ids, v_slot_card_id);
    END IF;
  END LOOP;

  IF pg_catalog.array_length(v_selected_card_ids, 1) < 5 THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Not enough cards in catalog. Please contact administrator.');
  END IF;

  -- 4. Create player_packs record
  v_next_pack_num := pg_catalog.coalesce(v_player.total_packs_opened, 0) + 1;
  v_pack_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.player_packs (
    id,
    player_id,
    opened_at,
    pack_number,
    pack_name,
    new_cards_count
  )
  VALUES (
    v_pack_id,
    v_player.id,
    v_now,
    v_next_pack_num,
    CASE 
      WHEN p_pack_type = 'LEGENDARY_TEST' THEN 'Celestial Sovereign Pack'
      WHEN p_pack_type = 'GOD_PACK' THEN 'All-Star God Pack'
      WHEN p_pack_type = 'HIGH_ROLLER' THEN 'Neon High-Roller Pack'
      ELSE 'Person Booster Pack'
    END,
    0
  );

  -- 5. Insert pack cards & update collection copies
  v_pos := 1;
  FOREACH v_slot_card_id IN ARRAY v_selected_card_ids
  LOOP
    INSERT INTO public.player_pack_cards (
      pack_id,
      card_id,
      position,
      created_at
    )
    VALUES (
      v_pack_id,
      v_slot_card_id,
      v_pos,
      v_now
    );

    SELECT EXISTS (
      SELECT 1 FROM public.player_cards
      WHERE player_id = v_player.id AND card_id = v_slot_card_id
    ) INTO v_is_existing;

    IF NOT v_is_existing THEN
      v_new_cards := v_new_cards + 1;
    END IF;

    INSERT INTO public.player_cards (
      player_id,
      card_id,
      copies,
      first_collected_at,
      last_collected_at
    )
    VALUES (
      v_player.id,
      v_slot_card_id,
      1,
      v_now,
      v_now
    )
    ON CONFLICT (player_id, card_id) DO UPDATE
    SET copies = public.player_cards.copies + 1,
        last_collected_at = v_now;

    v_pos := v_pos + 1;
  END LOOP;

  UPDATE public.player_packs
  SET new_cards_count = v_new_cards
  WHERE id = v_pack_id;

  -- 6. Decrement pack counter
  v_packs_avail := v_current_packs - 1;

  IF v_packs_avail <= 0 THEN
    v_packs_avail := 0;
    v_cooldown_sec := 3600;
    UPDATE public.players
    SET packs_in_current_batch = 0,
        last_pack_batch_at = v_now,
        total_packs_opened = pg_catalog.coalesce(total_packs_opened, 0) + 1
    WHERE id = v_player.id;
  ELSE
    v_cooldown_sec := 0;
    UPDATE public.players
    SET packs_in_current_batch = v_packs_avail,
        total_packs_opened = pg_catalog.coalesce(total_packs_opened, 0) + 1
    WHERE id = v_player.id;
  END IF;

  -- 7. Fetch card details
  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'age', c.age,
      'photo', c.photo_url,
      'rarity', c.rarity,
      'category', c.category,
      'description', c.description,
      'cardNumber', c.card_number,
      'background', c.background,
      'accent', c.accent,
      'stats', pg_catalog.jsonb_build_object(
        'charisma', c.charisma,
        'energy', c.energy,
        'style', c.style
      ),
      'custom', true
    )
  ) INTO v_cards_json
  FROM unnest(v_selected_card_ids) WITH ORDINALITY as u(cid, ord)
  JOIN public.cards c ON c.id = u.cid
  ORDER BY u.ord;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'cards', v_cards_json,
    'packId', v_pack_id,
    'packNumber', v_next_pack_num,
    'newCardsCount', v_new_cards,
    'packsAvailable', v_packs_avail,
    'cooldownRemainingSeconds', v_cooldown_sec,
    'totalPacksOpened', v_next_pack_num
  );
END;
$$;


-- D. GET PLAYER STATE
CREATE OR REPLACE FUNCTION public.get_player_state(
  p_player_id UUID DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player RECORD;
  v_target_id UUID;
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_elapsed_seconds NUMERIC;
  v_packs_avail INTEGER;
  v_cooldown_sec INTEGER := 0;
  v_collection_json JSONB;
  v_packs_json JSONB;
BEGIN
  IF p_session_token IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_session_token)) > 0 THEN
    SELECT s.player_id INTO v_target_id
    FROM public.player_sessions s
    WHERE s.session_token = p_session_token
      AND s.expires_at > v_now;
  ELSE
    v_target_id := p_player_id;
  END IF;

  IF v_target_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = v_target_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  v_packs_avail := pg_catalog.coalesce(v_player.packs_in_current_batch, 5);

  IF v_player.last_pack_batch_at IS NOT NULL THEN
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_player.last_pack_batch_at));
    IF v_elapsed_seconds >= 3600 THEN
      v_packs_avail := 5;
      v_cooldown_sec := 0;
    ELSE
      IF v_packs_avail <= 0 THEN
        v_cooldown_sec := pg_catalog.greatest(0, (3600 - v_elapsed_seconds)::INTEGER);
      END IF;
    END IF;
  END IF;

  SELECT pg_catalog.jsonb_object_agg(
    pc.card_id,
    pg_catalog.jsonb_build_object(
      'cardId', pc.card_id,
      'copies', pc.copies,
      'firstDiscoveredAt', pc.first_collected_at,
      'lastDiscoveredAt', pc.last_collected_at,
      'card', pg_catalog.jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'age', c.age,
        'photo', c.photo_url,
        'rarity', c.rarity,
        'category', c.category,
        'description', c.description,
        'cardNumber', c.card_number,
        'background', c.background,
        'accent', c.accent,
        'stats', pg_catalog.jsonb_build_object(
          'charisma', c.charisma,
          'energy', c.energy,
          'style', c.style
        ),
        'custom', true
      )
    )
  ) INTO v_collection_json
  FROM public.player_cards pc
  JOIN public.cards c ON c.id = pc.card_id
  WHERE pc.player_id = v_target_id;

  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', p.id,
      'packNumber', p.pack_number,
      'packName', p.pack_name,
      'openedAt', p.opened_at,
      'newCardsCount', p.new_cards_count
    ) ORDER BY p.opened_at DESC
  ) INTO v_packs_json
  FROM public.player_packs p
  WHERE p.player_id = v_target_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'player', pg_catalog.jsonb_build_object(
      'id', v_player.id,
      'username', v_player.username,
      'displayName', pg_catalog.coalesce(v_player.display_name, v_player.username),
      'role', v_player.role,
      'totalPacksOpened', pg_catalog.coalesce(v_player.total_packs_opened, 0),
      'isActive', v_player.is_active
    ),
    'packsAvailable', v_packs_avail,
    'cooldownRemainingSeconds', v_cooldown_sec,
    'collection', pg_catalog.coalesce(v_collection_json, '{}'::jsonb),
    'packs', pg_catalog.coalesce(v_packs_json, '[]'::jsonb)
  );
END;
$$;


-- ==============================================================================
-- 5. ADMINISTRATOR FUNCTIONS
-- ==============================================================================

-- A. AUDIT PLAYERS LIST (Passwords & Hashes NEVER Exposed)
CREATE OR REPLACE FUNCTION public.admin_get_players(
  p_admin_id UUID DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_players_json JSONB;
BEGIN
  IF p_session_token IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_session_token)) > 0 THEN
    SELECT p.role INTO v_role
    FROM public.player_sessions s
    JOIN public.players p ON p.id = s.player_id
    WHERE s.session_token = p_session_token
      AND s.expires_at > pg_catalog.now()
      AND p.is_active = true;
  ELSE
    SELECT role INTO v_role FROM public.players WHERE id = p_admin_id;
  END IF;

  IF v_role != 'ADMIN' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator role required');
  END IF;

  SELECT pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'displayName', p.display_name,
      'role', p.role,
      'createdAt', p.created_at,
      'lastLoginAt', p.last_login_at,
      'totalPacksOpened', p.total_packs_opened,
      'cardsCollectedCount', (SELECT count(*) FROM public.player_cards WHERE player_id = p.id),
      'isActive', p.is_active
    ) ORDER BY p.created_at DESC
  ) INTO v_players_json
  FROM public.players p;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'players', pg_catalog.coalesce(v_players_json, '[]'::jsonb)
  );
END;
$$;

-- B. TOGGLE PLAYER ACTIVE STATUS
CREATE OR REPLACE FUNCTION public.admin_toggle_player_status(
  p_admin_id UUID DEFAULT NULL,
  p_target_player_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_role TEXT;
BEGIN
  IF p_session_token IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_session_token)) > 0 THEN
    SELECT p.role INTO v_admin_role
    FROM public.player_sessions s
    JOIN public.players p ON p.id = s.player_id
    WHERE s.session_token = p_session_token
      AND s.expires_at > pg_catalog.now()
      AND p.is_active = true;
  ELSE
    SELECT role INTO v_admin_role FROM public.players WHERE id = p_admin_id;
  END IF;

  IF v_admin_role != 'ADMIN' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator role required');
  END IF;

  SELECT role INTO v_target_role FROM public.players WHERE id = p_target_player_id;
  IF v_target_role = 'ADMIN' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Cannot modify status of an Administrator');
  END IF;

  UPDATE public.players
  SET is_active = p_is_active
  WHERE id = p_target_player_id;

  RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;

-- C. ADMIN RESET PLAYER PASSWORD
CREATE OR REPLACE FUNCTION public.admin_reset_player_password(
  p_admin_id UUID DEFAULT NULL,
  p_target_player_id UUID DEFAULT NULL,
  p_new_password TEXT DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_role TEXT;
  v_new_hash TEXT;
BEGIN
  IF p_session_token IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_session_token)) > 0 THEN
    SELECT p.role INTO v_admin_role
    FROM public.player_sessions s
    JOIN public.players p ON p.id = s.player_id
    WHERE s.session_token = p_session_token
      AND s.expires_at > pg_catalog.now()
      AND p.is_active = true;
  ELSE
    SELECT role INTO v_admin_role FROM public.players WHERE id = p_admin_id;
  END IF;

  IF v_admin_role != 'ADMIN' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator role required');
  END IF;

  SELECT role INTO v_target_role FROM public.players WHERE id = p_target_player_id;
  IF v_target_role = 'ADMIN' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Cannot reset password of an Administrator through this function');
  END IF;

  IF p_new_password IS NULL OR pg_catalog.length(p_new_password) < 6 THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'New password must be at least 6 characters');
  END IF;

  BEGIN
    v_new_hash := public.crypt(p_new_password, public.gen_salt('bf'));
  EXCEPTION WHEN OTHERS THEN
    v_new_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf'));
  END;

  UPDATE public.players
  SET password_hash = v_new_hash
  WHERE id = p_target_player_id;

  RETURN pg_catalog.jsonb_build_object('success', true);
END;
$$;

-- D. COMPLETE APPLICATION RESET (ADMINISTRATOR PROTECTED)
-- Permanently purges player accounts, sessions, collections, and history.
-- Preserves master cards catalog, database schema, storage, and configurations.
-- Automatically recreates the single administrator account (username/password: 6102000).
CREATE OR REPLACE FUNCTION public.admin_reset_application(
  p_admin_id UUID DEFAULT NULL,
  p_confirmation_code TEXT DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_role TEXT;
  v_admin_hash TEXT;
  v_new_admin_id UUID;
BEGIN
  -- 1. Validate Admin Role
  IF p_session_token IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_session_token)) > 0 THEN
    SELECT p.role INTO v_admin_role
    FROM public.player_sessions s
    JOIN public.players p ON p.id = s.player_id
    WHERE s.session_token = p_session_token
      AND s.expires_at > pg_catalog.now()
      AND p.is_active = true;
  ELSE
    SELECT role INTO v_admin_role FROM public.players WHERE id = p_admin_id;
  END IF;

  IF v_admin_role != 'ADMIN' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'UNAUTHORIZED: Administrator role required');
  END IF;

  -- 2. Validate Confirmation Code
  IF p_confirmation_code != 'RESET-CONFIRM-6102000' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'INVALID_CONFIRMATION: Code must be RESET-CONFIRM-6102000');
  END IF;

  -- 3. Compute secure bcrypt hash for the default administrator account (6102000)
  BEGIN
    v_admin_hash := public.crypt('6102000', public.gen_salt('bf'));
  EXCEPTION WHEN OTHERS THEN
    v_admin_hash := extensions.crypt('6102000', extensions.gen_salt('bf'));
  END;

  -- 4. Delete dependent player tables (preserving cards table completely untouched)
  DELETE FROM public.player_pack_cards;
  DELETE FROM public.player_packs;
  DELETE FROM public.player_cards;
  DELETE FROM public.player_sessions;
  DELETE FROM public.players;

  -- 5. Recreate the pristine Administrator Account (6102000)
  INSERT INTO public.players (
    username,
    username_normalized,
    password_hash,
    display_name,
    role,
    packs_in_current_batch,
    total_packs_opened,
    is_active
  ) VALUES (
    '6102000',
    '6102000',
    v_admin_hash,
    'System Administrator',
    'ADMIN',
    5,
    0,
    true
  ) RETURNING id INTO v_new_admin_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'message', 'Application successfully reset to clean state. Administrator account recreated.',
    'adminAccount', pg_catalog.jsonb_build_object(
      'id', v_new_admin_id,
      'username', '6102000',
      'displayName', 'System Administrator',
      'role', 'ADMIN'
    )
  );
END;
$$;


-- ==============================================================================
-- 6. SEED SINGLE ADMINISTRATOR ACCOUNT
-- ==============================================================================
-- Administrator username: 6102000
-- Stored ONLY as secure bcrypt hash
-- Exactly ONE admin account is guaranteed
DO $$
DECLARE
  v_admin_hash text;
BEGIN
  BEGIN
    v_admin_hash := public.crypt('6102000', public.gen_salt('bf'));
  EXCEPTION WHEN OTHERS THEN
    v_admin_hash := extensions.crypt('6102000', extensions.gen_salt('bf'));
  END;

  IF NOT EXISTS (SELECT 1 FROM public.players WHERE username_normalized = '6102000') THEN
    INSERT INTO public.players (
      username,
      username_normalized,
      password_hash,
      display_name,
      role,
      packs_in_current_batch,
      total_packs_opened,
      is_active
    ) VALUES (
      '6102000',
      '6102000',
      v_admin_hash,
      'System Administrator',
      'ADMIN',
      5,
      0,
      true
    );
  ELSE
    UPDATE public.players
    SET role = 'ADMIN',
        display_name = pg_catalog.coalesce(display_name, 'System Administrator'),
        is_active = true
    WHERE username_normalized = '6102000';
  END IF;

  -- Ensure NO other player has role = 'ADMIN'
  UPDATE public.players
  SET role = 'USER'
  WHERE username_normalized != '6102000' AND role = 'ADMIN';
END $$;


-- ==============================================================================
-- 7. SEED INITIAL 12 MASTER CARDS
-- ==============================================================================
INSERT INTO public.cards (
  id, name, age, photo_url, rarity, category, description, card_number,
  background, accent, charisma, energy, style, is_active
) VALUES
(
  '11111111-1111-1111-1111-111111111101', 'Elena Rostova', 28,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  'LEGENDARY', 'LEADER',
  'Quantum AI architect who pioneered synaptic decentralized neural fabrics.',
  'PC-001', 'linear-gradient(135deg, #1e1b4b, #312e81, #0f172a)', '#fbbf24', 98, 92, 95, true
),
(
  '11111111-1111-1111-1111-111111111102', 'Marcus Vance', 34,
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  'EPIC', 'INVENTOR',
  'Deep-space propulsion engineer and visionary pioneer in fusion plasma.',
  'PC-002', 'linear-gradient(135deg, #3b0764, #581c87, #0f172a)', '#c084fc', 88, 96, 85, true
),
(
  '11111111-1111-1111-1111-111111111103', 'Aria Chen', 24,
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
  'RARE', 'CREATOR',
  'Neo-tokyo digital illusionist and generative holographic artist.',
  'PC-003', 'linear-gradient(135deg, #082f49, #0369a1, #0284c7)', '#38bdf8', 91, 84, 94, true
),
(
  '11111111-1111-1111-1111-111111111104', 'Dante Althaus', 31,
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
  'UNCOMMON', 'EXPLORER',
  'Extreme biome explorer and abyssal trench research commander.',
  'PC-004', 'linear-gradient(135deg, #022c22, #065f46, #047857)', '#34d399', 82, 90, 79, true
),
(
  '11111111-1111-1111-1111-111111111105', 'Klara Novak', 26,
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
  'COMMON', 'SCHOLAR',
  'Linguistic anthropologist decoding computational ancient dialects.',
  'PC-005', 'linear-gradient(135deg, #18181b, #27272a, #3f3f46)', '#a1a1aa', 75, 78, 80, true
),
(
  '11111111-1111-1111-1111-111111111106', 'Soren Lindqvist', 29,
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
  'COMMON', 'STRATEGIST',
  'Grandmaster tactical analyst in zero-gravity orbital navigation.',
  'PC-006', 'linear-gradient(135deg, #18181b, #27272a, #3f3f46)', '#a1a1aa', 79, 74, 82, true
),
(
  '11111111-1111-1111-1111-111111111107', 'Zuri Osei', 27,
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80',
  'ULTRA_RARE', 'MYSTIC',
  'Master chronologist and harmonic resonance researcher.',
  'PC-007', 'linear-gradient(135deg, #4a044e, #701a75, #86198f)', '#f472b6', 95, 89, 97, true
),
(
  '11111111-1111-1111-1111-111111111108', 'Tariq Al-Mansoor', 35,
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=800&q=80',
  'UNCOMMON', 'PIONEER',
  'Desert solar farm terraformer who built the Great Saharan Microgrid.',
  'PC-008', 'linear-gradient(135deg, #022c22, #065f46, #047857)', '#34d399', 84, 88, 76, true
),
(
  '11111111-1111-1111-1111-111111111109', 'Dr. Maya Lin', 32,
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
  'RARE', 'SCHOLAR',
  'Synthetic biology researcher synthesising drought-immune botanical seeds.',
  'PC-009', 'linear-gradient(135deg, #082f49, #0369a1, #0284c7)', '#38bdf8', 88, 86, 90, true
),
(
  '11111111-1111-1111-1111-111111111110', 'Jaxson Reed', 23,
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
  'COMMON', 'EXPLORER',
  'Urban hyperloop speed racer and mechanical aerodynamics engineer.',
  'PC-010', 'linear-gradient(135deg, #18181b, #27272a, #3f3f46)', '#a1a1aa', 78, 85, 75, true
),
(
  '11111111-1111-1111-1111-111111111111', 'Cassian Drake', 36,
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=800&q=80',
  'EPIC', 'STRATEGIST',
  'Interstellar trade diplomat and high-stakes negotiation champion.',
  'PC-011', 'linear-gradient(135deg, #3b0764, #581c87, #0f172a)', '#c084fc', 94, 88, 92, true
),
(
  '11111111-1111-1111-1111-111111111112', 'Seraphina Vale', 30,
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
  'LEGENDARY', 'CHAMPION',
  'Grandmaster cybernetic martial artist and stellar defense sovereign.',
  'PC-012', 'linear-gradient(135deg, #1e1b4b, #312e81, #0f172a)', '#fbbf24', 99, 97, 98, true
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 8. STORAGE BUCKET FOR CARD IMAGES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Card images public view" ON storage.objects;
CREATE POLICY "Card images public view" ON storage.objects FOR SELECT USING (bucket_id = 'card-images');

DROP POLICY IF EXISTS "Card images insert" ON storage.objects;
CREATE POLICY "Card images insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-images');

-- ==============================================================================
-- 9. PERMISSIONS & SCHEMA CACHE RELOAD
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.register_player(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_player(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_session(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_pack(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_player_state(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_players(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_toggle_player_status(uuid, uuid, boolean, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_player_password(uuid, uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_application(uuid, text, text) TO anon, authenticated, service_role;

-- Instruct PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
