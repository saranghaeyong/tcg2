import React, { useState } from 'react';
import { getSupabaseCredentials, saveCustomSupabaseCredentials, getSupabase } from '../utils/supabase';
import { soundManager } from '../utils/audio';
import { SUPABASE_SCHEMA_SQL } from '../utils/supabaseSql';
import {
  X,
  Database,
  Key,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const currentCreds = getSupabaseCredentials();
  const [url, setUrl] = useState(currentCreds.url || '');
  const [anonKey, setAnonKey] = useState(currentCreds.anonKey || '');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopied(true);
    soundManager.playButtonClick();
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveAndTest = async () => {
    setTesting(true);
    setTestResult(null);
    soundManager.playButtonClick();

    try {
      saveCustomSupabaseCredentials(url, anonKey);
      const client = getSupabase();

      if (!client) {
        setTestResult({
          success: false,
          message: 'Please provide a valid https:// URL and Anon Key.',
        });
        setTesting(false);
        return;
      }

      // Quick test query to cards or players table
      const { data, error } = await client.from('cards').select('count', { count: 'exact', head: true });

      if (error && !error.message.includes('permission denied')) {
        setTestResult({
          success: false,
          message: `Connected to Supabase endpoint, but table query returned: ${error.message}. Make sure to run the SQL schema script in your Supabase SQL Editor!`,
        });
      } else {
        setTestResult({
          success: true,
          message: 'Successfully connected to Supabase project!',
        });
        soundManager.playCollectionAdded();
        if (onConnected) {
          setTimeout(() => {
            onConnected();
            onClose();
          }, 1200);
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      id="supabase-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl bg-neutral-950 border border-white/15 p-6 sm:p-8 shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black font-serif uppercase tracking-wider text-white flex items-center gap-2">
              <span>SUPABASE DATABASE & AUTH</span>
            </h2>
            <p className="text-xs font-sans text-neutral-400">
              Configure PostgreSQL cloud persistence, Auth RPC functions, Storage, and RLS security policies.
            </p>
          </div>
        </div>

        {/* Step 1: SQL Schema Script */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> STEP 1: RUN DATABASE SCHEMA
            </span>
            <button
              onClick={handleCopySql}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED SQL SCRIPT!' : 'COPY SQL SCHEMA'}</span>
            </button>
          </div>

          <p className="text-xs font-sans text-neutral-300 leading-relaxed">
            Open your Supabase Project dashboard, go to <strong>SQL Editor</strong>, paste this script, and click <strong>Run</strong>. It creates all tables (<code className="text-sky-300">players</code>, <code className="text-sky-300">cards</code>, <code className="text-sky-300">player_cards</code>, <code className="text-sky-300">player_packs</code>, <code className="text-sky-300">player_pack_cards</code>), RPC functions (<code className="text-sky-300">register_player</code>, <code className="text-sky-300">login_player</code>, <code className="text-sky-300">open_pack</code>), and seeds initial master cards and administrator account.
          </p>

          <div className="relative rounded-xl bg-black/60 border border-white/10 p-3 max-h-32 overflow-y-auto text-[10px] font-mono text-neutral-400">
            <pre>{SUPABASE_SCHEMA_SQL}</pre>
          </div>
        </div>

        {/* Step 2: Credentials */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5 mb-5 space-y-4">
          <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
            <Key className="w-4 h-4 text-sky-400" /> STEP 2: PROJECT CREDENTIALS
          </span>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="block text-neutral-300 font-bold mb-1">
                Supabase Project URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-white placeholder:text-neutral-600 focus:outline-hidden focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-bold mb-1">
                Supabase Anon Public API Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-white placeholder:text-neutral-600 focus:outline-hidden focus:border-sky-400"
              />
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 font-sans flex items-center gap-1.5">
            <span>Find these in Supabase Dashboard &gt; Project Settings &gt; API.</span>
          </div>
        </div>

        {/* Status result */}
        {testResult && (
          <div
            className={`mb-4 p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{testResult.message}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={testing}
            className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{testing ? 'TESTING CONNECTION...' : 'SAVE & CONNECT TO SUPABASE'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
