import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { soundManager } from '../utils/audio';
import {
  X,
  Sparkles,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSetup?: () => void;
}

type AuthMode = 'LOGIN' | 'SIGNUP';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenSetup }) => {
  const { signIn, signUp, authModalMode, isConfigured } = useAuth();

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(authModalMode || 'LOGIN');
      setErrorMsg('');
      setShowForgotNotice(false);
    }
  }, [isOpen, authModalMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setShowForgotNotice(false);
    setSubmitting(true);
    soundManager.playButtonClick();

    try {
      if (mode === 'LOGIN') {
        const { error } = await signIn(username, password);
        if (error) {
          setErrorMsg(error);
          soundManager.playCardFlip();
        } else {
          soundManager.playCollectionAdded();
          onClose();
        }
      } else {
        const { error } = await signUp(username, password, confirmPassword, displayName);
        if (error) {
          setErrorMsg(error);
          soundManager.playCardFlip();
        } else {
          soundManager.playCollectionAdded();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto select-none animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-white/15 p-6 sm:p-8 shadow-2xl flex flex-col my-auto"
      >
        {/* Close button */}
        <button
          id="close-auth-modal-btn"
          onClick={() => {
            soundManager.playButtonClick();
            onClose();
          }}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-purple-500/20 border border-sky-400/30 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/10">
            <Sparkles className="w-6 h-6 text-sky-400" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-[0.12em] text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-300 uppercase">
            PERSON CARD COLLECTION
          </h2>

          <p className="text-xs sm:text-sm font-mono text-neutral-400 mt-1">
            {mode === 'SIGNUP'
              ? 'Create your collector account'
              : 'Enter your username and password to continue your journey'}
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="leading-relaxed font-sans block">{errorMsg}</span>
              {onOpenSetup && (errorMsg.includes('console') || errorMsg.includes('unavailable') || errorMsg.includes('service error')) && (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    onOpenSetup();
                  }}
                  className="mt-2 text-xs font-mono font-bold text-sky-400 hover:text-sky-300 underline block cursor-pointer"
                >
                  View SQL Migration &amp; Setup Instructions
                </button>
              )}
            </div>
          </div>
        )}

        {/* Forgot Password Notice (Requirement 31) */}
        {showForgotNotice && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-sans">
              <span className="font-semibold block mb-0.5">Password Recovery:</span>
              Password recovery is not available without an email address. Please contact the administrator.
            </div>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* USERNAME */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-300 mb-1.5 font-bold">
              USERNAME
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                id="auth-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'SIGNUP' ? 'e.g. collector_arjun' : 'Enter username'}
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-sans transition-all"
              />
            </div>
          </div>

          {/* DISPLAY NAME (Optional on signup) */}
          {mode === 'SIGNUP' && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-300 mb-1.5 font-bold">
                DISPLAY NAME <span className="text-neutral-500 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <ShieldCheck className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  id="auth-display-name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Collector Name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-400 font-sans transition-all"
                />
              </div>
            </div>
          )}

          {/* PASSWORD */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-300 font-bold">
                PASSWORD
              </label>
              {mode === 'LOGIN' && (
                <button
                  type="button"
                  onClick={() => setShowForgotNotice((prev) => !prev)}
                  className="text-[11px] font-mono text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                id="auth-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'SIGNUP' ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-sans transition-all"
              />
            </div>
          </div>

          {/* CONFIRM PASSWORD (Signup only) */}
          {mode === 'SIGNUP' && (
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-300 mb-1.5 font-bold">
                CONFIRM PASSWORD
              </label>
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  id="auth-confirm-password-input"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-sans transition-all"
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-bold font-serif tracking-[0.15em] text-xs uppercase shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'SIGNUP' ? (
              <>
                <span>CREATE ACCOUNT</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>LOGIN</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher */}
        <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center text-xs font-mono text-neutral-400">
          {mode === 'LOGIN' ? (
            <div className="flex items-center gap-2">
              <span>New collector?</span>
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  setMode('SIGNUP');
                  setErrorMsg('');
                  setShowForgotNotice(false);
                }}
                className="font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
              >
                CREATE ACCOUNT
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  setMode('LOGIN');
                  setErrorMsg('');
                  setShowForgotNotice(false);
                }}
                className="font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
              >
                LOGIN
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
