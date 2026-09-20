import React from 'react';
import { ActiveTab } from '../types';
import { soundManager } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import {
  Home,
  Layers,
  Package,
  User,
  Settings,
  Volume2,
  VolumeX,
  Music,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  LogIn,
  LogOut,
  Clock,
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
  onOpenAddCard: () => void;
  onOpenAuth: () => void;
  onOpenSetup: () => void;
  totalCollectedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  soundEnabled,
  onToggleSound,
  musicEnabled,
  onToggleMusic,
  onOpenAddCard,
  onOpenAuth,
  onOpenSetup,
  totalCollectedCount,
}) => {
  const { player, isAdmin, isConfigured, cooldown, signOut } = useAuth();

  const handleNavClick = (tab: ActiveTab) => {
    soundManager.playButtonClick();
    onTabChange(tab);
  };

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'HOME', label: 'HOME', icon: Home },
    { id: 'COLLECTION', label: 'COLLECTION', icon: Layers },
    { id: 'PACKS', label: 'PACKS', icon: Package },
    { id: 'PROFILE', label: 'PROFILE', icon: User },
    { id: 'SETTINGS', label: 'SETTINGS', icon: Settings },
  ];

  // Only Admins can see the Admin navigation tab
  if (isAdmin) {
    navItems.push({ id: 'ADMIN', label: 'ADMIN', icon: ShieldCheck });
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* DESKTOP TOP BAR */}
      <header
        id="desktop-navbar"
        className="hidden md:flex fixed top-0 inset-x-0 z-40 h-16 items-center justify-between px-6 bg-[#090a12]/85 backdrop-blur-md border-b border-white/10 select-none"
      >
        {/* Brand Logo */}
        <div
          onClick={() => handleNavClick('HOME')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-500 to-amber-400 p-0.5 shadow-md group-hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <div>
            <div className="font-serif font-black tracking-[0.18em] text-sm text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200 uppercase">
              PERSON CARD COLLECTION
            </div>
            <div className="text-[9px] font-mono tracking-widest text-sky-400 font-bold flex items-center gap-1.5">
              <span>DIGITAL TCG ARCHIVE</span>
              {isAdmin && (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[8px] font-black">
                  ADMIN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Nav Items */}
        <nav className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isItemAdmin = item.id === 'ADMIN';

            return (
              <button
                key={item.id}
                id={`nav-btn-${item.id.toLowerCase()}`}
                onClick={() => handleNavClick(item.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? isItemAdmin
                      ? 'text-amber-300 bg-amber-500/20 shadow-sm border border-amber-500/30'
                      : 'text-white bg-white/15 shadow-sm shadow-indigo-500/20'
                    : isItemAdmin
                    ? 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? isItemAdmin
                        ? 'text-amber-400'
                        : 'text-sky-400'
                      : isItemAdmin
                      ? 'text-amber-400/70'
                      : ''
                  }`}
                />
                <span>{item.label}</span>
                {item.id === 'COLLECTION' && totalCollectedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-500/40 text-indigo-300">
                    {totalCollectedCount}
                  </span>
                )}
                {isActive && (
                  <span
                    className={`absolute bottom-0 inset-x-3 h-0.5 rounded-full ${
                      isItemAdmin
                        ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                        : 'bg-gradient-to-r from-sky-400 to-indigo-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Packs Badge, DB Setup, Admin Tools, Audio Toggles, Player Auth */}
        <div className="flex items-center gap-2">
          {/* Packs Available Pill */}
          <div
            title="Available booster packs in current 1-hour batch"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold ${
              cooldown.isCooldownActive
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-white/5 border-white/10 text-neutral-300'
            }`}
          >
            {cooldown.isCooldownActive ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatTimer(cooldown.cooldownRemainingSeconds)}</span>
              </>
            ) : (
              <>
                <Package className="w-3.5 h-3.5 text-sky-400" />
                <span>{cooldown.packsAvailable}/5 PACKS</span>
              </>
            )}
          </div>

          {/* ADMIN ONLY: Add Custom Person Card button */}
          {isAdmin && (
            <button
              id="open-add-card-btn"
              onClick={() => {
                soundManager.playButtonClick();
                onOpenAddCard();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 border border-sky-400/40 text-sky-300 text-xs font-mono font-bold tracking-wider transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>NEW CARD</span>
            </button>
          )}

          {/* Sound FX Toggle */}
          <button
            id="toggle-sound-btn"
            onClick={() => {
              onToggleSound();
              soundManager.playButtonClick();
            }}
            title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Music Toggle */}
          <button
            id="toggle-music-btn"
            onClick={() => {
              onToggleMusic();
              soundManager.playButtonClick();
            }}
            title={musicEnabled ? 'Pause Music' : 'Play Ambient Music'}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              musicEnabled
                ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                : 'bg-white/5 border-white/10 text-neutral-500'
            }`}
          >
            <Music className={`w-4 h-4 ${musicEnabled ? 'text-indigo-400 animate-pulse' : ''}`} />
          </button>

          {/* Player Sign In / Profile / Logout */}
          {player ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleNavClick('PROFILE')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-mono font-bold text-white max-w-[90px] truncate">
                  {player.displayName || player.username}
                </span>
              </button>

              <button
                onClick={() => {
                  soundManager.playButtonClick();
                  signOut();
                }}
                title="Log out of account"
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-red-300 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              id="header-signin-btn"
              onClick={() => {
                soundManager.playButtonClick();
                onOpenAuth();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-mono font-black tracking-wider transition-all cursor-pointer shadow-md shadow-sky-500/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div
        id="mobile-navbar"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-[#090a12]/95 backdrop-blur-lg border-t border-white/10 flex items-center justify-around px-2 select-none"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isItemAdmin = item.id === 'ADMIN';

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? isItemAdmin
                    ? 'text-amber-400'
                    : 'text-sky-400'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[9px] font-mono font-bold tracking-wider">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* MOBILE TOP COMPACT BAR */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-[#090a12]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-3 select-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span className="font-serif font-black text-xs tracking-widest text-white uppercase">
            PERSON CARDS
          </span>
          {isAdmin && (
            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[8px] font-bold font-mono">
              ADMIN
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Packs Indicator on mobile */}
          <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-neutral-300">
            {cooldown.isCooldownActive ? (
              <span className="text-amber-400 font-bold">{formatTimer(cooldown.cooldownRemainingSeconds)}</span>
            ) : (
              <span>{cooldown.packsAvailable}/5 PKS</span>
            )}
          </div>

          {/* ADMIN ONLY Add card button on mobile */}
          {isAdmin && (
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onOpenAddCard();
              }}
              className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-mono font-bold flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>
          )}

          {/* Auth button on mobile */}
          {player ? (
            <button
              onClick={() => handleNavClick('PROFILE')}
              className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white"
            >
              {player.username.charAt(0).toUpperCase()}
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-2 py-1 rounded-lg bg-sky-500 text-black text-[10px] font-mono font-black"
            >
              LOGIN
            </button>
          )}

          <button
            onClick={() => {
              onToggleSound();
              soundManager.playButtonClick();
            }}
            className="p-1.5 rounded-lg bg-white/10 text-white"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-sky-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
        </div>
      </div>
    </>
  );
};
