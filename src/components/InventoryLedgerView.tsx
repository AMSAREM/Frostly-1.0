import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { InventoryBatch, SpeciesCategory, QualityGrade, StorageZone } from '../types';
import { formatCurrency, formatWeight, formatTemp } from '../utils/formatters';

interface InventoryLedgerViewProps {
  batches: InventoryBatch[];
  onOpenPassport: (batch: InventoryBatch) => void;
  onOpenNewBatch: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  useImperial: boolean;
}

export const InventoryLedgerView: React.FC<InventoryLedgerViewProps> = ({
  batches = [],
  onOpenPassport,
  onOpenNewBatch,
  searchQuery,
  setSearchQuery,
  useImperial
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'weight' | 'value'>('date');

  const categories: ('All' | SpeciesCategory)[] = ['All', 'Pelagic', 'Salmonid', 'Crustacean', 'Mollusk', 'Groundfish'];

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    const matchesSearch = 
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.speciesName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.scientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.vesselName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.landingPort.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.faoArea.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
    const matchesZone = selectedZone === 'All' || b.storageZone === selectedZone;
    const matchesGrade = selectedGrade === 'All' || b.grade === selectedGrade;

    return matchesSearch && matchesCategory && matchesZone && matchesGrade;
  });

  // Sorted batches
  const sortedBatches = [...filteredBatches].sort((a, b) => {
    if (sortBy === 'weight') return b.availableWeightKg - a.availableWeightKg;
    if (sortBy === 'value') return (b.availableWeightKg * b.wholesalePricePerKg) - (a.availableWeightKg * a.wholesalePricePerKg);
    return new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime();
  });

  const totalFilteredWeight = filteredBatches.reduce((s, b) => s + b.availableWeightKg, 0);
  const totalFilteredValuation = filteredBatches.reduce((s, b) => s + (b.availableWeightKg * b.wholesalePricePerKg), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-100">
                Seafood Traceability Ledger
              </span>
              <span className="text-xs text-slate-400 font-mono-code">
                {filteredBatches.length} of {batches.length} Lots Active
              </span>
            </div>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1.5">
              Catch Inventory & Cold-Chain Vault
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              End-to-end traceability with verified landing manifests, histamine assays, and temperature logs.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-slate-400 font-medium">Vault Valuation</div>
              <div className="text-base font-extrabold text-slate-900 font-mono-code">
                {formatCurrency(totalFilteredValuation)}
              </div>
            </div>

            <button
              onClick={onOpenNewBatch}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Intake Landed Catch</span>
            </button>
          </div>
        </div>

        {/* Category Pills & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Right Sub-filters & View switch */}
          <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none flex-1 sm:flex-initial"
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
              className="bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none flex-1 sm:flex-initial"
            >
              <option value="All">All Grades</option>
              <option value="Sashimi AAA">Sashimi AAA</option>
              <option value="Grade #1">Grade #1</option>
              <option value="Live Prime">Live Prime</option>
            </select>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-500'
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-500'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Batches Content Area */}
      {sortedBatches.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-base text-slate-900">No inventory batches match your search</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keywords, species category, or storage zone filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedZone('All');
              setSelectedGrade('All');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedBatches.map((batch) => {
            const isSuperCryo = batch.storageZone.includes('-60');
            const isFresh = batch.storageZone.includes('Fresh');
            const isLive = batch.storageZone.includes('Live');

            return (
              <div
                key={batch.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-4">
                  {/* Card Header: Lot ID, Grade Badge, Temp */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-code text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                      {batch.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900 text-white">
                        {batch.grade}
                      </span>
                    </div>
                  </div>

                  {/* Species Title & Scientific Name */}
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {batch.speciesName}
                    </h3>
                    <p className="text-xs text-slate-400 italic">
                      {batch.scientificName}
                    </p>
                  </div>

                  {/* Core Metrics Bento Box */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Available Stock</div>
                      <div className="font-bold text-slate-900 font-mono-code text-sm">
                        {formatWeight(batch.availableWeightKg, useImperial)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        of {formatWeight(batch.initialWeightKg, useImperial)} intake
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Landed Core Temp</div>
                      <div className={`font-bold font-mono-code text-sm flex items-center gap-1 ${
                        isSuperCryo ? 'text-indigo-600' : isFresh ? 'text-teal-600' : 'text-slate-800'
                      }`}>
                        <Thermometer className="w-3.5 h-3.5 shrink-0" />
                        {formatTemp(batch.coreTempCelsius, useImperial)}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium">Safe Cold Chain</div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Wholesale Price</div>
                      <div className="font-bold text-slate-900 font-mono-code">
                        {formatCurrency(batch.wholesalePricePerKg)}/kg
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Batch Valuation</div>
                      <div className="font-bold text-indigo-700 font-mono-code">
                        {formatCurrency(batch.availableWeightKg * batch.wholesalePricePerKg)}
                      </div>
                    </div>
                  </div>

                  {/* Vessel & Catch Origin Details */}
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-slate-800">{batch.vesselName}</span>
                      <span className="text-slate-400">({batch.landingPort})</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{batch.faoArea}</span>
                    </div>
                  </div>

                  {/* Certifications Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {batch.certifications.slice(0, 2).map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md"
                      >
                        {c}
                      </span>
                    ))}
                    {batch.certifications.length > 2 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{batch.certifications.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>HACCP Passed</span>
                  </div>

                  <button
                    onClick={() => onOpenPassport(batch)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-100 text-indigo-700 font-bold text-xs border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Digital Passport</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3.5 px-4">Lot ID & Species</th>
                  <th className="py-3.5 px-4">Vessel & FAO Area</th>
                  <th className="py-3.5 px-4">Grade</th>
                  <th className="py-3.5 px-4 text-right">Available Stock</th>
                  <th className="py-3.5 px-4 text-right">Storage Temp</th>
                  <th className="py-3.5 px-4 text-right">Unit Price</th>
                  <th className="py-3.5 px-4 text-right">Batch Value</th>
                  <th className="py-3.5 px-4 text-center">Passport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono-code font-bold text-indigo-700">{batch.id}</div>
                      <div className="font-bold text-slate-900 text-xs">{batch.speciesName}</div>
                      <div className="text-[10px] text-slate-400 italic">{batch.scientificName}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{batch.vesselName}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{batch.faoArea}</div>
                      <div className="text-[10px] text-slate-400">Landed: {batch.harvestDate}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                        {batch.grade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-code font-bold text-slate-900">
                      {formatWeight(batch.availableWeightKg, useImperial)}
                      <div className="text-[10px] text-slate-400 font-normal">
                        ({formatWeight(batch.initialWeightKg, useImperial)} init)
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-code font-bold text-emerald-700">
                      {formatTemp(batch.coreTempCelsius, useImperial)}
                      <div className="text-[10px] text-slate-400 font-normal truncate max-w-[120px] ml-auto">
                        {batch.storageZone.split(' ')[0]}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-code text-slate-700">
                      {formatCurrency(batch.wholesalePricePerKg)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-code font-extrabold text-indigo-700">
                      {formatCurrency(batch.availableWeightKg * batch.wholesalePricePerKg)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onOpenPassport(batch)}
                        className="p-2 rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                        title="View Digital Traceability Passport"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
