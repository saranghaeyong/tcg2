import React, { useState, useRef } from 'react';
import { Sparkles, Shield, Compass, Star } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface BoosterPackProps {
  onOpen: () => void;
  packName?: string;
  badge?: string;
  theme?: string;
  disabled?: boolean;
}

export const BoosterPack: React.FC<BoosterPackProps> = ({
  onOpen,
  packName = 'PERSON PACK',
  badge = 'LIMITED EDITION',
  theme = 'metallic-silver',
  disabled = false,
}) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const packRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!packRef.current) return;
    const rect = packRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -14;
    const rotY = ((x - centerX) / centerX) * 14;

    setRotateX(rotX);
    setRotateY(rotY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    soundManager.playPackHover();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const handleClick = () => {
    if (disabled) return;
    soundManager.playPackClick();
    onOpen();
  };

  return (
    <div
      ref={packRef}
      id="booster-pack-wrapper"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative cursor-pointer select-none transition-transform duration-300 ease-out will-change-transform"
      style={{
        transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${isHovered ? 1.04 : 1})`,
      }}
    >
      {/* Dynamic Ambient Backlight Glow */}
      <div
        className={`absolute -inset-6 rounded-3xl opacity-60 blur-2xl transition-all duration-500 pointer-events-none ${
          isHovered
            ? 'opacity-90 bg-gradient-to-tr from-sky-600 via-indigo-500 to-amber-400 scale-105'
            : 'bg-gradient-to-tr from-indigo-700/50 via-sky-800/40 to-blue-900/30'
        }`}
      />

      {/* Sealed Booster Foil Package Container */}
      <div
        className="relative w-72 h-[440px] sm:w-80 sm:h-[480px] rounded-2xl overflow-hidden p-1 shadow-2xl flex flex-col justify-between"
        style={{
          boxShadow: isHovered
            ? '0 25px 60px -12px rgba(0,0,0,0.9), 0 0 35px rgba(99,102,241,0.5)'
            : '0 20px 40px -10px rgba(0,0,0,0.85)',
          background:
            'linear-gradient(145deg, #1e293b 0%, #0f172a 40%, #020617 100%)',
        }}
      >
        {/* Crimped Metallic Teeth at TOP (Sealed Trading Pack look) */}
        <div className="relative z-20 h-5 w-full bg-gradient-to-r from-slate-700 via-slate-500 to-slate-800 flex items-center justify-center border-b border-white/20 shadow-sm overflow-hidden">
          <div
            className="w-full h-full opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #111 0px, #111 2px, transparent 2px, transparent 6px)',
            }}
          />
          {/* Subtle hanging hole punch tab */}
          <div className="absolute top-1 w-10 h-2 rounded-full bg-black/60 border border-white/20" />
        </div>

        {/* Moving Metallic Foil Sweep Reflection */}
        <div className="absolute -inset-full z-10 pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-25 animate-foil-sweep" />

        {/* Main Pack Body Surface */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-5 bg-gradient-to-b from-slate-900/90 via-indigo-950/80 to-slate-950 border-x border-white/10">
          {/* Subtle Holographic Grid Pattern */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Top Badge */}
          <div className="relative z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-[10px] font-mono font-bold tracking-widest text-indigo-300">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>{badge}</span>
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          </div>

          {/* Center Logo & Title */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto">
            {/* Original Abstract Geometric Emblem */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-3">
              <div className="absolute inset-0 rounded-full border border-indigo-400/40 animate-pulse-glow" />
              <div className="absolute inset-2 rounded-full border border-dashed border-sky-400/60" />
              <div className="w-20 h-20 rounded-2xl rotate-45 bg-gradient-to-tr from-indigo-600 via-sky-500 to-indigo-900 p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center -rotate-45">
                  <Compass className="w-10 h-10 text-sky-300 animate-[spin_30s_linear_infinite]" />
                  <Shield className="w-5 h-5 text-indigo-400 absolute" />
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-black tracking-[0.2em] font-serif text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 drop-shadow-md uppercase">
              PERSON
            </h1>
            <div className="text-sm font-extrabold tracking-[0.35em] text-indigo-300 uppercase mt-0.5">
              COLLECTION
            </div>

            {/* Sub-label */}
            <div className="mt-3 px-3 py-0.5 rounded bg-black/50 border border-white/10 text-xs font-mono font-bold text-sky-300 tracking-wider">
              5 CARDS INSIDE
            </div>
          </div>

          {/* Tear Line Guide (glows on hover) */}
          <div className="relative z-10 w-full flex items-center justify-center gap-2 py-1">
            <div className="flex-1 border-t border-dashed border-sky-400/50" />
            <span className="text-[9px] font-mono tracking-widest text-sky-300/80 uppercase font-bold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> TEAR TO OPEN
            </span>
            <div className="flex-1 border-t border-dashed border-sky-400/50" />
          </div>

          {/* Bottom Pack Footer */}
          <div className="relative z-10 w-full flex items-center justify-between pt-2 border-t border-white/10 text-[9px] font-mono text-slate-400">
            <span>OFFICIAL BOOSTER</span>
            <span className="text-indigo-400 font-bold">AGES 8+</span>
          </div>
        </div>

        {/* Crimped Metallic Teeth at BOTTOM */}
        <div className="relative z-20 h-5 w-full bg-gradient-to-r from-slate-800 via-slate-500 to-slate-700 flex items-center justify-center border-t border-white/20 shadow-inner overflow-hidden">
          <div
            className="w-full h-full opacity-60"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, #111 0px, #111 2px, transparent 2px, transparent 6px)',
            }}
          />
        </div>
      </div>

      {/* Interactive Helper Prompt */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xs text-xs font-semibold text-neutral-300 group-hover:border-sky-400/50 group-hover:text-white transition-all">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Click or Tap to Open Pack</span>
        </div>
      </div>
    </div>
  );
};
