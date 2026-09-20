import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Player, CooldownState, UserRole } from '../types';
import {
  registerPlayer,
  loginPlayer,
  getSavedSession,
  clearSession,
  invalidateCurrentSessionToServer,
  calculateCooldownState,
  validateCurrentSession,
} from '../utils/playerEngine';
import { isSupabaseConfigured } from '../utils/supabase';

interface AuthContextType {
  player: Player | null;
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  isConfigured: boolean;
  cooldown: CooldownState;
  welcomeModalState: 'NONE' | 'NEW_PLAYER' | 'RETURNING_PLAYER';
  isAuthModalOpen: boolean;
  authModalMode: 'LOGIN' | 'SIGNUP';
  openAuthModal: (mode?: 'LOGIN' | 'SIGNUP') => void;
  closeAuthModal: () => void;
  dismissWelcomeModal: () => void;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signUp: (username: string, password: string, confirmPassword: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updatePlayerState: (updated: Player, updatedCooldown?: CooldownState) => void;
  refreshCooldown: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(isSupabaseConfigured());
  const [welcomeModalState, setWelcomeModalState] = useState<'NONE' | 'NEW_PLAYER' | 'RETURNING_PLAYER'>('NONE');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');

  const [cooldown, setCooldown] = useState<CooldownState>({
    packsAvailable: 5,
    maxPacks: 5,
    cooldownRemainingSeconds: 0,
    isCooldownActive: false,
    cooldownUntil: null,
  });

  const timerRef = useRef<number | null>(null);

  // Compute cooldown from player
  const updateCooldownFromPlayer = useCallback((p: Player | null) => {
    const nextCooldown = calculateCooldownState(p);
    setCooldown(nextCooldown);
  }, []);

  // Restore session on mount with authoritative validation
  useEffect(() => {
    setIsConfigured(isSupabaseConfigured());
    let isMounted = true;

    // Instant initial restore from cache to prevent flicker
    const { player: savedPlayer } = getSavedSession();
    if (savedPlayer) {
      setPlayer(savedPlayer);
      updateCooldownFromPlayer(savedPlayer);
    }

    // Authoritative server-side / local validation
    async function restore() {
      const { player: validatedPlayer, cooldown: initialCooldown } = await validateCurrentSession();
      if (isMounted) {
        if (validatedPlayer) {
          setPlayer(validatedPlayer);
          setCooldown(initialCooldown);
        } else {
          setPlayer(null);
        }
        setLoading(false);
      }
    }

    restore();

    return () => {
      isMounted = false;
    };
  }, [updateCooldownFromPlayer]);

  // Live countdown timer for active cooldown
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (cooldown.isCooldownActive && cooldown.cooldownRemainingSeconds > 0) {
      timerRef.current = window.setInterval(() => {
        setCooldown((prev) => {
          if (prev.cooldownRemainingSeconds <= 1) {
            // Cooldown complete! Reset to 5 packs available
            if (player) {
              const refreshedPlayer: Player = {
                ...player,
                packsInCurrentBatch: 0,
              };
              setPlayer(refreshedPlayer);
            }
            return {
              packsAvailable: 5,
              maxPacks: 5,
              cooldownRemainingSeconds: 0,
              isCooldownActive: false,
              cooldownUntil: null,
            };
          }

          return {
            ...prev,
            cooldownRemainingSeconds: prev.cooldownRemainingSeconds - 1,
          };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [cooldown.isCooldownActive, cooldown.cooldownRemainingSeconds, player]);

  const openAuthModal = useCallback((mode: 'LOGIN' | 'SIGNUP' = 'LOGIN') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const dismissWelcomeModal = useCallback(() => {
    setWelcomeModalState('NONE');
  }, []);

  // Sign In with Username & Password
  const signIn = async (username: string, password: string): Promise<{ error: string | null }> => {
    if (!username.trim() || !password) {
      return { error: 'Please enter your username and password' };
    }

    const { player: loggedPlayer, error, cooldown: newCooldown } = await loginPlayer(username, password);

    if (error || !loggedPlayer) {
      return { error: error || 'Invalid username or password' };
    }

    setPlayer(loggedPlayer);
    setCooldown(newCooldown);
    setIsAuthModalOpen(false);

    // Show returning player welcome dialog if not admin
    if (loggedPlayer.role !== 'ADMIN') {
      setWelcomeModalState('RETURNING_PLAYER');
    }

    return { error: null };
  };

  // Sign Up with Username & Password (NO Google, NO Gmail, NO Email)
  const signUp = async (
    username: string,
    password: string,
    confirmPassword: string,
    displayName?: string
  ): Promise<{ error: string | null }> => {
    if (!username.trim()) {
      return { error: 'Please choose a username' };
    }

    if (username.trim().length < 3) {
      return { error: 'Username must be at least 3 characters long' };
    }

    if (!password) {
      return { error: 'Please enter a password' };
    }

    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters long' };
    }

    if (password !== confirmPassword) {
      return { error: 'Passwords do not match' };
    }

    const { player: newPlayer, error, cooldown: newCooldown } = await registerPlayer(
      username,
      password,
      displayName
    );

    if (error || !newPlayer) {
      return { error: error || 'Failed to create account' };
    }

    setPlayer(newPlayer);
    setCooldown(newCooldown);
    setIsAuthModalOpen(false);

    // Trigger New Player cinematic welcome
    setWelcomeModalState('NEW_PLAYER');

    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    try {
      await invalidateCurrentSessionToServer();
    } catch (e) {
      console.warn('Error invalidating server session during sign out:', e);
    }
    clearSession();
    setPlayer(null);
    setWelcomeModalState('NONE');
    setCooldown({
      packsAvailable: 5,
      maxPacks: 5,
      cooldownRemainingSeconds: 0,
      isCooldownActive: false,
      cooldownUntil: null,
    });
  };

  const updatePlayerState = useCallback((updated: Player, updatedCooldown?: CooldownState) => {
    setPlayer(updated);
    if (updatedCooldown) {
      setCooldown(updatedCooldown);
    } else {
      updateCooldownFromPlayer(updated);
    }
  }, [updateCooldownFromPlayer]);

  const refreshCooldown = useCallback(() => {
    if (player) {
      updateCooldownFromPlayer(player);
    }
  }, [player, updateCooldownFromPlayer]);

  const role: UserRole = player?.role || 'USER';
  const isAdmin = role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        player,
        role,
        isAdmin,
        loading,
        isConfigured,
        cooldown,
        welcomeModalState,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        dismissWelcomeModal,
        signIn,
        signUp,
        signOut,
        updatePlayerState,
        refreshCooldown,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
