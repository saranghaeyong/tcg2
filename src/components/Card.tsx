import React, { useState, useRef } from 'react';
import { PersonCard } from '../types';
import { getRarityDetails } from '../data/rarity';
import { Zap, Flame, Crown, Sparkles, User } from 'lucide-react';

interface CardProps {
  card: PersonCard;
  isNew?: boolean;
  copies?: number;
  interactiveTilt?: boolean;
  className?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  card,
  isNew = false,
  copies,
  interactiveTilt = true,
  className = '',
  onClick,
  size = 'md',
}) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [imageError, setImageError] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const rarityInfo = getRarityDetails(card.rarity);
  const isHighRarity = ['RARE', 'EPIC', 'ULTRA_RARE', 'LEGENDARY'].includes(card.rarity);
  const isLegendary = card.rarity === 'LEGENDARY';
  const isUltraRare = card.rarity === 'ULTRA_RARE';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactiveTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -12;
    const rotY = ((x - centerX) / centerX) * 12;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: isHighRarity ? 0.75 : 0.35,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  // Dimensions based on size
  const sizeClasses = {
    sm: 'w-44 h-[264px] text-xs',
    md: 'w-64 h-[380px] sm:w-72 sm:h-[420px] text-sm',
    lg: 'w-72 h-[430px] sm:w-80 sm:h-[480px] text-sm',
  };

  return (
    <div
      ref={cardRef}
      id={`card-${card.id}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative select-none cursor-pointer rounded-2xl p-[6px] transition-transform duration-200 ease-out will-change-transform ${sizeClasses[size]} ${className}`}
      style={{
        transform: interactiveTilt
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
          : undefined,
        boxShadow: `0 18px 36px -10px rgba(0,0,0,0.85), 0 0 24px ${rarityInfo.glowColor}`,
        background: `radial-gradient(circle at 50% 0%, ${rarityInfo.color}33, transparent 75%), #0c0e17`,
      }}
    >
      {/* Outer Card Metallic Border */}
      <div
        className={`relative h-full w-full rounded-xl border-2 flex flex-col justify-between overflow-hidden bg-gradient-to-b ${rarityInfo.bgGradient} ${rarityInfo.borderColor}`}
      >
        {/* Holographic Specular Glare Overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300"
          style={{
            opacity: glarePos.opacity,
            background: isLegendary
              ? `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(254,240,138,0.6) 0%, rgba(245,158,11,0.3) 30%, transparent 70%)`
              : isUltraRare
              ? `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.7) 0%, rgba(244,63,94,0.4) 25%, rgba(168,85,247,0.3) 50%, transparent 80%)`
              : `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.45) 0%, transparent 60%)`,
          }}
        />

        {/* Moving Holographic Rainbow Prismatic Lines for Ultra Rare / Legendary */}
        {(isUltraRare || isLegendary) && (
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-30 mix-blend-color-dodge animate-holographic"
            style={{
              backgroundImage:
                'linear-gradient(115deg, transparent 20%, rgba(255,0,128,0.4) 35%, rgba(0,255,255,0.4) 50%, rgba(255,255,0,0.4) 65%, transparent 80%)',
            }}
          />
        )}

        {/* Animated Foil Sweep for Rare+ */}
        {isHighRarity && (
          <div className="pointer-events-none absolute -inset-full z-20 bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-30 animate-foil-sweep" />
        )}

        {/* --- CARD HEADER --- */}
        <div className="relative z-10 flex items-center justify-between p-2.5 pb-1 border-b border-white/10 bg-black/40 backdrop-blur-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-extrabold tracking-wider text-neutral-300">
              {card.cardNumber}
            </span>
            {card.custom && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                CUSTOM
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border"
              style={{
                backgroundColor: `${rarityInfo.color}22`,
                borderColor: `${rarityInfo.color}66`,
                color: rarityInfo.color,
              }}
            >
              {rarityInfo.label}
            </span>
          </div>
        </div>

        {/* --- CARD PORTRAIT / PHOTO --- */}
        <div className="relative z-10 mx-2.5 my-1.5 flex-1 rounded-lg overflow-hidden border border-white/15 bg-neutral-900 shadow-inner group">
          {!imageError ? (
            <img
              src={card.photo}
              alt={card.name}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-indigo-950 p-4 text-center">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border border-white/20 mb-2">
                <User className="w-8 h-8 text-indigo-200" />
              </div>
              <span className="font-bold text-white tracking-wide text-sm">{card.name}</span>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase mt-0.5">
                {card.category}
              </span>
            </div>
          )}

          {/* Vignette & bottom shadow overlay on photo */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Category Pill floating at bottom of image */}
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs border border-white/20 text-[10px] font-semibold text-neutral-200 tracking-wider">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            <span>{card.category}</span>
          </div>

          {/* New / Duplicate Badges */}
          {isNew && (
            <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-black tracking-widest uppercase shadow-lg shadow-emerald-500/50 animate-bounce">
              NEW
            </div>
          )}
          {copies && copies > 1 && !isNew && (
            <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-amber-500/90 backdrop-blur-xs text-black text-[10px] font-extrabold tracking-wider shadow-lg">
              {copies} COPIES
            </div>
          )}
        </div>

        {/* --- CARD FOOTER & STATS --- */}
        <div className="relative z-10 p-2.5 pt-1 bg-black/60 backdrop-blur-sm border-t border-white/10 flex flex-col gap-1.5">
          {/* Person Name & Age */}
          <div className="flex items-baseline justify-between">
            <h3 className="font-extrabold tracking-wide text-base sm:text-lg text-white font-serif uppercase truncate">
              {card.name}
            </h3>
            <span className="font-mono text-xs font-semibold text-neutral-300">
              AGE {card.age}
            </span>
          </div>

          {/* Short Bio / Description */}
          {size !== 'sm' && (
            <p className="text-[11px] text-neutral-300 leading-tight line-clamp-2 italic font-sans opacity-90">
              "{card.description}"
            </p>
          )}

          {/* 3 RPG Stats: Charisma, Energy, Style */}
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/10 text-[10px] font-mono">
            <div className="flex flex-col items-center justify-center p-1 rounded bg-white/5 border border-white/5">
              <span className="flex items-center gap-0.5 text-neutral-400 text-[9px] uppercase tracking-wider">
                <Crown className="w-2.5 h-2.5 text-amber-400" /> CHR
              </span>
              <span className="font-bold text-white">{card.stats.charisma}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-1 rounded bg-white/5 border border-white/5">
              <span className="flex items-center gap-0.5 text-neutral-400 text-[9px] uppercase tracking-wider">
                <Zap className="w-2.5 h-2.5 text-sky-400" /> NRG
              </span>
              <span className="font-bold text-white">{card.stats.energy}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-1 rounded bg-white/5 border border-white/5">
              <span className="flex items-center gap-0.5 text-neutral-400 text-[9px] uppercase tracking-wider">
                <Flame className="w-2.5 h-2.5 text-rose-400" /> STY
              </span>
              <span className="font-bold text-white">{card.stats.style}</span>
            </div>
          </div>

          {/* Bottom Branding Tag */}
          <div className="flex items-center justify-between pt-0.5 text-[8px] font-mono text-neutral-400 tracking-widest">
            <span>PERSON COLLECTION</span>
            <span>EDITION 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
