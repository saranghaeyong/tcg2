import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PersonCard } from '../types';
import { Card } from './Card';
import { CardBack } from './CardBack';
import { getRarityDetails } from '../data/rarity';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  CheckCircle,
  Crown,
  FastForward,
} from 'lucide-react';

interface CardRevealProps {
  cards: PersonCard[];
  knownCardIds: Set<string>;
  onFinishPack: (revealedCards: PersonCard[]) => void;
  reducedMotion?: boolean;
}

export const CardReveal: React.FC<CardRevealProps> = ({
  cards,
  knownCardIds,
  onFinishPack,
  reducedMotion = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});
  const [isFlipping, setIsFlipping] = useState(false);
  const [specialEffectActive, setSpecialEffectActive] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const currentCard = cards[currentIndex];
  const isCurrentRevealed = !!revealedMap[currentIndex];
  const isAlreadyCollected = knownCardIds.has(currentCard.id);
  const rarityInfo = getRarityDetails(currentCard.rarity);
  const isHighRarity = ['RARE', 'EPIC', 'ULTRA_RARE', 'LEGENDARY'].includes(currentCard.rarity);
  const isLegendary = currentCard.rarity === 'LEGENDARY';

  const triggerReveal = useCallback(() => {
    if (isCurrentRevealed || isFlipping) return;
    setIsFlipping(true);

    // Play initial card flip audio
    soundManager.playCardFlip();

    // Rarity reveal fanfare at apex of flip (~350ms)
    setTimeout(() => {
      setRevealedMap((prev) => ({ ...prev, [currentIndex]: true }));
      soundManager.playRarityReveal(currentCard.rarity);

      if (isHighRarity) {
        setSpecialEffectActive(true);
        setTimeout(() => setSpecialEffectActive(false), 2400);

        try {
          if (isLegendary) {
            confetti({
              particleCount: 100,
              spread: 120,
              origin: { y: 0.6 },
              colors: ['#fbbf24', '#f59e0b', '#ffffff', '#eab308'],
            });
          } else {
            confetti({
              particleCount: 40,
              spread: 70,
              origin: { y: 0.6 },
              colors: [rarityInfo.color, '#ffffff'],
            });
          }
        } catch {}
      }

      setIsFlipping(false);
    }, 450);
  }, [currentIndex, currentCard, isCurrentRevealed, isFlipping, isHighRarity, isLegendary, rarityInfo.color]);

  const handleNext = useCallback(() => {
    if (!isCurrentRevealed) {
      triggerReveal();
      return;
    }

    if (currentIndex < cards.length - 1) {
      soundManager.playCardSwipe();
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all 5 cards!
      soundManager.playPackComplete();
      onFinishPack(cards);
    }
  }, [currentIndex, cards, isCurrentRevealed, triggerReveal, onFinishPack]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      soundManager.playCardSwipe();
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const revealAllAndSkip = () => {
    soundManager.playPackOpening();
    const allRevealed: Record<number, boolean> = {};
    cards.forEach((_, idx) => {
      allRevealed[idx] = true;
    });
    setRevealedMap(allRevealed);
    onFinishPack(cards);
  };

  // Keyboard navigation: ArrowLeft, ArrowRight, Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isCurrentRevealed) {
          triggerReveal();
        } else {
          handleNext();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (isCurrentRevealed) {
          handleNext();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCurrentRevealed, triggerReveal, handleNext, handlePrev]);

  // Touch swipe support (left/right/up)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Upward swipe triggers reveal if not yet flipped
    if (deltaY < -50 && !isCurrentRevealed) {
      triggerReveal();
    } else if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) {
        // Swipe left -> Next
        if (isCurrentRevealed) handleNext();
      } else {
        // Swipe right -> Prev
        handlePrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      id="card-reveal-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-[92dvh] w-full flex flex-col items-center justify-between py-6 px-4 select-none overflow-hidden"
    >
      {/* Dim overlay for Rare / Legendary special reveals */}
      <AnimatePresence>
        {specialEffectActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isLegendary ? 0.85 : 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-20 pointer-events-none bg-black/90 backdrop-blur-xs"
          />
        )}
      </AnimatePresence>

      {/* Radial aura behind current card */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          className="w-[480px] h-[480px] rounded-full blur-3xl transition-all duration-700 opacity-40"
          style={{
            backgroundColor: isCurrentRevealed ? rarityInfo.color : '#6366f1',
            transform: specialEffectActive ? 'scale(1.4)' : 'scale(1)',
          }}
        />
      </div>

      {/* --- TOP HEADER: CARD X OF 5 + SKIP --- */}
      <div className="relative z-30 w-full max-w-lg flex items-center justify-between">
        {/* Progress pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-mono font-bold text-neutral-200">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>
            CARD {currentIndex + 1} OF {cards.length}
          </span>
        </div>

        {/* 5 Dots Indicator */}
        <div className="flex items-center gap-1.5">
          {cards.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-6 bg-sky-400 shadow-sm shadow-sky-400/80'
                  : revealedMap[idx]
                  ? 'w-2 bg-emerald-400'
                  : 'w-2 bg-neutral-600'
              }`}
            />
          ))}
        </div>

        {/* Skip to complete */}
        <button
          id="reveal-all-skip-btn"
          onClick={revealAllAndSkip}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-mono text-neutral-300 transition-all cursor-pointer"
        >
          <span>REVEAL ALL</span>
          <FastForward className="w-3 h-3" />
        </button>
      </div>

      {/* --- CENTER: THE 3D CARD CONTAINER --- */}
      <div className="relative z-30 my-auto flex flex-col items-center justify-center">
        {/* Legendary announcement banner overlay */}
        <AnimatePresence>
          {specialEffectActive && isLegendary && (
            <motion.div
              initial={{ scale: 0.5, y: -40, opacity: 0 }}
              animate={{ scale: 1.1, y: -20, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute -top-14 z-50 flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-black font-serif tracking-[0.25em] text-sm uppercase shadow-2xl shadow-amber-400/80"
            >
              <Crown className="w-4 h-4 fill-black" />
              <span>LEGENDARY PULL!</span>
              <Crown className="w-4 h-4 fill-black" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Perspective Card Flipper */}
        <div
          id="flipper-container"
          onClick={!isCurrentRevealed ? triggerReveal : undefined}
          className="relative perspective-1200 cursor-pointer"
        >
          <motion.div
            animate={{
              rotateY: isCurrentRevealed ? 0 : 180,
              scale: isFlipping ? 1.08 : 1,
            }}
            transition={{
              duration: reducedMotion ? 0.1 : 0.75,
              ease: [0.23, 1, 0.32, 1],
            }}
            className="transform-style-3d relative flex items-center justify-center"
          >
            {/* CARD FRONT (Visible when rotateY = 0) */}
            <div className="backface-hidden">
              <Card
                card={currentCard}
                isNew={!isAlreadyCollected}
                copies={isAlreadyCollected ? 2 : undefined}
                size="lg"
                interactiveTilt={true}
              />
            </div>

            {/* CARD BACK (Visible when rotateY = 180) */}
            <div
              className="absolute inset-0 backface-hidden"
              style={{ transform: 'rotateY(180deg)' }}
            >
              <div className="w-72 h-[430px] sm:w-80 sm:h-[480px]">
                <CardBack />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Interactive Prompt below card */}
        <div className="mt-4 text-center">
          {!isCurrentRevealed ? (
            <motion.button
              id="click-to-reveal-btn"
              onClick={triggerReveal}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600 hover:from-indigo-400 hover:to-sky-400 text-white font-extrabold text-sm font-serif tracking-widest uppercase shadow-lg shadow-sky-500/30 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>CLICK TO REVEAL</span>
            </motion.button>
          ) : (
            <div className="flex items-center gap-3">
              {!isAlreadyCollected ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>NEW DISCOVERY ADDED TO COLLECTION</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>DUPLICATE CARD (+1 COPY)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="relative z-30 w-full max-w-lg flex items-center justify-between pt-2">
        {/* PREVIOUS BUTTON */}
        <button
          id="reveal-prev-btn"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all ${
            currentIndex === 0
              ? 'opacity-30 cursor-not-allowed bg-white/5 text-neutral-500'
              : 'bg-white/10 hover:bg-white/20 text-white cursor-pointer border border-white/15'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>PREVIOUS</span>
        </button>

        {/* REVEAL / NEXT BUTTON */}
        {!isCurrentRevealed ? (
          <button
            id="reveal-current-btn"
            onClick={triggerReveal}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-extrabold text-xs font-mono tracking-widest uppercase transition-all shadow-lg shadow-sky-500/30 cursor-pointer"
          >
            <span>REVEAL</span>
            <Eye className="w-4 h-4" />
          </button>
        ) : (
          <button
            id="reveal-next-btn"
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-black text-xs font-mono tracking-widest uppercase transition-all shadow-lg shadow-sky-500/30 cursor-pointer"
          >
            <span>{currentIndex === cards.length - 1 ? 'PACK COMPLETE' : 'NEXT CARD'}</span>
            <ChevronRight className="w-4 h-4 text-black" />
          </button>
        )}
      </div>
    </div>
  );
};
