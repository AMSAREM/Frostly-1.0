import React, { useState } from 'react';
import { 
  Ship, 
  Search, 
  Plus, 
  Anchor, 
  MapPin, 
  Phone, 
  Mail, 
  Star, 
  DollarSign, 
  Package, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingDown,
  Building2,
  FileText
} from 'lucide-react';
import { Supplier, PurchaseOrderLanding, SupplierType, QualityGrade, StorageZone } from '../types';

interface SuppliersViewProps {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrderLanding[];
  onAddSupplier: (supplier: Supplier) => void;
  onAddPurchaseOrder: (po: PurchaseOrderLanding) => void;
  onRecordPayment: (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => void;
  formatCurrency: (amount: number) => string;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers = [],
  purchaseOrders = [],
  onAddSupplier,
  onAddPurchaseOrder,
  onRecordPayment,
  formatCurrency
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'inward_catch'>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isNewCatchModalOpen, setIsNewCatchModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');

  // Settle Bill target
  const [targetSupplierForSettle, setTargetSupplierForSettle] = useState<Supplier | null>(null);

  // New Supplier Form State
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supType, setSupType] = useState<SupplierType>('Fishermen Co-op');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supPort, setSupPort] = useState('');
  const [supCountry, setSupCountry] = useState('USA');
  const [supSpecies, setSupSpecies] = useState('');
  const [supTerms, setSupTerms] = useState<any>('Net-15');
  const [supNotes, setSupNotes] = useState('');

  // New Inward Catch / PO Form State
  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id || '');
  const [poVessel, setPoVessel] = useState('');
  const [poSpeciesName, setPoSpeciesName] = useState('');
  const [poWeightKg, setPoWeightKg] = useState('');
  const [poCostPerKg, setPoCostPerKg] = useState('');
  const [poGrade, setPoGrade] = useState<QualityGrade>('Grade #1');
  const [poStorageZone, setPoStorageZone] = useState<StorageZone>('Commercial Cold Storage (-22°C)');
  const [poNotes, setPoNotes] = useState('');

  // Aggregations
  const totalPayables = suppliers.reduce((sum, s) => sum + s.outstandingPayableUSD, 0);
  const totalSourcedWeight = suppliers.reduce((sum, s) => sum + s.totalWeightSuppliedKg, 0);
  const totalLifetimePaid = suppliers.reduce((sum, s) => sum + s.totalPurchasedUSD, 0);

  const filteredSuppliers = suppliers.filter(sup => {
    const matchesType = filterType === 'all' || sup.type === filterType;
    const matchesSearch = 
      sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sup.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sup.portLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sup.suppliedSpecies.some(sp => sp.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const handleCreateSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supEmail.trim()) return;

    const newSup: Supplier = {
      id: `SUP-${(suppliers.length + 201).toString()}`,
      name: supName.trim(),
      contactPerson: supContact.trim() || 'Fleet Dispatcher',
      type: supType,
      email: supEmail.trim(),
      phone: supPhone.trim(),
      portLocation: supPort.trim() || 'Local Commercial Pier',
      country: supCountry.trim(),
      suppliedSpecies: supSpecies ? supSpecies.split(',').map(s => s.trim()) : ['Mixed Groundfish'],
      paymentTerms: supTerms,
      outstandingPayableUSD: 0,
      totalPurchasedUSD: 0,
      totalWeightSuppliedKg: 0,
      rating: 5.0,
      status: 'Active',
      notes: supNotes.trim()
    };

    onAddSupplier(newSup);
    setIsAddSupplierModalOpen(false);
    // Reset Form
    setSupName('');
    setSupContact('');
    setSupEmail('');
    setSupPhone('');
    setSupPort('');
    setSupSpecies('');
    setSupNotes('');
  };

  const handleCreateCatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === poSupplierId) || suppliers[0];
    const weight = parseFloat(poWeightKg);
    const unitCost = parseFloat(poCostPerKg);
    if (isNaN(weight) || isNaN(unitCost) || weight <= 0 || unitCost <= 0) return;

    const totalCost = weight * unitCost;
    const newPO: PurchaseOrderLanding = {
      id: `PO-${(8820 + purchaseOrders.length + 1).toString()}`,
      supplierId: sup.id,
      supplierName: sup.name,
      vesselName: poVessel || 'Direct Harvester Haul',
      portLocation: sup.portLocation,
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date().toISOString().split('T')[0],
      speciesItems: [
        {
          speciesName: poSpeciesName,
          weightKg: weight,
          costPerKg: unitCost,
          totalCost: totalCost,
          grade: poGrade,
          storageZone: poStorageZone
        }
      ],
      totalCostUSD: totalCost,
      paymentStatus: 'Pending Settlement',
      paymentDueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      receivedBy: 'Dock Receiving Master',
      lotAssignedId: `LOT-${new Date().getFullYear()}-${poSpeciesName.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Received & In Stock',
      notes: poNotes.trim() || 'Landed catch inspected and verified at dock scale.'
    };

    onAddPurchaseOrder(newPO);
    setIsNewCatchModalOpen(false);
    setPoNotes('');
  };

  const handleOpenSettleModal = (sup: Supplier) => {
    setTargetSupplierForSettle(sup);
    setSettleAmount(sup.outstandingPayableUSD.toString());
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSupplierForSettle) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;

    onRecordPayment('AP', targetSupplierForSettle.id, amt, targetSupplierForSettle.id);
    setIsSettleModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Switcher and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100/80 text-blue-700 rounded-xl">
              <Ship className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Suppliers & Catch Landings</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Harvester fleet co-ops, aquaculture farms, vessel captains, and inward seafood purchase orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'suppliers'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Supplier Directory
            </button>
            <button
              onClick={() => setActiveTab('inward_catch')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'inward_catch'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Catch Inward Logs</span>
              <span className="px-1.5 py-0.5 text-[10px] bg-indigo-100 text-indigo-800 rounded-full font-extrabold">
                {purchaseOrders.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsNewCatchModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Anchor className="w-4 h-4" />
              <span>Log Catch</span>
            </button>

            <button
              onClick={() => setIsAddSupplierModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sourcing Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Sourcing Partners</div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">{suppliers.length} Fleets & Farms</div>
          <div className="text-xs text-slate-500">100% sustainable quota audited</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Payables (AP)</div>
          <div className="text-2xl font-black text-rose-700 font-mono-code">{formatCurrency(totalPayables)}</div>
          <div className="text-xs text-slate-500">Harvester boat settlement due</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sourced Biomass</div>
          <div className="text-2xl font-black text-indigo-700 font-mono-code">{(totalSourcedWeight / 1000).toFixed(1)} Metric Tons</div>
          <div className="text-xs text-slate-500">{totalSourcedWeight.toLocaleString()} kg landed volume</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Harvester Payouts</div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">{formatCurrency(totalLifetimePaid)}</div>
          <div className="text-xs text-slate-500">Direct-to-dock procurement value</div>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search suppliers by name, port location, or species..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <span className="text-xs text-slate-400 font-medium shrink-0">Type:</span>
              {['all', 'Fishermen Co-op', 'Aquaculture Farm', 'Vessel / Fleet Captain', 'Fish Auction / Wholesaler'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    filterType === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t === 'all' ? 'All Partners' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Supplier Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSuppliers.map((sup) => {
              const hasPayable = sup.outstandingPayableUSD > 0;
              return (
                <div 
                  key={sup.id} 
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-bold text-slate-900">{sup.name}</h3>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{sup.portLocation}, {sup.country}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-amber-50 text-amber-900 px-2 py-0.5 rounded-lg text-xs font-bold border border-amber-200/60 shrink-0">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span>{sup.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold">
                        {sup.type}
                      </span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-semibold border border-blue-100">
                        {sup.paymentTerms}
                      </span>
                    </div>

                    {/* Sourced Species Tags */}
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Primary Catch / Biomass:</div>
                      <div className="flex flex-wrap gap-1">
                        {sup.suppliedSpecies.map(sp => (
                          <span key={sp} className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-[10px] font-medium">
                            {sp}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Vessels if any */}
                    {sup.vesselNames && sup.vesselNames.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                        <Anchor className="w-3 h-3 text-slate-400" />
                        <span>Vessels: {sup.vesselNames.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Sourcing Box */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Sourced Catch:</span>
                      <span className="font-mono-code font-bold text-slate-800">{sup.totalWeightSuppliedKg.toLocaleString()} kg</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Outstanding Bill Due:</span>
                      <span className={`font-mono-code font-bold ${hasPayable ? 'text-rose-700 text-sm' : 'text-emerald-600'}`}>
                        {hasPayable ? formatCurrency(sup.outstandingPayableUSD) : '$0.00 (Settled)'}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setSelectedSupplier(sup)}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Profile
                      </button>

                      {hasPayable ? (
                        <button
                          onClick={() => handleOpenSettleModal(sup)}
                          className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Settle Bill
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPoSupplierId(sup.id);
                            setIsNewCatchModalOpen(true);
                          }}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Intake Catch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inward Catch Purchase Orders Tab */}
      {activeTab === 'inward_catch' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Inward Catch Logs & Purchase Orders</h2>
              <p className="text-xs text-slate-500">Dock receipts, assigned lot numbers, landed weights, and procurement costs.</p>
            </div>

            <button
              onClick={() => setIsNewCatchModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Record Landed Haul</span>
            </button>
          </div>

          {/* Mobile Cards for Catch Purchase Orders */}
          <div className="space-y-3 md:hidden">
            {purchaseOrders.map((po) => {
              const item = po.speciesItems[0];
              const isUnpaid = po.paymentStatus !== 'Paid in Full';
              return (
                <div key={po.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{po.supplierName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Ship className="w-3 h-3 text-slate-400" />
                        <span>{po.vesselName} • {po.portLocation}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      po.paymentStatus === 'Paid in Full'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {po.paymentStatus}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item?.speciesName}</span>
                      <span className="font-mono-code font-bold text-indigo-600 text-[10px]">{po.lotAssignedId}</span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {item?.weightKg.toLocaleString()} kg @ {formatCurrency(item?.costPerKgUSD || 0)}/kg ({item?.grade})
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">PO ID</span>
                      <span className="font-mono-code text-slate-700 font-bold">{po.id}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Landing Cost</span>
                      <span className="font-mono-code font-black text-rose-700 text-sm">{formatCurrency(po.totalCostUSD)}</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    {isUnpaid ? (
                      <button
                        onClick={() => {
                          const sup = suppliers.find(s => s.id === po.supplierId);
                          if (sup) handleOpenSettleModal(sup);
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center cursor-pointer"
                      >
                        Settle Payout ({formatCurrency(po.totalCostUSD)})
                      </button>
                    ) : (
                      <div className="text-center py-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl border border-emerald-200/60">
                        Payment Cleared
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">PO & Lot ID</th>
                  <th className="py-3.5 px-4">Supplier / Vessel</th>
                  <th className="py-3.5 px-4">Landed Species</th>
                  <th className="py-3.5 px-4">Weight & Unit Cost</th>
                  <th className="py-3.5 px-4 text-right">Total Landing Cost</th>
                  <th className="py-3.5 px-4 text-center">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders.map((po) => {
                  const item = po.speciesItems[0];
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono-code text-sm">{po.id}</div>
                        <div className="text-slate-400 text-[11px] font-mono-code">{po.lotAssignedId}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{po.supplierName}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1">
                          <Ship className="w-3 h-3 text-slate-400" />
                          <span>{po.vesselName} • {po.portLocation}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{item?.speciesName}</div>
                        <div className="text-indigo-600 text-[10px] font-bold">{item?.grade}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono-code">
                        <div className="font-bold text-slate-900">{item?.weightKg.toLocaleString()} kg</div>
                        <div className="text-slate-400 text-[11px]">@{formatCurrency(item?.costPerKg || 0)}/kg</div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono-code font-black text-sm text-slate-900">
                        {formatCurrency(po.totalCostUSD)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          po.paymentStatus === 'Paid in Full'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {po.paymentStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {po.paymentStatus !== 'Paid in Full' ? (
                          <button
                            onClick={() => {
                              const sup = suppliers.find(s => s.id === po.supplierId);
                              if (sup) handleOpenSettleModal(sup);
                            }}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Pay Payout
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">Cleared</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Inward Catch / New Purchase Order Modal */}
      {isNewCatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Anchor className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Log Inward Landed Catch (Dock PO)</h3>
              </div>
              <button 
                onClick={() => setIsNewCatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCatchSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Source Supplier / Fleet</label>
                  <select
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.portLocation})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vessel / Boat Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kaiyo Maru No. 8"
                    value={poVessel}
                    onChange={(e) => setPoVessel(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Seafood Species</label>
                  <select
                    value={poSpeciesName}
                    onChange={(e) => setPoSpeciesName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Pacific Bluefin Tuna (Hon-Maguro)">Pacific Bluefin Tuna (Hon-Maguro)</option>
                    <option value="Yellowfin Tuna (Ahi Loin)">Yellowfin Tuna (Ahi Loin)</option>
                    <option value="Wild King & Atlantic Salmon (Icy Fjord)">Wild King & Atlantic Salmon (Icy Fjord)</option>
                    <option value="Red King Crab (Whole Clusters)">Red King Crab (Whole Clusters)</option>
                    <option value="North Atlantic Hard-Shell Live Lobster">North Atlantic Hard-Shell Live Lobster</option>
                    <option value="Hokkaido Diver Scallops (U-10)">Hokkaido Diver Scallops (U-10)</option>
                    <option value="Jumbo Black Tiger Prawns">Jumbo Black Tiger Prawns</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quality Inspection Grade</label>
                  <select
                    value={poGrade}
                    onChange={(e) => setPoGrade(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Sashimi AAA">Sashimi AAA (Prime sashimi)</option>
                    <option value="Grade #1">Grade #1 (Top restaurant quality)</option>
                    <option value="Grade #2">Grade #2 (Standard kitchen)</option>
                    <option value="Live Prime">Live Prime (Active seawater)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Landed Weight (kg)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={poWeightKg}
                    onChange={(e) => setPoWeightKg(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-xs text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Landing Unit Cost ($ / kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={poCostPerKg}
                    onChange={(e) => setPoCostPerKg(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-xs text-slate-900"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Allocated Storage Zone</label>
                  <select
                    value={poStorageZone}
                    onChange={(e) => setPoStorageZone(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Super-Cryo Deep Freeze (-60°C)">Super-Cryo Deep Freeze (-60°C)</option>
                    <option value="Fresh Slush Ice (0°C to +2°C)">Fresh Slush Ice (0°C to +2°C)</option>
                    <option value="Commercial Cold Storage (-22°C)">Commercial Cold Storage (-22°C)</option>
                    <option value="Live Seawater Tank (+8°C)">Live Seawater Tank (+8°C)</option>
                  </select>
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Calculated Harvester Total Payable:</div>
                  <div className="text-sm font-bold text-slate-900">
                    {poWeightKg} kg × ${poCostPerKg}/kg
                  </div>
                </div>
                <div className="text-xl font-black text-rose-700 font-mono-code">
                  {formatCurrency((parseFloat(poWeightKg) || 0) * (parseFloat(poCostPerKg) || 0))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCatchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Confirm Intake & Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Ship className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add Sourcing Partner / Harvester</h3>
              </div>
              <button 
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSupplierSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Co-Op Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Puget Sound Salmon Harvesters"
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Category</label>
                  <select
                    value={supType}
                    onChange={(e) => setSupType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Fishermen Co-op">Fishermen Co-op</option>
                    <option value="Aquaculture Farm">Aquaculture Farm</option>
                    <option value="Vessel / Fleet Captain">Vessel / Fleet Captain</option>
                    <option value="Fish Auction / Wholesaler">Fish Auction / Wholesaler</option>
                    <option value="Direct Marine Import">Direct Marine Import</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Capt. James Peterson"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="dispatch@fleet.com"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (206) 000-0000"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Home Port & Country</label>
                  <input
                    type="text"
                    placeholder="Seattle Pier 91, USA"
                    value={supPort}
                    onChange={(e) => setSupPort(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplied Species (comma separated)</label>
                  <input
                    type="text"
                    placeholder="King Salmon, Halibut, Dungeness Crab"
                    value={supSpecies}
                    onChange={(e) => setSupSpecies(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Settlement Terms</label>
                  <select
                    value={supTerms}
                    onChange={(e) => setSupTerms(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Net-15">Net-15</option>
                    <option value="Net-30">Net-30</option>
                    <option value="Cash on Dock (COD)">Cash on Dock (COD)</option>
                    <option value="Weekly Settlement">Weekly Settlement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes & Quota Certifications</label>
                <textarea
                  rows={2}
                  placeholder="e.g. MSC certified, Iki-jime bleed on deck..."
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save Supplier Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Supplier Bill Modal */}
      {isSettleModalOpen && targetSupplierForSettle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Settle Harvester Payout</h3>
              </div>
              <button 
                onClick={() => setIsSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Supplier <strong>{targetSupplierForSettle.name}</strong> has an outstanding payable of <strong>{formatCurrency(targetSupplierForSettle.outstandingPayableUSD)}</strong>.
            </p>

            <form onSubmit={handleConfirmSettle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Settlement Amount ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={targetSupplierForSettle.outstandingPayableUSD}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Disburse Wire & Post COGS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
