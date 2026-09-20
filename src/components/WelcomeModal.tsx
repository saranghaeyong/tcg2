import React from 'react';
import { useAuth } from '../context/AuthContext';
import { soundManager } from '../utils/audio';
import { Sparkles, Package, Shield, ArrowRight, Layers, Clock } from 'lucide-react';

interface WelcomeModalProps {
  onOpenFirstPack: () => void;
  totalUniqueCards: number;
  totalCatalogCount: number;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  onOpenFirstPack,
  totalUniqueCards,
  totalCatalogCount,
}) => {
  const { welcomeModalState, dismissWelcomeModal, player, cooldown } = useAuth();

  if (welcomeModalState === 'NONE' || !player) {
    return null;
  }

  const isNewPlayer = welcomeModalState === 'NEW_PLAYER';

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      id="welcome-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg p-4 select-none animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl bg-neutral-950 border border-indigo-500/30 p-6 sm:p-10 shadow-2xl shadow-indigo-950/50 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Background Radial Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-to-b from-indigo-500/30 via-sky-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Top Badge */}
        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-xs font-mono font-bold tracking-widest text-indigo-300 mb-4 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>{isNewPlayer ? 'NEW COLLECTOR' : 'SERIES 1 ARCHIVE'}</span>
        </div>

        {/* Title */}
        <h2 className="relative z-10 text-2xl sm:text-4xl font-black font-serif tracking-[0.12em] text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-300 uppercase">
          {isNewPlayer
            ? 'WELCOME TO PERSON CARD COLLECTION'
            : `WELCOME BACK, ${player.displayName || player.username}`}
        </h2>

        {/* Subtitle */}
        <p className="relative z-10 text-sm font-sans text-neutral-300 mt-2 max-w-sm">
          {isNewPlayer
            ? 'Your collection journey begins now. Crack open booster packs and discover legendary cards.'
            : 'Your card vault, booster allowances, and achievements have been restored.'}
        </p>

        {/* Stat Grid */}
        <div className="relative z-10 w-full grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
          {/* Packs Available */}
          <div className="flex flex-col items-center p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
              <Package className="w-3.5 h-3.5 text-sky-400" />
              <span>Packs Available</span>
            </div>
            <div className="text-2xl font-black font-mono text-sky-400">
              {cooldown.packsAvailable}{' '}
              <span className="text-xs text-neutral-400 font-normal">/ 5</span>
            </div>
          </div>

          {/* Cards Collected */}
          <div className="flex flex-col items-center p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cards Vault</span>
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {totalUniqueCards}{' '}
              <span className="text-xs text-neutral-400 font-normal">/ {totalCatalogCount}</span>
            </div>
          </div>

          {/* Cooldown Status / Batch */}
          <div className="col-span-2 sm:col-span-1 flex flex-col items-center p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Cooldown</span>
            </div>
            <div className="text-lg sm:text-xl font-black font-mono text-amber-400">
              {cooldown.isCooldownActive
                ? formatSeconds(cooldown.cooldownRemainingSeconds)
                : 'Ready (1 hr limit)'}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {isNewPlayer ? (
          <button
            id="open-first-pack-welcome-btn"
            onClick={() => {
              soundManager.playButtonClick();
              dismissWelcomeModal();
              onOpenFirstPack();
            }}
            className="relative z-10 w-full py-4 rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 hover:from-sky-300 hover:to-purple-400 text-slate-950 font-black font-serif tracking-[0.2em] text-sm uppercase shadow-xl shadow-indigo-500/30 hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2.5"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>OPEN YOUR FIRST PACK</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        ) : (
          <button
            id="continue-journey-welcome-btn"
            onClick={() => {
              soundManager.playButtonClick();
              dismissWelcomeModal();
            }}
            className="relative z-10 w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-bold font-serif tracking-[0.18em] text-sm uppercase shadow-xl shadow-indigo-600/30 hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2.5"
          >
            <span>CONTINUE JOURNEY</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </div>
  );
};
