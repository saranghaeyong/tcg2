import React, { useState } from 'react';
import { PackHistoryItem, PersonCard } from '../types';
import { AVAILABLE_PACKS, PackOption, PackType } from '../utils/packGenerator';
import { Card } from '../components/Card';
import { getRarityDetails } from '../data/rarity';
import { soundManager } from '../utils/audio';
import {
  Package,
  History,
  Sparkles,
  ChevronRight,
  X,
  Calendar,
  Layers,
  Crown,
  Zap,
} from 'lucide-react';

interface PacksProps {
  onOpenSpecificPack: (packType: PackType) => void;
  packHistory: PackHistoryItem[];
}

export const Packs: React.FC<PacksProps> = ({
  onOpenSpecificPack,
  packHistory,
}) => {
  const [inspectHistoryItem, setInspectHistoryItem] = useState<PackHistoryItem | null>(null);

  const handleSelectPack = (pack: PackOption) => {
    soundManager.playPackClick();
    onOpenSpecificPack(pack.id);
  };

  return (
    <div
      id="packs-screen"
      className="relative min-h-[calc(100dvh-4rem)] w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 select-none"
    >
      {/* Header */}
      <div className="mb-8 text-center max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-mono font-bold tracking-widest text-indigo-300 mb-2">
          <Package className="w-3 h-3 text-sky-400" />
          <span>BOOSTER DISPENSER</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black font-serif uppercase tracking-widest text-white">
          BOOSTER VAULT
        </h1>
        <p className="text-xs sm:text-sm font-sans text-neutral-400 mt-1">
          Select standard or specialty packs to experience every rarity tier.
        </p>
      </div>

      {/* --- PACK CARDS RACK --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
        {AVAILABLE_PACKS.map((pack) => (
          <div
            key={pack.id}
            onClick={() => handleSelectPack(pack)}
            className="group relative rounded-2xl p-5 bg-gradient-to-b from-slate-900 via-neutral-950 to-slate-950 border border-white/15 hover:border-sky-400/60 transition-all duration-300 shadow-xl hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient hover glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div>
              {/* Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest uppercase bg-white/10 text-neutral-300 border border-white/10">
                  {pack.badge}
                </span>
                <span className="text-[10px] font-mono text-sky-400 font-bold">5 CARDS</span>
              </div>

              {/* Graphic pack icon */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-900 to-slate-800 border border-indigo-400/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {pack.id === 'LEGENDARY_TEST' ? (
                  <Crown className="w-7 h-7 text-amber-400" />
                ) : pack.id === 'HIGH_ROLLER' ? (
                  <Zap className="w-7 h-7 text-purple-400" />
                ) : (
                  <Package className="w-7 h-7 text-sky-400" />
                )}
              </div>

              <h2 className="text-lg font-black font-serif uppercase tracking-wide text-white group-hover:text-sky-300 transition-colors">
                {pack.name}
              </h2>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed font-sans">
                {pack.description}
              </p>
            </div>

            {/* Action CTA */}
            <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono font-bold text-sky-400 group-hover:text-white transition-colors">
              <span>UNSEAL PACK</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>

      {/* --- PACK HISTORY SECTION (Requirement #18) --- */}
      <div className="border-t border-white/10 pt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            <h2 className="text-lg font-bold font-serif uppercase tracking-wider text-white">
              PACK HISTORY
            </h2>
            <span className="text-xs font-mono text-neutral-400">
              ({packHistory.length} Recorded)
            </span>
          </div>
        </div>

        {packHistory.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-950/40 border border-white/10 text-center text-xs font-mono text-neutral-400">
            No packs opened yet. Unseal your first booster pack above to start recording history.
          </div>
        ) : (
          <div className="space-y-3">
            {packHistory.map((item) => {
              const formattedDate = new Date(item.openedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    soundManager.playButtonClick();
                    setInspectHistoryItem(item);
                  }}
                  className="p-4 rounded-xl bg-neutral-950/70 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-neutral-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-sm text-sky-400">
                      #{String(item.packNumber).padStart(3, '0')}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white font-serif uppercase">
                        {item.packName || 'Person Booster Pack'}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <Calendar className="w-3 h-3 text-neutral-500" />
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span>5 Cards</span>
                      </div>
                    </div>
                  </div>

                  {/* Rarities Pill Strip obtained from this pack */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.cards.map((card, idx) => {
                      const rInfo = getRarityDetails(card.rarity);
                      return (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase border"
                          style={{
                            backgroundColor: `${rInfo.color}15`,
                            borderColor: `${rInfo.color}40`,
                            color: rInfo.color,
                          }}
                        >
                          {rInfo.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INSPECT PACK HISTORY MODAL */}
      {inspectHistoryItem && (
        <div
          onClick={() => setInspectHistoryItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl rounded-3xl bg-neutral-950 border border-white/15 p-6 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <span className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider">
                  Pack #{String(inspectHistoryItem.packNumber).padStart(3, '0')}
                </span>
                <h3 className="text-2xl font-black font-serif uppercase text-white">
                  {inspectHistoryItem.packName}
                </h3>
              </div>
              <button
                onClick={() => setInspectHistoryItem(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 5 Cards Display */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {inspectHistoryItem.cards.map((card, idx) => (
                <div key={idx} className="flex justify-center">
                  <Card card={card} size="sm" interactiveTilt={false} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
