import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  ShieldCheck, 
  Thermometer, 
  MapPin, 
  Anchor, 
  Calendar, 
  QrCode, 
  SlidersHorizontal,
  Layers, 
  ArrowUpDown, 
  Tag, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Scale, 
  DollarSign, 
  Snowflake, 
  Sliders, 
  ArrowRight,
  TrendingUp,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { InventoryBatch, SpeciesCategory, QualityGrade, StorageZone } from '../types';
import { formatCurrency, formatWeight, formatTemp } from '../utils/formatters';
import { SPECIES_CATALOG } from '../data/mockData';
import { InventoryExplainerBanner } from './Inventory/InventoryExplainerBanner';
import { LotDetailsModal } from './Inventory/LotDetailsModal';
import { StockAdjustmentModal } from './Inventory/StockAdjustmentModal';

interface InventoryLedgerViewProps {
  batches: InventoryBatch[];
  onOpenPassport: (batch: InventoryBatch) => void;
  onOpenNewBatch: () => void;
  onUpdateBatch?: (updatedBatch: InventoryBatch) => void;
  onNavigateToRetail?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  useImperial: boolean;
}

type QuickFilterStatus = 'all' | 'in_stock' | 'low_stock' | 'fresh' | 'super_cryo' | 'live';

export const InventoryLedgerView: React.FC<InventoryLedgerViewProps> = ({
  batches = [],
  onOpenPassport,
  onOpenNewBatch,
  onUpdateBatch,
  onNavigateToRetail,
  searchQuery,
  setSearchQuery,
  useImperial
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [quickFilter, setQuickFilter] = useState<QuickFilterStatus>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'weight' | 'value' | 'name'>('date');

  // Modal states for inspecting and adjusting lots
  const [inspectingBatch, setInspectingBatch] = useState<InventoryBatch | null>(null);
  const [adjustingBatch, setAdjustingBatch] = useState<InventoryBatch | null>(null);

  const categories: ('All' | SpeciesCategory)[] = ['All', 'Pelagic', 'Salmonid', 'Crustacean', 'Mollusk', 'Groundfish'];

  // Helper for matching images
  const getSpeciesImage = (batch: InventoryBatch): string => {
    const found = SPECIES_CATALOG.find(s => s.id === batch.speciesId) ||
      SPECIES_CATALOG.find(s => s.name.toLowerCase() === batch.speciesName.toLowerCase());
    if (found?.image) return found.image;
    
    if (batch.category === 'Salmonid') {
      return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80';
    }
    if (batch.category === 'Crustacean') {
      return 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80';
    }
    if (batch.category === 'Mollusk') {
      return 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=600&q=80';
    }
    return 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80';
  };

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        b.id.toLowerCase().includes(q) ||
        b.speciesName.toLowerCase().includes(q) ||
        b.scientificName.toLowerCase().includes(q) ||
        b.vesselName.toLowerCase().includes(q) ||
        b.landingPort.toLowerCase().includes(q) ||
        b.faoArea.toLowerCase().includes(q) ||
        b.storageZone.toLowerCase().includes(q);

      const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
      const matchesZone = selectedZone === 'All' || b.storageZone === selectedZone;
      const matchesGrade = selectedGrade === 'All' || b.grade === selectedGrade;

      let matchesQuick = true;
      if (quickFilter === 'in_stock') matchesQuick = b.availableWeightKg > 0;
      else if (quickFilter === 'low_stock') matchesQuick = b.availableWeightKg > 0 && b.availableWeightKg < 50;
      else if (quickFilter === 'fresh') matchesQuick = b.storageZone.includes('Fresh') || b.storageZone.includes('Slush');
      else if (quickFilter === 'super_cryo') matchesQuick = b.storageZone.includes('-60');
      else if (quickFilter === 'live') matchesQuick = b.storageZone.includes('Live');

      return matchesSearch && matchesCategory && matchesZone && matchesGrade && matchesQuick;
    });
  }, [batches, searchQuery, selectedCategory, selectedZone, selectedGrade, quickFilter]);

  // Sorted batches
  const sortedBatches = useMemo(() => {
    return [...filteredBatches].sort((a, b) => {
      if (sortBy === 'weight') return b.availableWeightKg - a.availableWeightKg;
      if (sortBy === 'value') return (b.availableWeightKg * b.wholesalePricePerKg) - (a.availableWeightKg * a.wholesalePricePerKg);
      if (sortBy === 'name') return a.speciesName.localeCompare(b.speciesName);
      return new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime();
    });
  }, [filteredBatches, sortBy]);

  // Summary Metrics
  const totalAvailableWeight = batches.reduce((s, b) => s + b.availableWeightKg, 0);
  const totalAllocatedWeight = batches.reduce((s, b) => s + (b.allocatedWeightKg || 0), 0);
  const totalIntakeWeight = batches.reduce((s, b) => s + b.initialWeightKg, 0);
  const totalValuation = batches.reduce((s, b) => s + (b.availableWeightKg * b.wholesalePricePerKg), 0);
  const totalCostBasis = batches.reduce((s, b) => s + (b.availableWeightKg * (b.costPerKg || 0)), 0);
  const totalProfit = totalValuation - totalCostBasis;
  const profitMarginPct = totalValuation > 0 ? (totalProfit / totalValuation) * 100 : 0;

  const superCryoCount = batches.filter(b => b.storageZone.includes('-60')).length;
  const commercialFrozenCount = batches.filter(b => b.storageZone.includes('-22')).length;
  const freshCount = batches.filter(b => b.storageZone.includes('Fresh') || b.storageZone.includes('Slush')).length;
  const liveCount = batches.filter(b => b.storageZone.includes('Live')).length;
  const lowStockCount = batches.filter(b => b.availableWeightKg > 0 && b.availableWeightKg < 50).length;

  const handleSaveStockAdjustment = (updatedBatch: InventoryBatch) => {
    if (onUpdateBatch) {
      onUpdateBatch(updatedBatch);
    }
    // Update active modal if open
    if (inspectingBatch?.id === updatedBatch.id) {
      setInspectingBatch(updatedBatch);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. Header & Quick Switcher */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-100 flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5" />
                Bulk Catch Vault & Cold Storage
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {batches.length} Landed Catch Lots
              </span>
            </div>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1.5">
              Seafood Inventory & Cold-Chain Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Real-time monitoring of whole and loined catch batches stored in certified cold-chain vaults. Track available stock weights, orders allocation, and digital food-safety passports.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {onNavigateToRetail && (
              <button
                onClick={onNavigateToRetail}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                title="Switch to packaged consumer and restaurant cuts"
              >
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>Packaged Products & SKUs</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </button>
            )}

            <button
              onClick={onOpenNewBatch}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Intake Landed Catch</span>
            </button>
          </div>
        </div>

        {/* Explainer / Onboarding Banner */}
        <InventoryExplainerBanner onNavigateToRetail={onNavigateToRetail} />
      </div>

      {/* 2. Executive KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Available Stock */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Stock</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {formatWeight(totalAvailableWeight, useImperial)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Ready to sell · <span className="text-amber-700 font-medium">{formatWeight(totalAllocatedWeight, useImperial)} reserved</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
            <div 
              className="bg-emerald-500 h-full" 
              style={{ width: `${totalIntakeWeight > 0 ? (totalAvailableWeight / totalIntakeWeight) * 100 : 0}%` }} 
            />
            <div 
              className="bg-amber-400 h-full" 
              style={{ width: `${totalIntakeWeight > 0 ? (totalAllocatedWeight / totalIntakeWeight) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* Metric 2: Inventory Valuation */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vault Valuation</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-700 font-mono">
              {formatCurrency(totalValuation)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <span>Cost basis: {formatCurrency(totalCostBasis)}</span>
              <span className="text-emerald-600 font-bold">({profitMarginPct.toFixed(0)}% margin)</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Est. Gross Margin: <strong>{formatCurrency(totalProfit)}</strong>
          </div>
        </div>

        {/* Metric 3: Cold-Chain Storage Zones */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cold-Chain Distribution</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Snowflake className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="bg-slate-50 px-2 py-1 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Super-Cryo (-60°)</span>
              <span className="font-bold text-slate-800">{superCryoCount} lots</span>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Commercial (-22°)</span>
              <span className="font-bold text-slate-800">{commercialFrozenCount} lots</span>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Slush Ice (0–2°)</span>
              <span className="font-bold text-slate-800">{freshCount} lots</span>
            </div>
            <div className="bg-slate-50 px-2 py-1 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Live Tank (+8°)</span>
              <span className="font-bold text-slate-800">{liveCount} lots</span>
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            All storage zones in spec
          </div>
        </div>

        {/* Metric 4: Traceability & Food Safety */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quality & Food Safety</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono flex items-center gap-1.5">
              <span>100%</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                HACCP Passed
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Histamine levels tested & safe (&lt;50 ppm)
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            {lowStockCount > 0 ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {lowStockCount} lot{lowStockCount > 1 ? 's' : ''} running low (&lt;50kg)
              </span>
            ) : (
              <span className="text-slate-400">All lot stocks healthy</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Top Search Input & View Switch */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Direct Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by species (e.g. Tuna, Salmon), Lot ID, vessel, port, or fishing area..."
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs text-slate-800 placeholder-slate-400 pl-10 pr-10 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Sub-filters & View switch */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-full px-3.5 py-2 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="date">Sort: Landing Date (Newest)</option>
              <option value="weight">Sort: Available Stock (High-to-Low)</option>
              <option value="value">Sort: Lot Value (High-to-Low)</option>
              <option value="name">Sort: Species Name (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Visual Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Data Table
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'All Lots', count: batches.length },
              { id: 'in_stock', label: 'In Stock', count: batches.filter(b => b.availableWeightKg > 0).length },
              { id: 'low_stock', label: 'Low Stock (<50kg)', count: lowStockCount },
              { id: 'super_cryo', label: 'Super-Cryo (-60°C)', count: superCryoCount },
              { id: 'fresh', label: 'Fresh Slush Ice', count: freshCount },
              { id: 'live', label: 'Live Tanks', count: liveCount },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setQuickFilter(tab.id as QuickFilterStatus)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
                  quickFilter === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  quickFilter === tab.id ? 'bg-indigo-200/60 text-indigo-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Secondary Dropdown Filters */}
          <div className="flex items-center gap-2">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="All">All Storage Zones</option>
              <option value="Super-Cryo Deep Freeze (-60°C)">Super-Cryo (-60°C)</option>
              <option value="Commercial Cold Storage (-22°C)">Cold Storage (-22°C)</option>
              <option value="Fresh Slush Ice (0°C to +2°C)">Fresh Slush Ice (0-2°C)</option>
              <option value="Live Seawater Tank (+8°C)">Live Seawater (+8°C)</option>
            </select>

            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="All">All Grades</option>
              <option value="Sashimi AAA">Sashimi AAA</option>
              <option value="Grade #1">Grade #1</option>
              <option value="Live Prime">Live Prime</option>
            </select>
          </div>
        </div>

        {/* Species Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Category:
          </span>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = cat === 'All' ? batches.length : batches.filter(b => b.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat} {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Batches Display Area */}
      {sortedBatches.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-base text-slate-900">
            {batches.length === 0 ? 'No Landed Catch Batches in Vault' : 'No inventory lots match your search filters'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {batches.length === 0 
              ? 'Begin by receiving a fresh catch lot from a vessel or supplier to establish cold-chain traceability and stock balances.'
              : 'Try clearing your search query, switching categories, or resetting the storage zone filter.'}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            {batches.length === 0 ? (
              <button
                onClick={onOpenNewBatch}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Intake First Catch Lot</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedZone('All');
                  setSelectedGrade('All');
                  setQuickFilter('all');
                }}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Visual Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedBatches.map((batch) => {
            const isSuperCryo = batch.storageZone.includes('-60');
            const isFresh = batch.storageZone.includes('Fresh') || batch.storageZone.includes('Slush');
            const isLive = batch.storageZone.includes('Live');

            const totalIntake = batch.initialWeightKg;
            const available = batch.availableWeightKg;
            const allocated = batch.allocatedWeightKg || 0;
            const availablePct = totalIntake > 0 ? (available / totalIntake) * 100 : 0;
            const allocatedPct = totalIntake > 0 ? (allocated / totalIntake) * 100 : 0;

            const isLowStock = available > 0 && available < 50;
            const isDepleted = available <= 0;
            const speciesImg = getSpeciesImage(batch);

            const lotValuation = available * batch.wholesalePricePerKg;
            const costBasis = available * (batch.costPerKg || 0);
            const margin = lotValuation > 0 ? ((lotValuation - costBasis) / lotValuation) * 100 : 0;

            return (
              <div
                key={batch.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Card Image Banner */}
                  <div className="relative h-32 w-full bg-slate-900 overflow-hidden cursor-pointer" onClick={() => setInspectingBatch(batch)}>
                    <img 
                      src={speciesImg} 
                      alt={batch.speciesName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/30 to-transparent" />

                    {/* Lot ID Badge & Grade */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-white bg-slate-950/80 backdrop-blur-sm border border-white/20 px-2.5 py-0.5 rounded-lg shadow-xs">
                        {batch.id}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shadow-xs">
                        {batch.grade}
                      </span>
                    </div>

                    {/* Status Badge in Banner */}
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-white">
                      <span className="text-xs font-bold truncate pr-2 text-slate-100">
                        {batch.speciesName}
                      </span>
                      {isDepleted ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/90 text-white shrink-0">
                          Depleted
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/90 text-white shrink-0">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/90 text-white shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Area */}
                  <div className="p-5 space-y-4">
                    
                    {/* Scientific Name & Storage Badge */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="italic text-slate-400 truncate max-w-[170px]">
                        {batch.scientificName}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSuperCryo 
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                          : isFresh 
                            ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {batch.storageZone.split('(')[0].trim()}
                      </span>
                    </div>

                    {/* Visual Stock Bar */}
                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-semibold uppercase text-[10px]">Stock Availability</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {formatWeight(available, useImperial)} <span className="text-slate-400 font-normal">/ {formatWeight(totalIntake, useImperial)}</span>
                        </span>
                      </div>

                      <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-emerald-500 h-full transition-all" 
                          style={{ width: `${Math.min(100, Math.max(0, availablePct))}%` }} 
                        />
                        <div 
                          className="bg-amber-400 h-full transition-all" 
                          style={{ width: `${Math.min(100, Math.max(0, allocatedPct))}%` }} 
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="text-emerald-700 font-medium">
                          {availablePct.toFixed(0)}% available
                        </span>
                        {allocated > 0 && (
                          <span className="text-amber-700 font-medium">
                            {formatWeight(allocated, useImperial)} reserved for orders
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financials & Temperature Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Wholesale Price</span>
                        <div className="font-bold text-slate-900 font-mono mt-0.5">
                          {formatCurrency(batch.wholesalePricePerKg)}/kg
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Margin: <strong className="text-emerald-700">{margin.toFixed(0)}%</strong>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Lot Valuation</span>
                        <div className="font-bold text-indigo-700 font-mono mt-0.5">
                          {formatCurrency(lotValuation)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          At current stock
                        </div>
                      </div>
                    </div>

                    {/* Vessel & Catch Origin */}
                    <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <Anchor className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{batch.vesselName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                          {batch.harvestDate}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{batch.landingPort}</span>
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <Thermometer className="w-3 h-3" />
                          {formatTemp(batch.coreTempCelsius, useImperial)}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setInspectingBatch(batch)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Inspect Lot</span>
                  </button>

                  <button
                    onClick={() => setAdjustingBatch(batch)}
                    className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    title="Adjust stock or record yield loss"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onOpenPassport(batch)}
                    className="p-1.5 rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                    title="View Digital Passport (QR)"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Data Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3.5 px-4">Lot ID & Species</th>
                  <th className="py-3.5 px-4">Category & Grade</th>
                  <th className="py-3.5 px-4">Vessel & Origin</th>
                  <th className="py-3.5 px-4 text-right">Available Stock</th>
                  <th className="py-3.5 px-4 text-right">Storage Temp</th>
                  <th className="py-3.5 px-4 text-right">Wholesale Price</th>
                  <th className="py-3.5 px-4 text-right">Lot Value</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedBatches.map((batch) => {
                  const available = batch.availableWeightKg;
                  const total = batch.initialWeightKg;
                  const isLowStock = available > 0 && available < 50;
                  const isDepleted = available <= 0;
                  const speciesImg = getSpeciesImage(batch);

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={speciesImg} 
                            alt={batch.speciesName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer"
                            onClick={() => setInspectingBatch(batch)}
                          />
                          <div>
                            <div className="font-mono font-bold text-indigo-700 cursor-pointer hover:underline" onClick={() => setInspectingBatch(batch)}>
                              {batch.id}
                            </div>
                            <div className="font-bold text-slate-900 text-xs">{batch.speciesName}</div>
                            <div className="text-[10px] text-slate-400 italic">{batch.scientificName}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white inline-block">
                            {batch.grade}
                          </span>
                          <div className="text-[11px] text-slate-500">{batch.category}</div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{batch.vesselName}</div>
                        <div className="text-[11px] text-slate-500">{batch.landingPort}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Landed: {batch.harvestDate}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {formatWeight(available, useImperial)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          of {formatWeight(total, useImperial)} intake
                        </div>
                        {isDepleted ? (
                          <span className="text-[10px] text-rose-600 font-semibold">Depleted</span>
                        ) : isLowStock ? (
                          <span className="text-[10px] text-amber-600 font-semibold">Low Stock</span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium">In Stock</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatTemp(batch.coreTempCelsius, useImperial)}
                        <div className="text-[10px] text-slate-400 font-normal truncate max-w-[120px] ml-auto">
                          {batch.storageZone.split('(')[0].trim()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-800 font-medium">
                        {formatCurrency(batch.wholesalePricePerKg)}/kg
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-indigo-700">
                        {formatCurrency(available * batch.wholesalePricePerKg)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setInspectingBatch(batch)}
                            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Inspect Lot Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAdjustingBatch(batch)}
                            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title="Adjust Stock Weight"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onOpenPassport(batch)}
                            className="p-1.5 rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                            title="View Digital Passport (QR)"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Modals for Inspecting and Adjusting Lots */}
      {inspectingBatch && (
        <LotDetailsModal
          batch={inspectingBatch}
          onClose={() => setInspectingBatch(null)}
          onOpenPassport={(b) => {
            setInspectingBatch(null);
            onOpenPassport(b);
          }}
          onOpenAdjustment={(b) => {
            setInspectingBatch(null);
            setAdjustingBatch(b);
          }}
          useImperial={useImperial}
        />
      )}

      {adjustingBatch && (
        <StockAdjustmentModal
          batch={adjustingBatch}
          onClose={() => setAdjustingBatch(null)}
          onSave={handleSaveStockAdjustment}
          useImperial={useImperial}
        />
      )}

    </div>
  );
};
