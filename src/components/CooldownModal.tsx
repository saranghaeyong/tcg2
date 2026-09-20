import React from 'react';
import { useAuth } from '../context/AuthContext';
import { soundManager } from '../utils/audio';
import { Clock, Shield, Layers, Package, X, Sparkles } from 'lucide-react';

interface CooldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'COLLECTION' | 'PACKS') => void;
}

export const CooldownModal: React.FC<CooldownModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { cooldown } = useAuth();

  if (!isOpen) return null;

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

  const progressPercent = Math.min(
    100,
    Math.max(0, ((3600 - cooldown.cooldownRemainingSeconds) / 3600) * 100)
  );

  return (
    <div
      id="cooldown-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-amber-500/30 p-6 sm:p-8 shadow-2xl shadow-amber-950/40 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Close Button */}
        <button
          id="close-cooldown-modal-btn"
          onClick={() => {
            soundManager.playButtonClick();
            onClose();
          }}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-gradient-to-b from-amber-500/20 via-orange-500/5 to-transparent blur-3xl pointer-events-none" />

        {/* Icon Badge */}
        <div className="relative z-10 w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          <Clock className="w-7 h-7 text-amber-400 animate-pulse" />
        </div>

        {/* Title */}
        <h3 className="relative z-10 text-2xl font-black font-serif tracking-[0.15em] text-white uppercase">
          PACKS COMPLETE
        </h3>

        {/* Subtitle */}
        <p className="relative z-10 text-sm font-sans text-neutral-300 mt-2 max-w-xs">
          You’ve opened all 5 available packs in this batch.
        </p>

        {/* Countdown Box */}
        <div className="relative z-10 w-full my-6 p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 font-bold mb-2">
            NEXT 5 PACKS UNLOCK IN
          </span>

          <div className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-amber-400 text-glow-amber mb-3">
            {formatTimer(cooldown.cooldownRemainingSeconds)}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-white/10">
            <div
              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="w-full flex justify-between text-[10px] font-mono text-neutral-400 mt-2">
            <span>Cooldown Active</span>
            <span>{Math.round(progressPercent)}% Charged</span>
          </div>
        </div>

        <p className="relative z-10 text-xs font-sans text-neutral-400 mb-6 max-w-xs">
          Browse your card vault, inspect foils, or review your pack drop history while your next batch charges!
        </p>

        {/* Navigation Action Buttons */}
        <div className="relative z-10 w-full grid grid-cols-2 gap-3">
          <button
            id="cooldown-view-collection-btn"
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
              onNavigateTab('COLLECTION');
            }}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-sky-400" />
            <span>COLLECTION</span>
          </button>

          <button
            id="cooldown-view-history-btn"
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
              onNavigateTab('PACKS');
            }}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Package className="w-4 h-4 text-indigo-400" />
            <span>PACK HISTORY</span>
          </button>
        </div>
      </div>
    </div>
  );
};
