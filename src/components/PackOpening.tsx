import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PersonCard } from '../types';
import { CardBack } from './CardBack';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import { Sparkles, FastForward } from 'lucide-react';

interface PackOpeningProps {
  cards: PersonCard[];
  onComplete: () => void;
  reducedMotion?: boolean;
}

export const PackOpening: React.FC<PackOpeningProps> = ({
  cards,
  onComplete,
  reducedMotion = false,
}) => {
  // Sequence stages:
  // 'zoom_in' (0-700ms)
  // 'shake' (700-1400ms)
  // 'tear' (1400-2200ms)
  // 'burst' (2200-3000ms)
  // 'cards_emerge' (3000-4000ms)
  const [stage, setStage] = useState<'zoom_in' | 'shake' | 'tear' | 'burst' | 'cards_emerge'>('zoom_in');
  const [tearProgress, setTearProgress] = useState(0);
  const timerRef = useRef<number[]>([]);

  const cleanupTimers = () => {
    timerRef.current.forEach((id) => clearTimeout(id));
    timerRef.current = [];
  };

  const handleSkip = () => {
    cleanupTimers();
    soundManager.playCardFlip();
    onComplete();
  };

  useEffect(() => {
    if (reducedMotion) {
      handleSkip();
      return;
    }

    // Step 1 & 2: Zoom in
    timerRef.current.push(
      window.setTimeout(() => {
        setStage('shake');
        soundManager.playPackShake();
      }, 700)
    );

    // Step 3 & 4: Tear begins
    timerRef.current.push(
      window.setTimeout(() => {
        setStage('tear');
        setTearProgress(1);
        soundManager.playPackTear();
      }, 1400)
    );

    // Step 5 & 6: Light burst & sparkles
    timerRef.current.push(
      window.setTimeout(() => {
        setStage('burst');
        soundManager.playPackOpening();

        // Confetti burst from center
        try {
          confetti({
            particleCount: 75,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#60a5fa', '#c084fc', '#fbbf24', '#ffffff', '#34d399'],
          });
        } catch {}
      }, 2300)
    );

    // Step 7 & 8: 5 cards emerge and stack
    timerRef.current.push(
      window.setTimeout(() => {
        setStage('cards_emerge');
      }, 3100)
    );

    // Step 9: Transition to card reveal screen
    timerRef.current.push(
      window.setTimeout(() => {
        onComplete();
      }, 4300)
    );

    return cleanupTimers;
  }, [reducedMotion]);

  return (
    <div
      id="pack-opening-modal"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl select-none overflow-hidden"
    >
      {/* Skip Button */}
      <button
        id="skip-pack-opening-btn"
        onClick={handleSkip}
        className="absolute top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-bold tracking-wider text-neutral-300 hover:text-white transition-all cursor-pointer backdrop-blur-md"
      >
        <span>SKIP</span>
        <FastForward className="w-3.5 h-3.5" />
      </button>

      {/* Atmospheric Backlight */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0.3 }}
          animate={{
            scale: stage === 'burst' || stage === 'cards_emerge' ? 2.5 : stage === 'shake' ? 1.2 : 1,
            opacity: stage === 'burst' ? 1 : 0.4,
          }}
          transition={{ duration: 0.6 }}
          className="w-96 h-96 rounded-full bg-gradient-to-tr from-sky-500/40 via-indigo-600/40 to-amber-400/30 blur-3xl"
        />
      </div>

      {/* Flash overlay during burst */}
      <AnimatePresence>
        {stage === 'burst' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Center Stage Animation */}
      <div className="relative flex flex-col items-center justify-center">
        {stage !== 'cards_emerge' ? (
          /* THE PACK ANIMATION */
          <motion.div
            animate={
              stage === 'shake'
                ? {
                    x: [-4, 5, -5, 4, -3, 3, 0],
                    y: [-2, 2, -1, 3, -2, 1, 0],
                    scale: 1.15,
                    rotate: [-1, 1, -1.5, 1, 0],
                  }
                : stage === 'tear'
                ? {
                    scale: 1.2,
                    y: 10,
                  }
                : stage === 'burst'
                ? {
                    scale: 1.35,
                    opacity: [1, 0.4, 0],
                  }
                : {
                    scale: [0.9, 1.1],
                  }
            }
            transition={{
              duration: stage === 'shake' ? 0.7 : stage === 'tear' ? 0.8 : 0.6,
              ease: 'easeInOut',
            }}
            className="relative w-64 h-[380px] sm:w-72 sm:h-[430px] rounded-2xl p-1 bg-gradient-to-b from-slate-800 via-indigo-950 to-black border-2 border-indigo-500/50 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Top foil cap (tears away during 'tear' stage) */}
            <motion.div
              animate={
                stage === 'tear' || stage === 'burst'
                  ? {
                      y: -80,
                      rotate: -12,
                      opacity: 0,
                    }
                  : { y: 0 }
              }
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative z-20 h-16 w-full rounded-t-xl bg-gradient-to-b from-slate-700 via-slate-600 to-slate-800 border-b-2 border-sky-400 p-2 flex flex-col items-center justify-center overflow-hidden"
            >
              <div className="w-8 h-1.5 rounded-full bg-black/60 border border-white/20 mb-1" />
              <span className="text-[10px] font-mono tracking-widest text-slate-300 font-bold">
                SEALED PACK
              </span>

              {/* Glowing tear ray */}
              {stage === 'tear' && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-sky-300 shadow-[0_0_15px_#38bdf8] animate-pulse" />
              )}
            </motion.div>

            {/* Middle Pack Body */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 text-center">
              <div className="w-16 h-16 rounded-xl rotate-45 border border-indigo-400/60 bg-indigo-900/40 flex items-center justify-center mb-3">
                <Sparkles className="w-8 h-8 text-sky-300 -rotate-45" />
              </div>
              <h2 className="text-2xl font-black tracking-widest text-white uppercase font-serif">
                PERSON
              </h2>
              <span className="text-xs font-bold tracking-[0.3em] text-indigo-300 uppercase">
                COLLECTION
              </span>
              <div className="mt-4 px-3 py-1 rounded bg-black/60 text-xs font-mono text-sky-400 font-bold">
                5 CARDS
              </div>
            </div>

            {/* Bottom foil cap */}
            <div className="relative z-10 h-6 w-full rounded-b-xl bg-gradient-to-r from-slate-800 via-slate-600 to-slate-900 border-t border-white/10" />
          </motion.div>
        ) : (
          /* 5 CARDS FLYING OUT AND STACKING */
          <div className="relative w-64 h-[380px] sm:w-72 sm:h-[430px] flex items-center justify-center">
            {cards.map((card, idx) => (
              <motion.div
                key={card.id + idx}
                initial={{
                  scale: 0.4,
                  y: 120,
                  opacity: 0,
                  rotate: (idx - 2) * 15,
                }}
                animate={{
                  scale: 1,
                  y: idx * -4,
                  opacity: 1,
                  rotate: (idx - 2) * 2,
                }}
                transition={{
                  duration: 0.6,
                  delay: idx * 0.1,
                  ease: 'backOut',
                }}
                className="absolute inset-0"
              >
                <CardBack />
              </motion.div>
            ))}
          </div>
        )}

        {/* Status text subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-center"
        >
          <div className="text-lg font-serif font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-sky-300 uppercase">
            {stage === 'zoom_in' && 'PREPARING BOOSTER...'}
            {stage === 'shake' && 'RELEASING ENERGY...'}
            {stage === 'tear' && 'OPENING PACK...'}
            {stage === 'burst' && 'UNLEASHING DISCOVERIES!'}
            {stage === 'cards_emerge' && '5 PERSON CARDS REVEALED!'}
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Get ready to inspect your fresh pull
          </p>
        </motion.div>
      </div>
    </div>
  );
};
