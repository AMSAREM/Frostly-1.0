import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Plus, 
  History, 
  Sliders, 
  TrendingDown, 
  TrendingUp, 
  Database, 
  CheckCircle2, 
  Scale, 
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { InventoryAdjustmentAccount, InventoryStockAdjustment } from '../../types';
import { formatCurrency as defaultFormatCurrency, formatWeight } from '../../utils/formatters';

interface AdjustmentAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: InventoryAdjustmentAccount[];
  adjustments: InventoryStockAdjustment[];
  onSaveAccount: (account: InventoryAdjustmentAccount) => void;
  formatCurrency?: (val: number) => string;
  useImperial?: boolean;
}

export const AdjustmentAccountsModal: React.FC<AdjustmentAccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  adjustments,
  onSaveAccount,
  formatCurrency = defaultFormatCurrency,
  useImperial = false
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccountCode, setFilterAccountCode] = useState<string>('all');

  // New account form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'COGS' | 'OpEx' | 'Contra-Asset' | 'Income'>('COGS');
  const [newDesc, setNewDesc] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  if (!isOpen) return null;

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    const account: InventoryAdjustmentAccount = {
      id: `adj-acc-${newCode.trim()}`,
      accountCode: newCode.trim(),
      accountName: newName.trim(),
      accountType: newType,
      description: newDesc.trim(),
      isDefault: isDefault,
      isActive: true,
      balanceUSD: 0
    };

    onSaveAccount(account);
    setShowAddForm(false);
    setNewCode('');
    setNewName('');
    setNewDesc('');
    setIsDefault(false);
  };

  const filteredAdjustments = adjustments.filter(adj => {
    const matchesSearch = 
      adj.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adj.speciesName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adj.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adj.adjustmentAccountCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAccount = filterAccountCode === 'all' || adj.adjustmentAccountCode === filterAccountCode;
    return matchesSearch && matchesAccount;
  });

  const totalAdjustmentsCount = adjustments.length;
  const netVarianceUSD = adjustments.reduce((sum, a) => sum + a.valuationVarianceUSD, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-lg text-white">
                  Inventory Adjustment Accounts & Ledger
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Database className="w-3 h-3" />
                  Connected to Supabase
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                General Ledger accounts for stock variance, yield loss, and physical shrinkage audit logs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Header Tabs & Quick Metrics */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'accounts'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Chart of Adjustment Accounts ({accounts.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Adjustment Audit Log ({adjustments.length})
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total Adjustments:</span>
              <span className="font-mono font-bold text-slate-900">{totalAdjustmentsCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Net Valuation Variance:</span>
              <span className={`font-mono font-bold ${
                netVarianceUSD < 0 ? 'text-rose-600' : netVarianceUSD > 0 ? 'text-emerald-600' : 'text-slate-900'
              }`}>
                {netVarianceUSD < 0 ? `-${formatCurrency(Math.abs(netVarianceUSD))}` : formatCurrency(netVarianceUSD)}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 grow">
          {activeTab === 'accounts' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Configured Inventory Adjustment Accounts</h4>
                  <p className="text-xs text-slate-500">
                    Accounts used to reconcile inventory differences against the balance sheet and profit & loss statement.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddForm ? 'Cancel' : 'New Adjustment Account'}
                </button>
              </div>

              {/* Add Account Inline Form */}
              {showAddForm && (
                <form onSubmit={handleAddAccountSubmit} className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-indigo-950">Add New General Ledger Adjustment Account</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Account Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. 5165"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Account Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Fresh Filleting & Trimming Yield Loss"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Account Type</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="COGS">COGS (Direct Production Loss)</option>
                        <option value="OpEx">OpEx (Operating Expense)</option>
                        <option value="Contra-Asset">Contra-Asset (Inventory Offset)</option>
                        <option value="Income">Income (Surplus / Recovery)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Standard variance account for retail display conversion..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-slate-700 font-medium">Set as Default Account for Stock Adjustments</span>
                    </label>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                    >
                      Save Account to Supabase
                    </button>
                  </div>
                </form>
              )}

              {/* Accounts Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map(account => {
                  const accountAdjustments = adjustments.filter(a => a.adjustmentAccountCode === account.accountCode);
                  const cumulativeVariance = accountAdjustments.reduce((sum, a) => sum + a.valuationVarianceUSD, 0);

                  return (
                    <div 
                      key={account.id || account.accountCode} 
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs">
                              {account.accountCode}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              account.accountType === 'Income'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : account.accountType === 'Contra-Asset'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {account.accountType}
                            </span>
                            {account.isDefault && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {accountAdjustments.length} logged
                          </span>
                        </div>

                        <h5 className="font-bold text-sm text-slate-900 mb-1">{account.accountName}</h5>
                        <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                          {account.description || 'Standard inventory valuation variance account.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Cumulative Variance:</span>
                        <span className={`font-mono font-bold ${
                          cumulativeVariance < 0 ? 'text-rose-600' : cumulativeVariance > 0 ? 'text-emerald-600' : 'text-slate-700'
                        }`}>
                          {cumulativeVariance < 0 ? `-${formatCurrency(Math.abs(cumulativeVariance))}` : formatCurrency(cumulativeVariance)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* History Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative grow max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Lot ID, Species, Reason..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={filterAccountCode}
                    onChange={(e) => setFilterAccountCode(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">All Adjustment Accounts</option>
                    {accounts.map(acc => (
                      <option key={acc.accountCode} value={acc.accountCode}>
                        [{acc.accountCode}] {acc.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Adjustments Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Lot ID & Species</th>
                      <th className="py-3 px-3">Reason</th>
                      <th className="py-3 px-3">Adjustment Account</th>
                      <th className="py-3 px-3 text-right">Weight Delta</th>
                      <th className="py-3 px-3 text-right">Valuation Variance</th>
                      <th className="py-3 px-3 text-center">Supabase Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAdjustments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          No stock adjustments recorded yet. Adjust an inventory lot to record live audit entries.
                        </td>
                      </tr>
                    ) : (
                      filteredAdjustments.map((adj) => (
                        <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {adj.createdAt ? adj.createdAt.split('T')[0] : 'Today'}
                          </td>
                          <td className="py-3 px-3">
                            <strong className="font-mono text-slate-900 block">{adj.batchId}</strong>
                            <span className="text-[11px] text-slate-500">{adj.speciesName}</span>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800">
                            <div>{adj.reason}</div>
                            {adj.notes && (
                              <div className="text-[10px] text-slate-400 italic truncate max-w-xs">{adj.notes}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {adj.adjustmentAccountCode}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[150px]">
                              {adj.adjustmentAccountName}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            <span className={adj.deltaWeightKg < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {adj.deltaWeightKg > 0 ? `+${formatWeight(adj.deltaWeightKg, useImperial)}` : formatWeight(adj.deltaWeightKg, useImperial)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold">
                            <span className={adj.valuationVarianceUSD < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {adj.valuationVarianceUSD < 0 ? `-${formatCurrency(Math.abs(adj.valuationVarianceUSD))}` : `+${formatCurrency(adj.valuationVarianceUSD)}`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Recorded
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Synced in real-time with Supabase <code>inventory_adjustment_accounts</code></span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
