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
import { openPackAtomic } from './utils/playerEngine';
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
  const [packHistory, setPackHistory] = useState<PackHistoryItem[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [masterCards, setMasterCards] = useState<PersonCard[]>([]);

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
    if (isConfigured) {
      const dbCards = await fetchCardsCatalogFromSupabase();
      if (dbCards.length > 0) {
        setMasterCards(dbCards);
        return;
      }
    }
    setMasterCards(getAllAvailableCards());
  }, [isConfigured]);

  // Load user data on mount and whenever player changes
  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      refreshMasterCards();

      if (player && isConfigured) {
        // Load cloud synchronized collection & packs
        const [cloudCollection, cloudPacks] = await Promise.all([
          fetchUserCollectionFromSupabase(player.id),
          fetchUserPacksFromSupabase(player.id),
        ]);

        if (isMounted) {
          setCollection(cloudCollection);
          setPackHistory(cloudPacks);
        }
      } else {
        // Fallback: local user scoped storage
        if (isMounted) {
          setCollection(getStoredCollection(player?.id));
          setPackHistory(getStoredPackHistory(player?.id));
          setProfile(getStoredProfile());
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

  // Handle role-based redirection on player login
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

      // Record pack to history
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

    // Update client-side / local storage
    const { updatedCollection } = addCardsToCollection(currentPackCards, player?.id);
    setCollection({ ...updatedCollection });

    // Update Profile Stats
    const updatedProfile = updateStoredProfile({
      packsOpened: profile.packsOpened + 1,
      totalCardsCollected: profile.totalCardsCollected + currentPackCards.length,
      level: Math.floor((profile.packsOpened + 1) / 3) + 1,
    });
    setProfile(updatedProfile);

    // Trigger celebratory background particle burst
    setBurstTrigger((prev) => prev + 1);
  }, [currentPackCards, profile, player]);

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
    (newCard: PersonCard) => {
      addCardsToCollection([newCard], player?.id);
      setCollection(getStoredCollection(player?.id));
      refreshMasterCards();
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
        totalCollectedCount={Object.keys(collection).length}
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
