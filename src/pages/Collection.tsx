import React, { useState, useMemo } from 'react';
import { CollectedCard, Rarity } from '../types';
import { Card } from '../components/Card';
import { RARITIES } from '../data/rarity';
import { soundManager } from '../utils/audio';
import {
  Layers,
  Sparkles,
  Search,
  SlidersHorizontal,
  PackageOpen,
  ArrowUpDown,
  Filter,
} from 'lucide-react';

interface CollectionProps {
  collection: Record<string, CollectedCard>;
  packsOpened: number;
  totalCatalogCount: number;
  onOpenFirstPack: () => void;
  onSelectCard: (card: CollectedCard) => void;
}

export const Collection: React.FC<CollectionProps> = ({
  collection,
  packsOpened,
  totalCatalogCount,
  onOpenFirstPack,
  onSelectCard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<Rarity | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'rarity' | 'copies' | 'name'>('number');

  const collectedList = useMemo(() => Object.values(collection), [collection]);
  const totalCardsInVault = useMemo(
    () => collectedList.reduce((sum, item) => sum + item.copies, 0),
    [collectedList]
  );

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    collectedList.forEach((item) => {
      if (item.card.category) set.add(item.card.category);
    });
    return Array.from(set).sort();
  }, [collectedList]);

  // Rarity weight for sorting
  const rarityWeights: Record<Rarity, number> = {
    LEGENDARY: 6,
    ULTRA_RARE: 5,
    EPIC: 4,
    RARE: 3,
    UNCOMMON: 2,
    COMMON: 1,
  };

  // Filtered and sorted list
  const filteredCards = useMemo(() => {
    return collectedList
      .filter((item) => {
        const matchesSearch =
          item.card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.card.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.card.cardNumber.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRarity =
          selectedRarity === 'ALL' || item.card.rarity === selectedRarity;

        const matchesCategory =
          selectedCategory === 'ALL' || item.card.category === selectedCategory;

        return matchesSearch && matchesRarity && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'number') {
          return a.card.cardNumber.localeCompare(b.card.cardNumber);
        }
        if (sortBy === 'rarity') {
          return (
            (rarityWeights[b.card.rarity] || 0) - (rarityWeights[a.card.rarity] || 0)
          );
        }
        if (sortBy === 'copies') {
          return b.copies - a.copies;
        }
        if (sortBy === 'name') {
          return a.card.name.localeCompare(b.card.name);
        }
        return 0;
      });
  }, [collectedList, searchQuery, selectedRarity, selectedCategory, sortBy]);

  // Handle Card click
  const handleCardClick = (item: CollectedCard) => {
    soundManager.playButtonClick();
    onSelectCard(item);
  };

  return (
    <div
      id="collection-screen"
      className="relative min-h-[calc(100dvh-4rem)] w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 select-none"
    >
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-mono font-bold tracking-widest text-indigo-300 mb-2">
            <Layers className="w-3 h-3 text-sky-400" />
            <span>VAULT REPOSITORY</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-serif uppercase tracking-widest text-white">
            MY COLLECTION
          </h1>
          <p className="text-xs sm:text-sm font-sans text-neutral-400 mt-1">
            Inspect, filter, and admire your unlocked Person Cards.
          </p>
        </div>

        {/* Top 3 Stats Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Total Cards
            </span>
            <span className="text-lg sm:text-xl font-bold font-mono text-white">
              {totalCardsInVault}
            </span>
          </div>

          <div className="px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Unique Cards
            </span>
            <span className="text-lg sm:text-xl font-bold font-mono text-sky-400">
              {collectedList.length}{' '}
              <span className="text-xs text-neutral-500 font-normal">
                / {totalCatalogCount}
              </span>
            </span>
          </div>

          <div className="px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Packs Opened
            </span>
            <span className="text-lg sm:text-xl font-bold font-mono text-indigo-400">
              {packsOpened}
            </span>
          </div>
        </div>
      </div>

      {/* --- EMPTY STATE (If user hasn't opened any packs) --- */}
      {collectedList.length === 0 ? (
        <div
          id="empty-collection-state"
          className="flex flex-col items-center justify-center p-12 my-12 rounded-3xl bg-neutral-950/60 border border-white/10 text-center max-w-lg mx-auto backdrop-blur-md shadow-2xl"
        >
          {/* Animated empty state illustration */}
          <div className="relative w-24 h-24 rounded-full bg-indigo-950/60 border border-indigo-400/30 flex items-center justify-center mb-6 shadow-inner animate-pulse">
            <div className="absolute inset-0 rounded-full border border-sky-400/20 animate-ping" />
            <PackageOpen className="w-12 h-12 text-sky-400" />
          </div>

          <h2 className="text-2xl font-black font-serif uppercase tracking-wider text-white">
            YOUR COLLECTION IS EMPTY
          </h2>
          <p className="text-sm font-sans text-neutral-400 mt-2 max-w-xs leading-relaxed">
            Open your first pack to discover your first collectible Person Cards.
          </p>

          <button
            id="open-first-pack-btn"
            onClick={onOpenFirstPack}
            className="mt-6 flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 hover:from-sky-300 hover:to-purple-400 text-slate-950 font-black font-serif tracking-widest text-sm uppercase shadow-xl shadow-sky-500/30 cursor-pointer hover:scale-105 transition-all"
          >
            <Sparkles className="w-4 h-4 text-black" />
            <span>OPEN FIRST PACK</span>
          </button>
        </div>
      ) : (
        <>
          {/* --- SEARCH & FILTERS BAR --- */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-collection-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, or card #..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-900/80 border border-white/15 text-xs font-mono text-white placeholder-neutral-500 focus:outline-hidden focus:border-sky-400"
              />
            </div>

            {/* Category Dropdown & Sort dropdown */}
            <div className="flex items-center gap-2">
              {categories.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-neutral-900 border border-white/15 text-xs font-mono text-neutral-300 focus:outline-hidden focus:border-sky-400 cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 border border-white/15 text-xs font-mono text-neutral-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-white focus:outline-hidden cursor-pointer"
                >
                  <option value="number" className="bg-neutral-900">
                    Sort: Card #
                  </option>
                  <option value="rarity" className="bg-neutral-900">
                    Sort: Rarity (Highest)
                  </option>
                  <option value="copies" className="bg-neutral-900">
                    Sort: Copies (Most)
                  </option>
                  <option value="name" className="bg-neutral-900">
                    Sort: Name (A-Z)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* --- RARITY PILL FILTERS --- */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
            <button
              onClick={() => setSelectedRarity('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                selectedRarity === 'ALL'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10'
              }`}
            >
              ALL ({collectedList.length})
            </button>

            {(Object.keys(RARITIES) as Rarity[]).map((rKey) => {
              const r = RARITIES[rKey];
              const count = collectedList.filter((item) => item.card.rarity === rKey).length;
              const isSelected = selectedRarity === rKey;

              return (
                <button
                  key={rKey}
                  onClick={() => setSelectedRarity(rKey)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'shadow-md scale-105'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isSelected ? r.color : `${r.color}15`,
                    borderColor: `${r.color}66`,
                    color: isSelected ? '#000000' : r.color,
                  }}
                >
                  <span>{r.label}</span>
                  <span className="text-[10px] opacity-80">({count})</span>
                </button>
              );
            })}
          </div>

          {/* --- CARDS GRID --- */}
          {filteredCards.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
              {filteredCards.map((item) => (
                <div
                  key={item.cardId}
                  onClick={() => handleCardClick(item)}
                  className="flex justify-center transition-transform duration-200 hover:-translate-y-1.5"
                >
                  <Card
                    card={item.card}
                    copies={item.copies}
                    size="sm"
                    interactiveTilt={false}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-neutral-400 font-mono text-sm border border-white/10 rounded-2xl bg-white/5 my-8">
              No Person Cards match your search or rarity filter.
            </div>
          )}
        </>
      )}
    </div>
  );
};
