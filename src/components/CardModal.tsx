import React, { useEffect } from 'react';
import { CollectedCard } from '../types';
import { Card } from './Card';
import { getRarityDetails } from '../data/rarity';
import { soundManager } from '../utils/audio';
import { X, ChevronLeft, ChevronRight, Calendar, Layers, ShieldCheck } from 'lucide-react';

interface CardModalProps {
  collectedCard: CollectedCard;
  allCollected: CollectedCard[];
  onClose: () => void;
  onSelectCard: (card: CollectedCard) => void;
}

export const CardModal: React.FC<CardModalProps> = ({
  collectedCard,
  allCollected,
  onClose,
  onSelectCard,
}) => {
  const currentIndex = allCollected.findIndex((c) => c.cardId === collectedCard.cardId);
  const { card, copies, firstDiscoveredAt, lastDiscoveredAt } = collectedCard;
  const rarityInfo = getRarityDetails(card.rarity);

  const handlePrev = () => {
    if (currentIndex > 0) {
      soundManager.playCardSwipe();
      onSelectCard(allCollected[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allCollected.length - 1) {
      soundManager.playCardSwipe();
      onSelectCard(allCollected[currentIndex + 1]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, allCollected]);

  const formattedDate = firstDiscoveredAt
    ? new Date(firstDiscoveredAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Recently';

  return (
    <div
      id="card-detail-modal"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 select-none overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-3xl bg-neutral-950/90 border border-white/15 p-6 shadow-2xl flex flex-col md:flex-row items-center gap-8"
        style={{
          boxShadow: `0 25px 60px -15px rgba(0,0,0,0.9), 0 0 30px ${rarityInfo.glowColor}`,
        }}
      >
        {/* Close Button */}
        <button
          id="close-card-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Card Rendering with 3D Tilt */}
        <div className="shrink-0 flex items-center justify-center">
          <Card card={card} copies={copies} size="lg" interactiveTilt={true} />
        </div>

        {/* Right: Detailed Metadata and Lore */}
        <div className="flex-1 flex flex-col justify-between self-stretch">
          <div>
            {/* Header info */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-extrabold text-neutral-400">
                {card.cardNumber}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-widest border"
                style={{
                  backgroundColor: `${rarityInfo.color}22`,
                  borderColor: `${rarityInfo.color}66`,
                  color: rarityInfo.color,
                }}
              >
                {rarityInfo.label}
              </span>
              <span className="text-xs font-mono text-neutral-400">
                • {card.category}
              </span>
            </div>

            <h2 className="text-3xl font-black font-serif uppercase tracking-wide text-white">
              {card.name}
            </h2>
            <div className="text-sm font-mono text-sky-400 mt-0.5">
              Age {card.age} • Earth Origin
            </div>

            {/* Biography */}
            <div className="mt-4 p-3.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider block mb-1">
                Subject Dossier
              </span>
              <p className="text-sm text-neutral-200 leading-relaxed italic font-sans">
                "{card.description}"
              </p>
            </div>

            {/* Detailed Stats */}
            <div className="mt-4 space-y-2">
              <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider block">
                Combat & Social Attributes
              </span>

              {/* Charisma */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold">Charisma (CHR)</span>
                  <span className="text-white font-bold">{card.stats.charisma} / 100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full"
                    style={{ width: `${card.stats.charisma}%` }}
                  />
                </div>
              </div>

              {/* Energy */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-sky-400 font-bold">Energy (NRG)</span>
                  <span className="text-white font-bold">{card.stats.energy} / 100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 rounded-full"
                    style={{ width: `${card.stats.energy}%` }}
                  />
                </div>
              </div>

              {/* Style */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-rose-400 font-bold">Style (STY)</span>
                  <span className="text-white font-bold">{card.stats.style} / 100</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-pink-300 rounded-full"
                    style={{ width: `${card.stats.style}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Collection Metadata */}
            <div className="mt-5 grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs font-mono">
              <div className="flex items-center gap-2 text-neutral-300">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>
                  Copies in Vault:{' '}
                  <strong className="text-white font-bold">{copies}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>
                  Discovered:{' '}
                  <strong className="text-white font-bold">{formattedDate}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Navigation controls (Previous / Next) */}
          <div className="mt-6 flex items-center justify-between pt-3 border-t border-white/10">
            <button
              id="card-modal-prev-btn"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all ${
                currentIndex <= 0
                  ? 'opacity-30 cursor-not-allowed bg-white/5 text-neutral-500'
                  : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer border border-white/15'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>PREVIOUS</span>
            </button>

            <span className="text-xs font-mono text-neutral-400">
              {currentIndex + 1} of {allCollected.length}
            </span>

            <button
              id="card-modal-next-btn"
              onClick={handleNext}
              disabled={currentIndex >= allCollected.length - 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all ${
                currentIndex >= allCollected.length - 1
                  ? 'opacity-30 cursor-not-allowed bg-white/5 text-neutral-500'
                  : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer border border-white/15'
              }`}
            >
              <span>NEXT</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
