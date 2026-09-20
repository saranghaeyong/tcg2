import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActiveTab,
  AppSettings,
  CollectedCard,
  PackHistoryItem,
  PersonCard,
  UserProfile,
} from './types';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ParticleCanvas } from './components/ParticleCanvas';
import { PackOpening } from './components/PackOpening';
import { CardReveal } from './components/CardReveal';
import { PackComplete } from './components/PackComplete';
import { CardModal } from './components/CardModal';
import { AdminAddCardModal } from './components/AdminAddCardModal';
import { AuthModal } from './components/AuthModal';
import { WelcomeModal } from './components/WelcomeModal';
import { CooldownModal } from './components/CooldownModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';

import { Home } from './pages/Home';
import { Collection } from './pages/Collection';
import { Packs } from './pages/Packs';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';

import {
  addCardsToCollection,
  getAllAvailableCards,
  getStoredCollection,
  getStoredPackHistory,
  getStoredProfile,
  resetEntireCollection,
  updateStoredProfile,
  fetchUserCollectionFromSupabase,
  fetchUserPacksFromSupabase,
  fetchCardsCatalogFromSupabase,
} from './utils/storage';
import { openPackAtomic, getSavedSession } from './utils/playerEngine';
import { PackType } from './utils/packGenerator';
import { soundManager } from './utils/audio';

