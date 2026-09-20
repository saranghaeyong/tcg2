import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PersonCard } from '../types';
import { Card } from './Card';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Sparkles, Layers, RotateCcw, Check } from 'lucide-react';

interface PackCompleteProps {
  cards: PersonCard[];
  knownCardIds: Set<string>;
  onAddToCollection: () => void;
  onOpenAnother: () => void;
  onViewCollection: () => void;
}

export const PackComplete: React.FC<PackCompleteProps> = ({
  cards,
  knownCardIds,
  onAddToCollection,
  onOpenAnother,
  onViewCollection,
}) => {
  const [isAdded, setIsAdded] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PersonCard | null>(null);

  const newCardsCount = cards.filter((c) => !knownCardIds.has(c.id)).length;

  const handleAddCards = () => {
    soundManager.playCollectionAdded();
    setIsAdded(true);
    onAddToCollection();

    try {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#c084fc', '#fbbf24', '#34d399', '#ffffff'],
      });
    } catch {}
  };

  // Rotation angles for 5-card fan arrangement: [-16, -8, 0, 8, 16]
  const fanRotations = [-16, -8, 0, 8, 16];
  const fanXOffsets = [-140, -70, 0, 70, 140];

  return (
    <div
      id="pack-complete-screen"
      className="relative min-h-[92dvh] w-full flex flex-col items-center justify-between py-6 px-4 select-none overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-sky-600/25 via-purple-600/25 to-amber-500/20 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mt-2">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-xs font-mono font-bold tracking-widest text-indigo-300 mb-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>BOOSTER PACK UNSEALED</span>
        </motion.div>

        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-4xl font-black font-serif tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-white to-indigo-200 uppercase"
        >
          PACK COMPLETE
        </motion.h1>

        <p className="text-xs sm:text-sm font-mono text-neutral-300 mt-1">
          {newCardsCount > 0 ? (
            <span className="text-emerald-400 font-bold">
              {newCardsCount} NEW DISCOVERIES ADDED
            </span>
          ) : (
            <span className="text-amber-400 font-bold">
              5 COLLECTED CARDS (UPGRADED COPIES)
            </span>
          )}
        </p>
      </div>

      {/* --- 5-CARD FAN ARRANGEMENT --- */}
      <div className="relative z-20 my-auto w-full max-w-4xl h-[420px] flex items-center justify-center">
        {/* Desktop & Tablet Fan Display */}
        <div className="hidden sm:flex items-center justify-center relative w-full h-full">
          {cards.map((card, idx) => (
            <motion.div
              key={card.id + idx}
              initial={{ y: 150, opacity: 0, rotate: 0 }}
              animate={
                isAdded
                  ? {
                      y: -200,
                      x: 250,
                      scale: 0.15,
                      opacity: 0,
                    }
                  : {
                      y: Math.abs(fanRotations[idx]) * 1.5,
                      x: fanXOffsets[idx] * 1.2,
                      rotate: fanRotations[idx],
                      opacity: 1,
                    }
              }
              transition={{
                duration: isAdded ? 0.6 : 0.7,
                delay: isAdded ? idx * 0.05 : idx * 0.08,
                ease: 'backOut',
              }}
              whileHover={{
                scale: 1.15,
                zIndex: 40,
                y: -30,
                rotate: 0,
                transition: { duration: 0.2 },
              }}
              onClick={() => setSelectedCard(card)}
              className="absolute cursor-pointer will-change-transform"
              style={{ zIndex: 10 + idx }}
            >
              <Card
                card={card}
                isNew={!knownCardIds.has(card.id)}
                size="sm"
                interactiveTilt={false}
              />
            </motion.div>
          ))}
        </div>

        {/* Mobile Horizontal Scroll Grid */}
        <div className="sm:hidden flex items-center gap-3 overflow-x-auto p-4 w-full snap-x snap-mandatory">
          {cards.map((card, idx) => (
            <div
              key={card.id + idx}
              onClick={() => setSelectedCard(card)}
              className="shrink-0 snap-center"
            >
              <Card
                card={card}
                isNew={!knownCardIds.has(card.id)}
                size="sm"
                interactiveTilt={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* --- ACTIONS --- */}
      <div className="relative z-30 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pb-4">
        {!isAdded ? (
          <button
            id="add-to-collection-btn"
            onClick={handleAddCards}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black font-serif tracking-widest text-sm uppercase shadow-xl shadow-emerald-500/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>ADD TO COLLECTION</span>
          </button>
        ) : (
          <div className="w-full flex flex-col sm:flex-row items-center gap-3">
            <button
              id="view-collection-btn"
              onClick={onViewCollection}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs font-mono tracking-widest uppercase transition-all shadow-lg shadow-sky-500/30 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>VIEW COLLECTION</span>
            </button>

            <button
              id="open-another-pack-btn"
              onClick={onOpenAnother}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs font-mono tracking-widest uppercase transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>OPEN ANOTHER PACK</span>
            </button>
          </div>
        )}
      </div>

      {/* Inspection Modal for clicked card in the fan */}
      {selectedCard && (
        <div
          id="preview-card-modal"
          onClick={() => setSelectedCard(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-4"
          >
            <Card card={selectedCard} size="lg" interactiveTilt={true} />
            <button
              onClick={() => setSelectedCard(null)}
              className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-bold text-white"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
