import React, { useState, useMemo, useEffect } from 'react';
import { PersonCard, Rarity } from '../types';
import { Card } from '../components/Card';
import { soundManager } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import {
  createCardInSupabase,
  updateCardInSupabase,
  deleteCardFromSupabase,
  seedInitialCardsToSupabase,
} from '../utils/storage';
import { uploadCardPhoto } from '../utils/supabase';
import {
  fetchAdminPlayers,
  adminTogglePlayerStatus,
  adminResetPassword,
  adminResetApplication,
} from '../utils/playerEngine';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  Search,
  Upload,
  Database,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Users,
  Lock,
  KeyRound,
  Check,
  UserCheck,
  UserX,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface AdminPanelProps {
  cards: PersonCard[];
  onRefreshCards: () => Promise<void>;
  onOpenCreateModal: () => void;
  isRefreshingCards: boolean;
}

type AdminSection = 'CARDS' | 'PLAYERS' | 'SYSTEM';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  cards,
  onRefreshCards,
  onOpenCreateModal,
  isRefreshingCards,
}) => {
  const { player, isAdmin, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>('CARDS');

  // Cards state
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState<string>('ALL');
  const [editingCard, setEditingCard] = useState<PersonCard | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState(25);
  const [editPhoto, setEditPhoto] = useState('');
  const [editRarity, setEditRarity] = useState<Rarity>('RARE');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editCharisma, setEditCharisma] = useState(80);
  const [editEnergy, setEditEnergy] = useState(80);
  const [editStyle, setEditStyle] = useState(80);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Players state
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [resettingPlayer, setResettingPlayer] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resettingLoading, setResettingLoading] = useState(false);

  // System Complete Reset state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');
  const [isResettingApp, setIsResettingApp] = useState(false);

  // Load players when switching to PLAYERS tab
  const loadPlayers = async () => {
    if (!player) return;
    setLoadingPlayers(true);
    const { players: list, error } = await fetchAdminPlayers(player.id);
    setLoadingPlayers(false);
    if (!error) {
      setPlayersList(list);
    } else {
      setStatusMsg({ type: 'error', text: `Failed to load players: ${error}` });
    }
  };

  useEffect(() => {
    if (activeSection === 'PLAYERS') {
      loadPlayers();
    }
  }, [activeSection, player]);

  // Unauthorized guard
  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-2xl font-serif font-black text-white uppercase tracking-wider">
          ACCESS RESTRICTED
        </h2>
        <p className="text-sm text-neutral-400 max-w-md mt-2">
          Administrator privileges are required to access this console. Please sign in with an authorized account.
        </p>
      </div>
    );
  }

  // Filtered master catalog
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch =
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.cardNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity = rarityFilter === 'ALL' || card.rarity === rarityFilter;
      return matchesSearch && matchesRarity;
    });
  }, [cards, searchTerm, rarityFilter]);

  // Filtered players
  const filteredPlayers = useMemo(() => {
    return playersList.filter((p) => {
      const q = playerSearch.toLowerCase();
      return (
        p.username.toLowerCase().includes(q) ||
        (p.displayName && p.displayName.toLowerCase().includes(q))
      );
    });
  }, [playersList, playerSearch]);

  const handleStartEdit = (card: PersonCard) => {
    setEditingCard(card);
    setEditName(card.name);
    setEditAge(card.age);
    setEditPhoto(card.photo);
    setEditRarity(card.rarity);
    setEditCategory(card.category);
    setEditDescription(card.description);
    setEditCardNumber(card.cardNumber);
    setEditCharisma(card.stats.charisma);
    setEditEnergy(card.stats.energy);
    setEditStyle(card.stats.style);
    soundManager.playButtonClick();
  };

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const { url, error } = await uploadCardPhoto(file);
    setUploadingPhoto(false);

    if (url) {
      setEditPhoto(url);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setEditPhoto(event.target.result);
        }
      };
      reader.readAsDataURL(file);
      if (error) {
        setStatusMsg({ type: 'error', text: `Storage note: ${error}` });
      }
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;

    setSavingEdit(true);
    const updatedCard: PersonCard = {
      ...editingCard,
      name: editName.trim(),
      age: Number(editAge),
      photo: editPhoto,
      rarity: editRarity,
      category: editCategory.trim().toUpperCase(),
      description: editDescription.trim(),
      cardNumber: editCardNumber.trim(),
      stats: {
        charisma: Number(editCharisma),
        energy: Number(editEnergy),
        style: Number(editStyle),
      },
    };

    const { error } = await updateCardInSupabase(updatedCard);
    setSavingEdit(false);

    if (error) {
      setStatusMsg({ type: 'error', text: `Failed to update card: ${error}` });
    } else {
      setStatusMsg({ type: 'success', text: `Updated "${updatedCard.name}" in master catalog.` });
      setEditingCard(null);
      onRefreshCards();
      soundManager.playCollectionAdded();
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    soundManager.playButtonClick();
    const { error } = await deleteCardFromSupabase(cardId);
    setDeletingCardId(null);

    if (error) {
      setStatusMsg({ type: 'error', text: `Failed to delete card: ${error}` });
    } else {
      setStatusMsg({ type: 'success', text: 'Card removed from booster pack catalog.' });
      onRefreshCards();
    }
  };

  const handleSeedCards = async () => {
    setSeeding(true);
    soundManager.playButtonClick();
    const { count, error } = await seedInitialCardsToSupabase();
    setSeeding(false);

    if (error) {
      setStatusMsg({ type: 'error', text: `Seeding error: ${error}` });
    } else {
      setStatusMsg({ type: 'success', text: `Seeded ${count} starter cards into database!` });
      onRefreshCards();
      soundManager.playCollectionAdded();
    }
  };

  const handleTogglePlayerStatus = async (targetPlayer: any) => {
    if (!player) return;
    if (targetPlayer.role === 'ADMIN') {
      setStatusMsg({ type: 'error', text: 'Cannot deactivate the primary administrator account.' });
      return;
    }

    const nextStatus = !targetPlayer.isActive;
    soundManager.playButtonClick();
    const { success, error } = await adminTogglePlayerStatus(player.id, targetPlayer.id, nextStatus);

    if (success) {
      setStatusMsg({
        type: 'success',
        text: `Player ${targetPlayer.username} is now ${nextStatus ? 'ACTIVE' : 'DEACTIVATED'}.`,
      });
      loadPlayers();
    } else {
      setStatusMsg({ type: 'error', text: error || 'Failed to update player status' });
    }
  };

  const handleExecutePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !resettingPlayer) return;
    if (newPasswordInput.length < 6) {
      setStatusMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    setResettingLoading(true);
    soundManager.playButtonClick();
    const { success, error } = await adminResetPassword(
      player.id,
      resettingPlayer.id,
      newPasswordInput
    );
    setResettingLoading(false);

    if (success) {
      setStatusMsg({
        type: 'success',
        text: `Password for player "${resettingPlayer.username}" has been successfully updated.`,
      });
      setResettingPlayer(null);
      setNewPasswordInput('');
    } else {
      setStatusMsg({ type: 'error', text: error || 'Failed to reset password' });
    }
  };

  const handleExecuteAppReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;
    if (resetConfirmationInput !== 'RESET-CONFIRM-6102000') {
      setStatusMsg({
        type: 'error',
        text: 'Confirmation code does not match. Please type exactly: RESET-CONFIRM-6102000',
      });
      return;
    }

    setIsResettingApp(true);
    soundManager.playButtonClick();

    const { success, error } = await adminResetApplication(player.id, resetConfirmationInput);
    setIsResettingApp(false);

    if (success) {
      setIsResetModalOpen(false);
      setResetConfirmationInput('');
      setStatusMsg({
        type: 'success',
        text: 'Complete Application Reset successful! All player accounts and collections purged. Admin restored.',
      });
      // Trigger sign out after complete application wipe
      setTimeout(() => {
        signOut();
      }, 1200);
    } else {
      setStatusMsg({
        type: 'error',
        text: `Reset failed: ${error || 'Unknown error occurred'}`,
      });
    }
  };

  return (
    <div
      id="admin-panel-screen"
      className="relative min-h-[calc(100dvh-4rem)] w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 select-none"
    >
      {/* Header with Admin Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-mono font-bold tracking-widest text-amber-300 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>ADMINISTRATOR CONSOLE (RLS ENFORCED)</span>
          </div>
          <h1 className="text-3xl font-black font-serif uppercase tracking-wider text-white">
            ADMIN MANAGEMENT
          </h1>
          <p className="text-xs sm:text-sm font-sans text-neutral-400 mt-1">
            Logged in as Administrator. Manage master card drops, upload images, and audit player accounts.
          </p>
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-950 border border-white/10 self-start md:self-auto">
          <button
            onClick={() => {
              soundManager.playButtonClick();
              setActiveSection('CARDS');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSection === 'CARDS'
                ? 'bg-sky-500 text-slate-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>CARDS CATALOG</span>
          </button>

          <button
            onClick={() => {
              soundManager.playButtonClick();
              setActiveSection('PLAYERS');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSection === 'PLAYERS'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>PLAYER ACCOUNTS</span>
          </button>

          <button
            onClick={() => {
              soundManager.playButtonClick();
              setActiveSection('SYSTEM');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSection === 'SYSTEM'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-rose-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>SYSTEM RESET</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMsg && (
        <div
          className={`mb-6 p-3.5 rounded-2xl border text-xs font-mono flex items-center justify-between gap-3 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: MASTER CARD CATALOG */}
      {activeSection === 'CARDS' && (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSeedCards}
                disabled={seeding}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono font-bold text-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>{seeding ? 'SEEDING...' : 'SEED STARTER CARDS'}</span>
              </button>

              <button
                id="admin-create-card-btn"
                onClick={onOpenCreateModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>CREATE NEW CARD</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search cards..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-950/70 border border-white/15 text-white placeholder:text-neutral-500 text-xs font-mono focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Rarity Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4">
            {['ALL', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'ULTRA_RARE', 'LEGENDARY'].map((r) => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold tracking-wider uppercase transition-all cursor-pointer shrink-0 ${
                  rarityFilter === r
                    ? 'bg-sky-500 text-black shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-400 border border-white/5'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Cards Table */}
          <div className="rounded-2xl bg-neutral-950/70 border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between text-xs font-mono text-neutral-400">
              <span>
                SHOWING <strong className="text-white">{filteredCards.length}</strong> MASTER CARDS
              </span>
              <button
                onClick={() => {
                  void onRefreshCards();
                }}
                disabled={isRefreshingCards}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCards ? 'animate-spin' : ''}`} />
                <span>{isRefreshingCards ? 'Refreshing...' : 'Refresh Pool'}</span>
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-16 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-neutral-900 shadow-md">
                      <img src={card.photo} alt={card.name} className="w-full h-full object-cover" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-sm text-white">{card.name}</span>
                        <span className="text-[10px] font-mono text-neutral-500">Age {card.age}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black uppercase tracking-wider bg-white/10 text-neutral-300">
                          {card.cardNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                            card.rarity === 'LEGENDARY'
                              ? 'text-amber-400'
                              : card.rarity === 'ULTRA_RARE'
                              ? 'text-rose-400'
                              : card.rarity === 'EPIC'
                              ? 'text-purple-400'
                              : card.rarity === 'RARE'
                              ? 'text-sky-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {card.rarity}
                        </span>
                        <span className="text-neutral-600">•</span>
                        <span className="text-[10px] font-mono text-indigo-300 uppercase">
                          {card.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleStartEdit(card)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer transition-all flex items-center gap-1 text-xs font-mono"
                    >
                      <Edit className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeletingCardId(card.id)}
                      className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 cursor-pointer transition-all flex items-center gap-1 text-xs font-mono"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {filteredCards.length === 0 && (
                <div className="p-12 text-center text-neutral-400 font-mono text-xs">
                  No cards found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SECTION 2: PLAYER ACCOUNTS & SECURITY */}
      {activeSection === 'PLAYERS' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                Total Registered Players: <strong className="text-white">{playersList.length}</strong>
              </span>
              <button
                onClick={loadPlayers}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer"
                title="Refresh player list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPlayers ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search players by username..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-950/70 border border-white/15 text-white placeholder:text-neutral-500 text-xs font-mono focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Players Table */}
          <div className="rounded-2xl bg-neutral-950/70 border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-neutral-400 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Username</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Created Date</th>
                    <th className="p-3.5">Last Login</th>
                    <th className="p-3.5">Packs Opened</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPlayers.map((p) => {
                    const isAccountAdmin = p.role === 'ADMIN';
                    return (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3.5 font-bold text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-[10px] font-black">
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{p.username}</div>
                            {p.displayName && p.displayName !== p.username && (
                              <div className="text-[10px] text-neutral-400 font-normal">
                                {p.displayName}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isAccountAdmin
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-white/10 text-neutral-300'
                            }`}
                          >
                            {p.role}
                          </span>
                        </td>

                        <td className="p-3.5 text-neutral-400">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>

                        <td className="p-3.5 text-neutral-400">
                          {p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>

                        <td className="p-3.5 text-white font-bold">
                          {p.totalPacksOpened ?? 0}
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.isActive ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span>{p.isActive ? 'ACTIVE' : 'DEACTIVATED'}</span>
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Toggle Status */}
                            {!isAccountAdmin && (
                              <button
                                onClick={() => handleTogglePlayerStatus(p)}
                                title={p.isActive ? 'Deactivate player' : 'Activate player'}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                  p.isActive
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                }`}
                              >
                                {p.isActive ? (
                                  <>
                                    <UserX className="w-3 h-3" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3 h-3" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setResettingPlayer(p);
                                setNewPasswordInput('');
                              }}
                              title="Reset player password"
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-neutral-200 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                            >
                              <KeyRound className="w-3 h-3 text-amber-400" />
                              <span>Reset Pass</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPlayers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-neutral-400">
                        No registered players found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SYSTEM COMPLETE APPLICATION RESET SECTION                              */}
      {/* ========================================================================= */}
      {activeSection === 'SYSTEM' && (
        <div id="admin-system-reset-section" className="space-y-6">
          <div className="rounded-3xl bg-neutral-950/80 border border-rose-500/30 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-serif font-black text-white uppercase tracking-wider">
                  Complete Application Reset
                </h2>
                <p className="text-xs sm:text-sm font-sans text-neutral-400 mt-1">
                  Permanently clears all player accounts, active sessions, cards collected in player vaults, and pack opening histories.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold uppercase">
                  <Trash2 className="w-4 h-4" />
                  <span>Will Be Permanently Cleared</span>
                </div>
                <ul className="list-disc list-inside text-neutral-300 space-y-1 text-[11px]">
                  <li>All player accounts and profiles</li>
                  <li>All server-side player sessions</li>
                  <li>All collections and vaults</li>
                  <li>All pack-opening logs and records</li>
                  <li>All temporary frontend and game cache states</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Guaranteed Preserved</span>
                </div>
                <ul className="list-disc list-inside text-neutral-300 space-y-1 text-[11px]">
                  <li>Master Cards Catalog definition table</li>
                  <li>Database schemas and SQL tables</li>
                  <li>Storage buckets & uploaded card images</li>
                  <li>Supabase connection configurations</li>
                  <li>Administrator account (recreated: 6102000)</li>
                </ul>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wide">
                  Requires Confirmation Code
                </div>
                <div className="text-xs text-neutral-400 font-sans">
                  Only the primary system administrator can initiate this irreversible operation.
                </div>
              </div>

              <button
                id="open-app-reset-dialog-btn"
                onClick={() => {
                  soundManager.playButtonClick();
                  setResetConfirmationInput('');
                  setIsResetModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-rose-500/20 cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Application</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN RESET PASSWORD MODAL */}
      {resettingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-amber-500/30 p-6 shadow-2xl">
            <button
              onClick={() => setResettingPlayer(null)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-black text-lg text-white">RESET PLAYER PASSWORD</h3>
                <p className="text-xs font-mono text-neutral-400">
                  Player: <span className="text-amber-300 font-bold">{resettingPlayer.username}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleExecutePasswordReset} className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-300 mb-1.5 font-bold">
                  NEW PASSWORD (MIN 6 CHARACTERS)
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingPlayer(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-mono font-bold text-white hover:bg-white/15 cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={resettingLoading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                >
                  {resettingLoading ? 'SAVING...' : 'UPDATE PASSWORD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MASTER CARD MODAL */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-neutral-950 border border-white/15 p-6 sm:p-8 shadow-2xl my-auto">
            <button
              onClick={() => setEditingCard(null)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-serif font-black text-xl text-white uppercase tracking-wider mb-4">
              EDIT MASTER CARD DEFINITION
            </h3>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  AGE
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={editAge}
                  onChange={(e) => setEditAge(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  RARITY TIER
                </label>
                <select
                  value={editRarity}
                  onChange={(e) => setEditRarity(e.target.value as Rarity)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
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
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  CATEGORY
                </label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  PHOTO (URL OR UPLOAD)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={editPhoto}
                    onChange={(e) => setEditPhoto(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                  <label className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingPhoto ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditPhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  DESCRIPTION / LORE
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              {/* Stats */}
              <div>
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  CHARISMA: {editCharisma}
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={editCharisma}
                  onChange={(e) => setEditCharisma(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-300 font-bold mb-1">
                  ENERGY: {editEnergy}
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={editEnergy}
                  onChange={(e) => setEditEnergy(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-xs font-mono font-bold text-white hover:bg-white/15 cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl bg-neutral-950 border border-red-500/30 p-6 text-center">
            <Trash2 className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="font-serif font-black text-lg text-white mb-2">REMOVE CARD DEFINITION?</h3>
            <p className="text-xs font-sans text-neutral-400 mb-5">
              This card will no longer appear in future booster pack drops. Existing cards in player vaults remain untouched.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeletingCardId(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-xs font-mono text-white cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleDeleteCard(deletingCardId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white cursor-pointer"
              >
                CONFIRM REMOVAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE APPLICATION RESET CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <div
          id="admin-reset-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-neutral-950 border border-rose-500/40 p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setIsResetModalOpen(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-black text-white uppercase tracking-wider">
                  CONFIRM APPLICATION RESET
                </h3>
                <p className="text-xs font-mono text-rose-400">
                  PROTECTED ADMINISTRATOR ACTION
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-200 mb-5 space-y-2 font-sans">
              <p className="font-bold">
                WARNING: This will permanently delete all player data:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px] font-mono">
                <li>All player accounts and vaults</li>
                <li>All active sessions and history logs</li>
                <li>Master card catalog will remain safe</li>
                <li>Admin (6102000) will be automatically restored</li>
              </ul>
            </div>

            <form onSubmit={handleExecuteAppReset} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-1.5 font-bold">
                  Type <span className="text-rose-400 font-bold select-all">RESET-CONFIRM-6102000</span> to proceed:
                </label>
                <input
                  id="reset-confirmation-code-input"
                  type="text"
                  required
                  value={resetConfirmationInput}
                  onChange={(e) => setResetConfirmationInput(e.target.value)}
                  placeholder="RESET-CONFIRM-6102000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-rose-500/40 text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResettingApp}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono text-neutral-300 cursor-pointer disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  id="confirm-app-reset-execute-btn"
                  type="submit"
                  disabled={isResettingApp || resetConfirmationInput !== 'RESET-CONFIRM-6102000'}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-rose-600/30"
                >
                  {isResettingApp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>PURGING DATABASE...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>PERMANENTLY RESET</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
