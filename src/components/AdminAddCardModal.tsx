import React, { useState } from 'react';
import { PersonCard, Rarity } from '../types';
import { Card } from './Card';
import { soundManager } from '../utils/audio';
import { saveCustomCard, createCardInSupabase } from '../utils/storage';
import { uploadCardPhoto } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { X, Upload, Sparkles, Plus, Image as ImageIcon, Loader2, ShieldCheck } from 'lucide-react';

interface AdminAddCardModalProps {
  onClose: () => void;
  onCardAdded: (newCard: PersonCard) => void;
}

const SAMPLE_PRESET_PHOTOS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
];

export const AdminAddCardModal: React.FC<AdminAddCardModalProps> = ({
  onClose,
  onCardAdded,
}) => {
  const { player, isConfigured } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState(25);
  const [rarity, setRarity] = useState<Rarity>('RARE');
  const [category, setCategory] = useState('CREATOR');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(SAMPLE_PRESET_PHOTOS[0]);
  const [charisma, setCharisma] = useState(85);
  const [energy, setEnergy] = useState(80);
  const [style, setStyle] = useState(90);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    // Try Supabase Storage upload
    if (isConfigured) {
      const { url, error } = await uploadCardPhoto(file);
      if (url) {
        setPhoto(url);
        setUploading(false);
        return;
      } else {
        console.warn('Supabase storage fallback to dataUrl:', error);
      }
    }

    // Fallback: FileReader data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setPhoto(event.target.result);
        setErrorMsg('');
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const previewCard: PersonCard = {
    id: `custom-${Date.now()}`,
    name: name.trim() || 'Hero Subject',
    age: Number(age) || 25,
    photo,
    rarity,
    category: category.trim().toUpperCase() || 'PIONEER',
    description: description.trim() || 'A newly discovered figure in the Person Card Collection archive.',
    cardNumber: `#C${Math.floor(Math.random() * 900 + 100)}`,
    background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
    accent: '#818cf8',
    stats: {
      charisma: Number(charisma),
      energy: Number(energy),
      style: Number(style),
    },
    custom: true,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please provide a person name.');
      return;
    }

    setSaving(true);
    soundManager.playCollectionAdded();

    // 1. Try saving to Supabase `cards` table if configured
    if (isConfigured) {
      const { card: createdDbCard, error } = await createCardInSupabase(previewCard);
      if (createdDbCard) {
        saveCustomCard(createdDbCard);
        onCardAdded(createdDbCard);
        setSaving(false);
        onClose();
        return;
      }

      // Do not silently fall back to local storage when Supabase is configured.
      // The admin catalog is cloud-backed, so an insert error must be shown to the admin.
      setSaving(false);
      setErrorMsg(error || 'Card could not be saved to the Supabase master catalog.');
      return;
    }

    // Local-only fallback when Supabase is genuinely not configured.
    saveCustomCard(previewCard);
    onCardAdded(previewCard);
    setSaving(false);
    onClose();
  };

  return (
    <div
      id="admin-add-card-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl rounded-3xl bg-neutral-950 border border-white/15 p-6 shadow-2xl flex flex-col lg:flex-row items-center gap-8 my-auto"
      >
        {/* Close Button */}
        <button
          id="close-add-card-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Live Card Preview */}
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-xs font-mono tracking-widest text-indigo-300 font-bold uppercase mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Live Card Preview
          </span>
          <Card card={previewCard} size="md" interactiveTilt={true} />
        </div>

        {/* Right: Form inputs */}
        <form onSubmit={handleSubmit} className="flex-1 w-full flex flex-col gap-4 text-xs font-mono">
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold mb-1.5">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>ADMIN PRIVILEGE ONLY</span>
            </div>
            <h2 className="text-2xl font-black font-serif uppercase tracking-wide text-white">
              CREATE PERSON CARD
            </h2>
            <p className="text-slate-400 font-sans text-xs mt-0.5">
              Upload real photos to Supabase Storage &amp; add new cards into the master booster pack catalog.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Photo upload / presets */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-sky-400" /> Photo (Supabase Storage Upload or Preset)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-bold cursor-pointer transition-all">
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5" />
                )}
                <span>{uploading ? 'Uploading...' : 'Upload Real Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {SAMPLE_PRESET_PHOTOS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhoto(preset)}
                  className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    photo === preset ? 'border-sky-400 scale-110' : 'border-white/20 opacity-60'
                  }`}
                >
                  <img src={preset} alt="preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Name & Age */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Person Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sarah Chen"
                required
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white focus:outline-hidden focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">Age</label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white focus:outline-hidden focus:border-sky-400"
              />
            </div>
          </div>

          {/* Rarity & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Rarity Tier</label>
              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as Rarity)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/15 text-white focus:outline-hidden focus:border-sky-400"
              >
                <option value="COMMON">COMMON</option>
                <option value="UNCOMMON">UNCOMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
                <option value="ULTRA_RARE">ULTRA RARE</option>
                <option value="LEGENDARY">LEGENDARY</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1">Archetype Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., ASTRONAUT, SCIENTIST"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white focus:outline-hidden focus:border-sky-400 uppercase"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">Dossier / Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short compelling bio for the card..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white focus:outline-hidden focus:border-sky-400 font-sans"
            />
          </div>

          {/* Stats Sliders: Charisma, Energy, Style */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-amber-400 font-bold">Charisma</span>
                <span className="text-white">{charisma}</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={charisma}
                onChange={(e) => setCharisma(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-sky-400 font-bold">Energy</span>
                <span className="text-white">{energy}</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-rose-400 font-bold">Style</span>
                <span className="text-white">{style}</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={style}
                onChange={(e) => setStyle(Number(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || uploading}
            className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 hover:from-sky-300 hover:to-purple-400 text-slate-950 font-black tracking-widest text-xs uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{saving ? 'SAVING TO MASTER CATALOG...' : 'MINT CARD & ADD TO PACK POOL'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
