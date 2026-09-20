import React from 'react';
import { Sparkles, Shield, Compass } from 'lucide-react';

interface CardBackProps {
  className?: string;
}

export const CardBack: React.FC<CardBackProps> = ({ className = '' }) => {
  return (
    <div
      id="card-back-container"
      className={`relative h-full w-full rounded-2xl p-[6px] shadow-2xl overflow-hidden select-none bg-gradient-to-br from-indigo-950 via-slate-900 to-black border-2 border-indigo-500/40 ${className}`}
      style={{
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), inset 0 0 20px rgba(99,102,241,0.2)',
      }}
    >
      {/* Outer metallic etched frame */}
      <div className="relative h-full w-full rounded-xl border border-indigo-400/30 bg-[#090b14] p-3 flex flex-col items-center justify-between overflow-hidden">
        {/* Subtle geometric grid background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(165,180,252,0.4) 1px, transparent 0)`,
            backgroundSize: '16px 16px',
          }}
        />

        {/* Diagonal light sheen sweep */}
        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-indigo-400/10 to-transparent rotate-45 pointer-events-none animate-foil-sweep" />

        {/* Corner emblems */}
        <div className="w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-1 text-[10px] tracking-widest font-mono text-indigo-300/60 font-bold">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>PCC</span>
          </div>
          <div className="text-[10px] tracking-widest font-mono text-indigo-300/60 font-bold">
            SERIES I
          </div>
        </div>

        {/* Central Heraldic Emblem */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto">
          {/* Glowing concentric rings */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-pulse-glow" />
            <div className="absolute inset-3 rounded-full border border-dashed border-sky-400/40" />
            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-slate-950 flex items-center justify-center shadow-inner border border-indigo-400/30">
              <div className="relative flex items-center justify-center">
                <Compass className="w-12 h-12 text-indigo-300 opacity-90 animate-[spin_20s_linear_infinite]" />
                <Shield className="w-6 h-6 text-sky-400 absolute" />
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <h2 className="text-xl font-extrabold tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-sky-200 uppercase font-serif">
              PERSON
            </h2>
            <div className="text-[10px] tracking-[0.35em] text-indigo-300/80 font-semibold uppercase mt-0.5">
              COLLECTION
            </div>
          </div>
        </div>

        {/* Bottom edge footer */}
        <div className="w-full flex items-center justify-between border-t border-indigo-500/20 pt-2 z-10 text-[9px] font-mono tracking-wider text-slate-400">
          <span>ORIGINAL TCG</span>
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            <span>AUTHENTIC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