export default function App() {
  const {
    player,
    isAdmin,
    isConfigured,
    cooldown,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    dismissWelcomeModal,
    updatePlayerState,
  } = useAuth();

  // Navigation & Game Mode State
  const [activeTab, setActiveTab] = useState<ActiveTab>('HOME');
  const [gameMode, setGameMode] = useState<
    'IDLE' | 'OPENING_ANIMATION' | 'CARD_REVEAL' | 'PACK_COMPLETE'
  >('IDLE');
  const [currentPackCards, setCurrentPackCards] = useState<PersonCard[]>([]);
  const [activePackType, setActivePackType] = useState<PackType>('STANDARD');

  // Persistence State
  const [collection, setCollection] = useState<Record<string, CollectedCard>>({});
  // Tracks which authenticated player the currently displayed collection belongs to.
  // This prevents the navbar from briefly showing the previous player's card count
  // during the login -> cloud-state loading transition.
  const [collectionOwnerId, setCollectionOwnerId] = useState<string | null>(null);
  const [packHistory, setPackHistory] = useState<PackHistoryItem[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [masterCards, setMasterCards] = useState<PersonCard[]>([]);
  const [isRefreshingCards, setIsRefreshingCards] = useState(false);
  const refreshingCardsRef = React.useRef(false);

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    soundEnabled: soundManager.getSoundEnabled(),
    musicEnabled: soundManager.getMusicEnabled(),
    masterVolume: soundManager.getMasterVolume(),
    musicVolume: soundManager.getMusicVolume(),
    reducedMotion: false,
  });

  // Modals & Overlays
  const [selectedModalCard, setSelectedModalCard] = useState<CollectedCard | null>(null);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isCooldownModalOpen, setIsCooldownModalOpen] = useState(false);
  const [burstTrigger, setBurstTrigger] = useState(0);
  const [burstType, setBurstType] = useState<'legendary' | 'epic' | 'gold'>('gold');

  // Refresh master catalog of cards from Supabase or fallback
  const refreshMasterCards = useCallback(async () => {
    if (refreshingCardsRef.current) return;

    refreshingCardsRef.current = true;
    setIsRefreshingCards(true);
    try {
      if (isConfigured) {
        const dbCards = await fetchCardsCatalogFromSupabase();
        if (dbCards.length > 0) {
          setMasterCards(dbCards);
          return;
        }
      }
      setMasterCards(getAllAvailableCards());
    } finally {
      refreshingCardsRef.current = false;
      setIsRefreshingCards(false);
    }
  }, [isConfigured]);

  // Load user data on mount and whenever player changes
  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      refreshMasterCards();

      // Never let the previous player/guest state remain visible while a new
      // player's authoritative state is loading. This was causing a brand-new
      // account to briefly inherit another account's 5 cards / pack state.
      if (isMounted) {
        setCollection({});
        setCollectionOwnerId(null);
        setPackHistory([]);
        setProfile(getStoredProfile(player?.id));
      }

      if (player && isConfigured) {
        // Supabase is authoritative. Do not fall back to guest/previous-player
        // localStorage while loading a cloud account.
        const token = getSavedSession().token;
        const [cloudCollection, cloudPacks] = await Promise.all([
          fetchUserCollectionFromSupabase(player.id, token),
          fetchUserPacksFromSupabase(player.id),
        ]);

        if (isMounted) {
          setCollection(cloudCollection);
          setCollectionOwnerId(player.id);
          setPackHistory(cloudPacks);
        }
      } else if (player) {
        // Local mode is still scoped strictly to the current player ID.
        if (isMounted) {
          setCollection(getStoredCollection(player.id));
          setCollectionOwnerId(player.id);
          setPackHistory(getStoredPackHistory(player.id));
          setProfile(getStoredProfile(player.id));
        }
      }
    }

    loadUserData();

    // Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSettings((prev) => ({ ...prev, reducedMotion: true }));
    }

    return () => {
      isMounted = false;
    };
  }, [player, isConfigured, refreshMasterCards]);

  // Total Catalog Count including custom minted cards
  const totalCatalogCount = useMemo(() => {
    return masterCards.length > 0 ? masterCards.length : getAllAvailableCards().length;
  }, [masterCards]);

  // Set of known card IDs in user's collection
  const knownCardIds = useMemo(() => {
    return new Set(Object.keys(collection));
  }, [collection]);

  // Fallback if non-admin tries to remain on ADMIN tab
  useEffect(() => {
    if (activeTab === 'ADMIN' && !isAdmin) {
      setActiveTab('HOME');
    }
  }, [activeTab, isAdmin]);

  // Handle role-based redirection on player login & clean state reset on sign out
  const loggedInPlayerIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (player && player.id !== loggedInPlayerIdRef.current) {
      loggedInPlayerIdRef.current = player.id;
      if (player.role === 'ADMIN') {
        setActiveTab('ADMIN');
      } else {
        setActiveTab('HOME');
      }
    } else if (!player) {
      loggedInPlayerIdRef.current = null;
      // When signed out: clear temporary game, pack opening, card reveal, and active modal UI states
      setGameMode('IDLE');
      setCurrentPackCards([]);
      setSelectedModalCard(null);
      setIsCooldownModalOpen(false);
      setActiveTab('HOME');
    }
  }, [player]);

  // Start Pack Opening sequence
  const startPackOpening = useCallback(
    async (packType: PackType = 'STANDARD') => {
      // 1. Must be logged in to open packs
      if (!player) {
        openAuthModal('LOGIN');
        return;
      }

      // 2. Check 1-hour cooldown
      if (cooldown.isCooldownActive || cooldown.packsAvailable <= 0) {
        setIsCooldownModalOpen(true);
        return;
      }

      soundManager.init();
      setActivePackType(packType);

      // 3. Atomically open pack through Player Engine
      const result = await openPackAtomic(player, packType);

      if (!result.success) {
        if (result.cooldown.isCooldownActive) {
          updatePlayerState(result.updatedPlayer, result.cooldown);
          setIsCooldownModalOpen(true);
        }
        return;
      }

      // Update player state in context
      updatePlayerState(result.updatedPlayer, result.cooldown);

      const cards = result.cards;
      setCurrentPackCards(cards);

      // open_pack() has already committed the 5 cards to Supabase.
      // Refresh the authoritative collection immediately so the Collection tab
      // is correct even before the user clicks "Add to Collection".
      if (isConfigured) {
        try {
          const { token } = getSavedSession();
          const cloudCollection = await fetchUserCollectionFromSupabase(player.id, token);
          setCollection(cloudCollection);

          const cloudPacks = await fetchUserPacksFromSupabase(player.id);
          if (cloudPacks.length > 0) setPackHistory(cloudPacks);
        } catch (e) {
          console.warn('Could not refresh cloud collection after pack opening:', e);
        }
      }

      // Record pack to local history only when Supabase is not configured.
      // In Supabase mode, open_pack() has already persisted the pack and the
      // cloud history refresh above is authoritative. Adding a synthetic local
      // item here would duplicate the just-opened pack.
      if (!isConfigured) {
        const historyItem: PackHistoryItem = {
          id: `pack-${Date.now()}`,
          packNumber: (packHistory[0]?.packNumber || 0) + 1,
          packName:
            packType === 'LEGENDARY_TEST'
              ? 'Celestial Sovereign Pack'
              : packType === 'GOD_PACK'
              ? 'All-Star God Pack'
              : packType === 'HIGH_ROLLER'
              ? 'Neon High-Roller Pack'
              : 'Person Booster Pack',
          openedAt: new Date().toISOString(),
          cards,
          newCardsCount: result.newCardsCount,
        };

        setPackHistory((prev) => [historyItem, ...prev]);
      }

      // Check for high rarities for particle celebration
      const hasLegendary = cards.some((c) => c.rarity === 'LEGENDARY');
      const hasEpic = cards.some((c) => c.rarity === 'EPIC' || c.rarity === 'ULTRA_RARE');

      if (hasLegendary) {
        setBurstType('legendary');
      } else if (hasEpic) {
        setBurstType('epic');
      } else {
        setBurstType('gold');
      }

      setGameMode('OPENING_ANIMATION');
    },
    [
      player,
      cooldown,
      packHistory,
      isConfigured,
      openAuthModal,
      updatePlayerState,
    ]
  );

  // When pack animation finishes -> go to Card Reveal
  const handlePackAnimationComplete = useCallback(() => {
    setGameMode('CARD_REVEAL');
  }, []);

  // When user completes revealing all 5 cards -> go to Pack Complete fan screen
  const handleFinishCardReveal = useCallback(() => {
    setGameMode('PACK_COMPLETE');
  }, []);

  // Add 5 cards to persistent collection & update history
  const handleAddToCollection = useCallback(async () => {
    if (currentPackCards.length === 0) return;

    // IMPORTANT: open_pack() already persisted the pack and collection atomically.
    // Do not write the same cards again from the browser, otherwise copies can be doubled.
    if (player && isConfigured) {
      const { token } = getSavedSession();
      const cloudCollection = await fetchUserCollectionFromSupabase(player.id, token);
      setCollection(cloudCollection);
    } else {
      const { updatedCollection } = addCardsToCollection(currentPackCards, player?.id);
      setCollection({ ...updatedCollection });
    }

    // Profile is derived from authoritative player/collection state.
    const totalCopies = Object.values(collection).reduce((sum, item) => sum + item.copies, 0) + (player && isConfigured ? 0 : currentPackCards.length);
    const updatedProfile = updateStoredProfile({
      packsOpened: player?.totalPacksOpened ?? profile.packsOpened + 1,
      totalCardsCollected: totalCopies,
      level: Math.floor((player?.totalPacksOpened ?? profile.packsOpened + 1) / 3) + 1,
    }, player?.id);
    setProfile(updatedProfile);

    // Trigger celebratory background particle burst
    setBurstTrigger((prev) => prev + 1);

    // If Supabase is connected, sync authoritative state
    if (player && isConfigured) {
      try {
        const [cloudCollection, cloudPacks] = await Promise.all([
          fetchUserCollectionFromSupabase(player.id, getSavedSession().token),
          fetchUserPacksFromSupabase(player.id),
        ]);
        if (Object.keys(cloudCollection).length > 0) {
          setCollection(cloudCollection);
        }
        if (cloudPacks.length > 0) {
          setPackHistory(cloudPacks);
        }
      } catch (e) {
        console.warn('Syncing collection after pack opening error:', e);
      }
    }
  }, [currentPackCards, profile, player, isConfigured]);

  // Reset entire collection
  const handleResetCollection = useCallback(() => {
    resetEntireCollection(player?.id);
    setCollection({});
    setPackHistory([]);
    setProfile(getStoredProfile());
    soundManager.playButtonClick();
  }, [player]);

  // New card added from Admin Modal
  const handleCustomCardAdded = useCallback(
  async (newCard: PersonCard) => {
    addCardsToCollection([newCard], player?.id);
    setCollection(getStoredCollection(player?.id));

    // Immediately add the newly created card to the Admin catalog UI
    setMasterCards((prev) => {
      const withoutDuplicate = prev.filter((card) => card.id !== newCard.id);
      return [newCard, ...withoutDuplicate];
    });

    // Then sync the complete catalog from Supabase
    await refreshMasterCards();

    setBurstTrigger((prev) => prev + 1);
  },
  [player, refreshMasterCards]
);

  return (
    <div className="relative min-h-screen w-full bg-[#07080d] text-neutral-100 flex flex-col font-sans overflow-x-hidden selection:bg-sky-500 selection:text-black">
      {/* Background Particle Canvas */}
      <ParticleCanvas
        burstTrigger={burstTrigger}
        burstType={burstType}
        reducedMotion={settings.reducedMotion}
      />

      {/* Primary Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setGameMode('IDLE');
        }}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => {
          const next = !settings.soundEnabled;
          soundManager.setSoundEnabled(next);
          setSettings((prev) => ({ ...prev, soundEnabled: next }));
        }}
        musicEnabled={settings.musicEnabled}
        onToggleMusic={() => {
          const next = !settings.musicEnabled;
          soundManager.setMusicEnabled(next);
          setSettings((prev) => ({ ...prev, musicEnabled: next }));
        }}
        onOpenAddCard={() => setIsAddCardModalOpen(true)}
        onOpenAuth={() => openAuthModal('LOGIN')}
        onOpenSetup={() => setIsSetupModalOpen(true)}
        totalCollectedCount={player && collectionOwnerId === player.id ? Object.keys(collection).length : 0}
      />

      {/* Main Viewport Container */}
      <main className="relative z-10 flex-1 pt-14 md:pt-16 pb-16 md:pb-6 flex flex-col items-center">
        {/* GAMEPLAY OVERLAYS / VIEWS */}
        {gameMode === 'OPENING_ANIMATION' && (
          <PackOpening
            cards={currentPackCards}
            onComplete={handlePackAnimationComplete}
            reducedMotion={settings.reducedMotion}
          />
        )}

        {gameMode === 'CARD_REVEAL' && (
          <CardReveal
            cards={currentPackCards}
            knownCardIds={knownCardIds}
            onFinishPack={handleFinishCardReveal}
            reducedMotion={settings.reducedMotion}
          />
        )}

        {gameMode === 'PACK_COMPLETE' && (
          <PackComplete
            cards={currentPackCards}
            knownCardIds={knownCardIds}
            onAddToCollection={handleAddToCollection}
            onOpenAnother={() => startPackOpening(activePackType)}
            onViewCollection={() => {
              setGameMode('IDLE');
              setActiveTab('COLLECTION');
            }}
          />
        )}

        {/* REGULAR TAB PAGES (When not in active pack opening) */}
        {gameMode === 'IDLE' && (
          <>
            {activeTab === 'HOME' && (
              <Home
                onOpenPack={() => startPackOpening('STANDARD')}
                collection={collection}
                packsOpened={player?.totalPacksOpened ?? profile.packsOpened}
                totalUniqueCards={Object.keys(collection).length}
                totalCatalogCount={totalCatalogCount}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onSelectCard={(c) => setSelectedModalCard(c)}
              />
            )}

            {activeTab === 'COLLECTION' && (
              <Collection
                collection={collection}
                packsOpened={player?.totalPacksOpened ?? profile.packsOpened}
                totalCatalogCount={totalCatalogCount}
                onOpenFirstPack={() => startPackOpening('STANDARD')}
                onSelectCard={(c) => setSelectedModalCard(c)}
              />
            )}

            {activeTab === 'PACKS' && (
              <Packs
                onOpenSpecificPack={(pType) => startPackOpening(pType)}
                packHistory={packHistory}
              />
            )}

            {activeTab === 'PROFILE' && (
              <Profile
                profile={profile}
                collection={collection}
                totalCatalogCount={totalCatalogCount}
                onOpenAuth={() => openAuthModal('LOGIN')}
                onOpenSetup={() => setIsSetupModalOpen(true)}
              />
            )}

            {activeTab === 'SETTINGS' && (
              <Settings
                settings={settings}
                onUpdateSettings={(newVals) =>
                  setSettings((prev) => ({ ...prev, ...newVals }))
                }
                onResetCollection={handleResetCollection}
                onOpenAddCard={() => setIsAddCardModalOpen(true)}
                onOpenSetup={() => setIsSetupModalOpen(true)}
              />
            )}

            {activeTab === 'ADMIN' && isAdmin && (
              <AdminPanel
                cards={masterCards}
                onRefreshCards={refreshMasterCards}
                isRefreshingCards={isRefreshingCards}
                onOpenCreateModal={() => setIsAddCardModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* --- DETAIL MODAL FOR INSPECTING A CARD --- */}
      {selectedModalCard && (
        <CardModal
          collectedCard={selectedModalCard}
          allCollected={Object.values(collection)}
          onClose={() => setSelectedModalCard(null)}
          onSelectCard={(card) => setSelectedModalCard(card)}
        />
      )}

      {/* --- ADMIN ADD CUSTOM CARD MODAL --- */}
      {isAddCardModalOpen && (
        <AdminAddCardModal
          onClose={() => setIsAddCardModalOpen(false)}
          onCardAdded={handleCustomCardAdded}
        />
      )}

      {/* --- AUTH MODAL (LOGIN / REGISTER WITH USERNAME + PASSWORD) --- */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onOpenSetup={() => setIsSetupModalOpen(true)}
      />

      {/* --- WELCOME ONBOARDING MODAL --- */}
      <WelcomeModal
        onOpenFirstPack={() => {
          dismissWelcomeModal();
          startPackOpening('STANDARD');
        }}
        totalUniqueCards={Object.keys(collection).length}
        totalCatalogCount={totalCatalogCount}
      />

      {/* --- 1-HOUR PACK COOLDOWN MODAL --- */}
      <CooldownModal
        isOpen={isCooldownModalOpen}
        onClose={() => setIsCooldownModalOpen(false)}
        onNavigateTab={(tab) => {
          setIsCooldownModalOpen(false);
          setActiveTab(tab);
        }}
      />

      {/* --- SUPABASE SETUP & CREDENTIALS MODAL --- */}
      <SupabaseSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onConnected={refreshMasterCards}
      />
    </div>
  );
}
