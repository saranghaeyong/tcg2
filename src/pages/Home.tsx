import React, { useState } from 'react';
import { BoosterPack } from '../components/BoosterPack';
import { Card } from '../components/Card';
import { CollectedCard } from '../types';
import { useAuth } from '../context/AuthContext';
import { soundManager } from '../utils/audio';
import { CooldownModal } from '../components/CooldownModal';
import {
  Sparkles,
  Layers,
  Package,
  Flame,
  ArrowRight,
  Shield,
  Clock,
  Lock,
} from 'lucide-react';

interface HomeProps {
  onOpenPack: () => void;
  collection: Record<string, CollectedCard>;
  packsOpened: number;
  totalUniqueCards: number;
  totalCatalogCount: number;
  onNavigateTab: (tab: 'COLLECTION' | 'PACKS') => void;
  onSelectCard: (card: CollectedCard) => void;
}

export const Home: React.FC<HomeProps> = ({
  onOpenPack,
  collection,
  packsOpened,
  totalUniqueCards,
  totalCatalogCount,
  onNavigateTab,
  onSelectCard,
}) => {
  const { cooldown, player, openAuthModal } = useAuth();
  const [isCooldownModalOpen, setIsCooldownModalOpen] = useState(false);

  const collectedList = Object.values(collection);
  // Get recent 4 collected cards
  const recentCards = [...collectedList]
    .sort(
      (a, b) =>
        new Date(b.lastDiscoveredAt).getTime() - new Date(a.lastDiscoveredAt).getTime()
    )
    .slice(0, 4);

  const formatTimer = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePackClick = () => {
    if (!player) {
      soundManager.playButtonClick();
      openAuthModal('LOGIN');
      return;
    }

    if (cooldown.isCooldownActive || cooldown.packsAvailable <= 0) {
      soundManager.playCardFlip();
      setIsCooldownModalOpen(true);
      return;
    }

    soundManager.playPackClick();
    onOpenPack();
  };

  const packsAvail = cooldown.packsAvailable;
  const isCooldownActive = cooldown.isCooldownActive || packsAvail === 0;

  return (
    <div
      id="home-screen"
      className="relative min-h-[calc(100dvh-4rem)] w-full flex flex-col items-center justify-between py-6 px-4 select-none"
    >
      {/* Subtle Atmospheric Light Cone in background */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-b from-indigo-600/20 via-sky-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* --- HERO HEADER --- */}
      <div className="relative z-10 text-center max-w-2xl mt-2 sm:mt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-[11px] font-mono font-bold tracking-widest text-indigo-300 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>SERIES 1 • PERSON ARCHIVE</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black font-serif tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 uppercase drop-shadow-sm">
          COLLECT THEM ALL
        </h1>

        <p className="text-sm sm:text-base font-sans text-neutral-300 mt-2 max-w-lg mx-auto font-medium">
          Open packs. Discover people. Build your ultimate digital card collection.
        </p>

        {/* --- PACKS AVAILABLE METER & COOLDOWN STRIP --- */}
        <div className="mt-4 inline-flex flex-col items-center gap-2 p-3 rounded-2xl bg-neutral-950/70 border border-white/10 backdrop-blur-md shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              <Package className="w-4 h-4 text-sky-400" />
              <span>PACKS AVAILABLE:</span>
              <span
                className={`font-black text-sm ${
                  isCooldownActive ? 'text-amber-400' : 'text-sky-400'
                }`}
              >
                {packsAvail} / 5
              </span>
            </div>

            {/* 5 Indicator Pips */}
            <div className="flex items-center gap-1.5 ml-1">
              {[1, 2, 3, 4, 5].map((slot) => {
                const isFilled = slot <= packsAvail;
                return (
                  <div
                    key={slot}
                    className={`w-3.5 h-3.5 rounded-md border transition-all ${
                      isFilled
                        ? 'bg-sky-400 border-sky-300 shadow-sm shadow-sky-400/50 scale-100'
                        : 'bg-white/5 border-white/15 opacity-40 scale-95'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Cooldown live countdown if exhausted */}
          {isCooldownActive && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono animate-pulse">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                NEXT 5 PACKS IN:{' '}
                <strong className="font-mono tracking-wider font-bold">
                  {formatTimer(cooldown.cooldownRemainingSeconds)}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- CENTER BOOSTER PACK SHOWCASE --- */}
      <div className="relative z-20 my-6 sm:my-8 flex flex-col items-center justify-center animate-float">
        <div className="relative">
          <BoosterPack onOpen={handlePackClick} />

          {/* Lock Overlay if Cooldown is Active */}
          {isCooldownActive && (
            <div
              onClick={() => setIsCooldownModalOpen(true)}
              className="absolute inset-0 z-30 rounded-3xl bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-lg shadow-amber-500/20">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300">
                PACKS EXHAUSTED
              </span>
              <span className="text-[11px] font-mono text-neutral-300 mt-1">
                Cooldown: {formatTimer(cooldown.cooldownRemainingSeconds)}
              </span>
            </div>
          )}
        </div>

        {/* Primary Call To Action Button */}
        <div className="mt-6 flex flex-col items-center gap-2">
          {isCooldownActive ? (
            <button
              id="open-pack-cooldown-btn"
              onClick={() => {
                soundManager.playButtonClick();
                setIsCooldownModalOpen(true);
              }}
              className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-neutral-900 border border-amber-500/40 text-amber-400 hover:text-amber-300 font-bold font-serif tracking-[0.2em] text-xs sm:text-sm uppercase shadow-lg shadow-amber-950/40 hover:scale-102 active:scale-98 transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>COOLDOWN ACTIVE ({formatTimer(cooldown.cooldownRemainingSeconds)})</span>
            </button>
          ) : (
            <button
              id="open-pack-hero-btn"
              onClick={handlePackClick}
              className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 hover:from-sky-300 hover:to-purple-400 text-slate-950 font-black font-serif tracking-[0.2em] text-sm uppercase shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>OPEN BOOSTER PACK</span>
            </button>
          )}

          {!player && (
            <span className="text-[11px] font-mono text-neutral-400 mt-1">
              Sign in or create account to save your collection permanently
            </span>
          )}
        </div>
      </div>

      {/* --- STATS STRIP --- */}
      <div className="relative z-10 w-full max-w-3xl grid grid-cols-3 gap-3 p-3 rounded-2xl bg-neutral-950/60 border border-white/10 backdrop-blur-md mb-6">
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-sky-400" /> Unique Cards
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
            {totalUniqueCards}{' '}
            <span className="text-xs text-neutral-400 font-normal">/ {totalCatalogCount}</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
            <Package className="w-3.5 h-3.5 text-indigo-400" /> Packs Opened
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
            {player?.totalPacksOpened ?? packsOpened}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Vault Completion
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5">
            {totalCatalogCount > 0
              ? Math.round((totalUniqueCards / totalCatalogCount) * 100)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* --- RECENT PULLS STRIP (If user has collected cards) --- */}
      {recentCards.length > 0 && (
        <div className="relative z-10 w-full max-w-4xl pb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" /> Recently Discovered
            </span>
            <button
              onClick={() => onNavigateTab('COLLECTION')}
              className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-semibold"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentCards.map((c) => (
              <div
                key={c.cardId}
                onClick={() => onSelectCard(c)}
                className="cursor-pointer hover:scale-102 transition-transform"
              >
                <Card card={c.card} copies={c.copies} size="sm" interactiveTilt={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cooldown Info Modal */}
      <CooldownModal
        isOpen={isCooldownModalOpen}
        onClose={() => setIsCooldownModalOpen(false)}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
};
