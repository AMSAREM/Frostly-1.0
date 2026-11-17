import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Building2, 
  Ship, 
  Receipt, 
  Filter, 
  Download, 
  Plus, 
  Layers,
  Percent,
  Wallet,
  Calendar,
  Search,
  BarChart3,
  Trash2,
  X,
  Pencil
} from 'lucide-react';
import { 
  FinancialLedgerEntry, 
  FinancialEntryCategory,
  ClientOrder, 
  RetailTransaction, 
  PurchaseOrderLanding, 
  Customer, 
  Supplier,
  InventoryBatch,
  RetailWholesaleProduct,
  InventoryAdjustmentAccount,
  InventoryStockAdjustment
} from '../types';
import { formatCurrency as defaultFormatCurrency } from '../utils/formatters';
import { FinancialReportsView } from './FinancialReportsView';
import {
  isReversalLedgerEntry,
  isInventoryAdjustmentLedgerEntry,
} from '../repositories/financialRepository';
import { ExportDropdown } from './common/ExportDropdown';
import { exportExpensesToExcel, exportExpensesToPdf } from '../utils/exportEngine';
import {
  calculateEnterpriseFinancials,
  calculateSpeciesMarginBenchmarks,
} from '../utils/financialMetrics';

interface FinancialsViewProps {
  financialEntries?: FinancialLedgerEntry[];
  orders?: ClientOrder[];
  retailSales?: RetailTransaction[];
  purchaseOrders?: PurchaseOrderLanding[];
  batches?: InventoryBatch[];
  products?: RetailWholesaleProduct[];
  customers?: Customer[];
  suppliers?: Supplier[];
  adjustmentAccounts?: InventoryAdjustmentAccount[];
  stockAdjustments?: InventoryStockAdjustment[];
  onRecordPayment: (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => void;
  onAddExpense?: (expense: Omit<FinancialLedgerEntry, 'id'>) => void;
  onSaveAdjustmentAccount?: (account: InventoryAdjustmentAccount) => void;
  onClearReversalEntries?: () => Promise<{
    deletedCount: number;
    source: string;
    requiresSqlMigration?: boolean;
    error?: string;
  }>;
  onClearInventoryAdjustmentEntries?: () => Promise<{
    deletedCount: number;
    source: string;
    requiresSqlMigration?: boolean;
    error?: string;
  }>;
  onDeleteFinancialEntries?: (entryIds: string[]) => Promise<{
    deletedCount: number;
    source: string;
    requiresSqlMigration?: boolean;
    error?: string;
  }>;
  onUpdateExpense?: (expense: FinancialLedgerEntry) => Promise<{
    updatedEntry: FinancialLedgerEntry;
    source: string;
    requiresSqlMigration?: boolean;
    error?: string;
  }>;
  companyName?: string;
  currencySymbol?: string;
  formatCurrency?: (amount: number) => string;
}

export const FinancialsView: React.FC<FinancialsViewProps> = ({
  financialEntries = [],
  orders = [],
  retailSales = [],
  purchaseOrders = [],
  batches = [],
  products = [],
  customers = [],
  suppliers = [],
  adjustmentAccounts = [],
  stockAdjustments = [],
  onRecordPayment,
  onAddExpense,
  onSaveAdjustmentAccount,
  onClearReversalEntries,
  onClearInventoryAdjustmentEntries,
  onDeleteFinancialEntries,
  onUpdateExpense,
  companyName = 'Amansocean Seafoods',
  currencySymbol = '$',
  formatCurrency = defaultFormatCurrency,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'receivables' | 'payables' | 'expenses' | 'ledger' | 'adjustments'>('overview');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [expenseDateFrom, setExpenseDateFrom] = useState<string>('');
  const [expenseDateTo, setExpenseDateTo] = useState<string>('');
  const [isClearingReversals, setIsClearingReversals] = useState<boolean>(false);
  const [confirmClearReversals, setConfirmClearReversals] = useState<boolean>(false);
  const [isClearingAdjustments, setIsClearingAdjustments] = useState<boolean>(false);
  const [confirmClearAdjustments, setConfirmClearAdjustments] = useState<boolean>(false);
  const [isDeletingEntries, setIsDeletingEntries] = useState<boolean>(false);
  const [confirmDeleteFiltered, setConfirmDeleteFiltered] = useState<boolean>(false);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<FinancialLedgerEntry | null>(null);
  const [editExpDate, setEditExpDate] = useState<string>('');
  const [editExpCategory, setEditExpCategory] = useState<FinancialEntryCategory>('Logistics & Reefer Freight');
  const [editExpDescription, setEditExpDescription] = useState<string>('');
  const [editExpEntity, setEditExpEntity] = useState<string>('');
  const [editExpAmount, setEditExpAmount] = useState<string>('');
  const [editExpPaymentMethod, setEditExpPaymentMethod] = useState<string>('Bank Transfer');
  const [editExpReference, setEditExpReference] = useState<string>('');
  const [editExpStatus, setEditExpStatus] = useState<'Settled' | 'Pending' | 'Overdue'>('Settled');
  const [editExpNotes, setEditExpNotes] = useState<string>('');
  const [isSavingExpenseEdit, setIsSavingExpenseEdit] = useState<boolean>(false);
  const [editExpenseError, setEditExpenseError] = useState<string | null>(null);
  const [expenseActionStatus, setExpenseActionStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [reversalClearStatus, setReversalClearStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState<boolean>(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState<boolean>(false);
  const [selectedEntityForPayment, setSelectedEntityForPayment] = useState<{
    type: 'AR' | 'AP';
    entityId: string;
    entityName: string;
    refId: string;
    balance: number;
  } | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');

  // Form state for adding custom adjustment account
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'COGS' | 'OpEx' | 'Contra-Asset' | 'Income'>('COGS');
  const [newAccDesc, setNewAccDesc] = useState('');
  const [newAccIsDefault, setNewAccIsDefault] = useState(false);

  // Form state for adding custom expense
  const [newExpenseCategory, setNewExpenseCategory] = useState<any>('Logistics & Reefer Freight');
  const [newExpenseDesc, setNewExpenseDesc] = useState<string>('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>('');
  const [newExpenseEntity, setNewExpenseEntity] = useState<string>('');

  // GAAP-Aligned Core Financial Aggregations
  const fin = calculateEnterpriseFinancials({
    orders,
    retailSales,
    batches,
    products,
    purchaseOrders,
    financialEntries,
    customers,
    suppliers,
  });

  const wholesaleRevenue = fin.wholesaleRevenue;
  const retailRevenue = fin.retailRevenue;
  const totalRevenue = fin.totalRevenue;
  const invAdjustmentLoss = fin.invAdjustmentLoss;
  const invAdjustmentGain = fin.invAdjustmentGain;
  const netInventoryAdjustmentCost = fin.netInventoryAdjustmentCost;
  const soldCOGS = fin.soldCOGS;
  const totalIntakeSpend = fin.totalIntakeSpend;
  const totalCOGS = fin.totalCOGS;
  const grossProfit = fin.grossProfit;
  const grossMarginPct = fin.grossMarginPct;

  const isOperatingExpenseEntry = (e: FinancialLedgerEntry) =>
    e.type === 'OpEx' && !isReversalLedgerEntry(e);

  const opexEntries = financialEntries.filter(isOperatingExpenseEntry);
  const reversalEntries = financialEntries.filter(isReversalLedgerEntry);
  const inventoryAdjustmentEntries = financialEntries.filter(isInventoryAdjustmentLedgerEntry);

  const totalOpEx = fin.totalOpEx;
  const speciesMarginBenchmarks = calculateSpeciesMarginBenchmarks({ batches, products });
  const currentPeriodLabel = new Date().toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  const opexCategoryRows = Object.entries(
    opexEntries.reduce<Record<string, { amount: number; count: number }>>((acc, entry) => {
      const categoryName = entry.category || 'Operating Expense';
      if (!acc[categoryName]) {
        acc[categoryName] = { amount: 0, count: 0 };
      }
      acc[categoryName].amount += entry.amount;
      acc[categoryName].count += 1;
      return acc;
    }, {})
  )
    .filter(([, data]) => data.amount > 0)
    .sort(([, a], [, b]) => b.amount - a.amount);

  const expenseCategories = Array.from(
    new Set(opexEntries.map(e => e.category || 'Operating Expense'))
  ).sort();

  const filteredExpenses = opexEntries
    .filter(entry => {
      const cat = entry.category || 'Operating Expense';
      const matchesCat = expenseCategoryFilter === 'all' || cat === expenseCategoryFilter;
      const q = expenseSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (entry.description || '').toLowerCase().includes(q) ||
        (entry.entityName || '').toLowerCase().includes(q) ||
        (entry.referenceId || '').toLowerCase().includes(q) ||
        (entry.voucherNumber || '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (entry.paymentMethod || '').toLowerCase().includes(q) ||
        (entry.notes || '').toLowerCase().includes(q);
      const matchesFrom = !expenseDateFrom || entry.date >= expenseDateFrom;
      const matchesTo = !expenseDateTo || entry.date <= expenseDateTo;
      return matchesCat && matchesSearch && matchesFrom && matchesTo;
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const filteredExpenseTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const filteredSettledExpenseTotal = filteredExpenses
    .filter(e => e.status === 'Settled')
    .reduce((sum, e) => sum + e.amount, 0);
  const filteredPendingExpenseTotal = filteredExpenses
    .filter(e => e.status !== 'Settled')
    .reduce((sum, e) => sum + e.amount, 0);
  const topOpexCategory = opexCategoryRows[0];

  const netOperatingProfit = fin.netOperatingProfit;
  const netMarginPct = fin.netMarginPct;

  const totalAccountsReceivable = fin.totalAR;
  const totalAccountsPayable = fin.totalAP;

  // Filtered Ledger entries
  const filteredLedger = financialEntries.filter(entry => {
    const matchesCategory = 
      filterCategory === 'all' || 
      entry.type.toLowerCase() === filterCategory.toLowerCase() ||
      (filterCategory === 'adjustment' && isInventoryAdjustmentLedgerEntry(entry)) ||
      (filterCategory === 'reversals' && isReversalLedgerEntry(entry));
    const q = searchQuery.toLowerCase();
    const matchesSearch = (entry.description || '').toLowerCase().includes(q) ||
                          (entry.entityName || '').toLowerCase().includes(q) ||
                          (entry.referenceId || '').toLowerCase().includes(q) ||
                          (entry.category || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const handleClearReversalsClick = async () => {
    if (!onClearReversalEntries || isClearingReversals) return;
    setIsClearingReversals(true);
    setConfirmClearReversals(false);
    setReversalClearStatus(null);
    try {
      const res = await onClearReversalEntries();
      if (res.requiresSqlMigration) {
        setReversalClearStatus({
          type: 'warning',
          message:
            res.error ||
            'Supabase SQL setup required: run supabase/CLEAR_REVERSALS_FINANCIAL_LEDGER.sql in your Supabase SQL Editor to purge immutable reversal rows and install the RPC, then click Clear Reversals again.'
        });
      } else if (res.error) {
        setReversalClearStatus({
          type: 'error',
          message: res.error
        });
      } else {
        setReversalClearStatus({
          type: 'success',
          message:
            res.deletedCount > 0
              ? `Cleared ${res.deletedCount} reversal entry(s) from ${
                  res.source === 'supabase_rpc' ? 'Supabase General Financial Ledger' : 'local ledger cache'
                }.`
              : 'No reversal entries remain in Supabase General Financial Ledger.'
        });
        if (filterCategory === 'reversals') {
          setFilterCategory('all');
        }
      }
    } catch (err: any) {
      setReversalClearStatus({
        type: 'error',
        message: err?.message || 'Failed to clear reversal entries.'
      });
    } finally {
      setIsClearingReversals(false);
    }
  };

  const handleClearAdjustmentsClick = async () => {
    if (!onClearInventoryAdjustmentEntries || isClearingAdjustments) return;
    setIsClearingAdjustments(true);
    setConfirmClearAdjustments(false);
    setReversalClearStatus(null);
    try {
      const res = await onClearInventoryAdjustmentEntries();
      if (res.requiresSqlMigration) {
        setReversalClearStatus({
          type: 'warning',
          message:
            res.error ||
            'Supabase SQL setup required: run supabase/CLEAR_INVENTORY_ADJUSTMENT_LEDGER.sql in your Supabase SQL Editor to purge immutable Inventory Adjustment rows and install the RPC, then retry.'
        });
      } else if (res.error) {
        setReversalClearStatus({
          type: 'error',
          message: res.error
        });
      } else {
        setReversalClearStatus({
          type: 'success',
          message:
            res.deletedCount > 0
              ? `Deleted ${res.deletedCount} Inventory Adjustment entry(s) from ${
                  res.source === 'supabase_rpc' ? 'Supabase General Financial Ledger' : 'local ledger cache'
                }.`
              : 'No Inventory Adjustment entries remain in the General Financial Ledger.'
        });
        if (filterCategory === 'adjustment') {
          setFilterCategory('all');
        }
      }
    } catch (err: any) {
      setReversalClearStatus({
        type: 'error',
        message: err?.message || 'Failed to delete Inventory Adjustment entries.'
      });
    } finally {
      setIsClearingAdjustments(false);
    }
  };

  const handleDeleteEntriesClick = async (entryIds: string[]) => {
    if (!onDeleteFinancialEntries || isDeletingEntries || entryIds.length === 0) return;
    setIsDeletingEntries(true);
    setConfirmDeleteFiltered(false);
    setConfirmDeleteEntryId(null);
    setReversalClearStatus(null);
    try {
      const res = await onDeleteFinancialEntries(entryIds);
      const statusPayload = res.requiresSqlMigration
        ? {
            type: 'warning' as const,
            message: `Supabase SQL migration required (${res.error || 'insert-only trigger'}). Run supabase/DELETE_AMOAKO_INSPIREMEN_LEDGER.sql in your Supabase SQL Editor to delete matching entries and install the RPC, then retry.`
          }
        : res.error
        ? {
            type: 'error' as const,
            message: res.error
          }
        : {
            type: 'success' as const,
            message: `Deleted ${res.deletedCount} entry(s) from ${
              res.source === 'supabase_rpc' ? 'Supabase General Financial Ledger' : 'local ledger cache'
            }.`
          };
      setReversalClearStatus(statusPayload);
      setExpenseActionStatus(statusPayload);
    } catch (err: any) {
      const errPayload = {
        type: 'error' as const,
        message: err?.message || 'Failed to delete selected ledger entries.'
      };
      setReversalClearStatus(errPayload);
      setExpenseActionStatus(errPayload);
    } finally {
      setIsDeletingEntries(false);
    }
  };

  const handleOpenEditExpense = (entry: FinancialLedgerEntry) => {
    setEditingExpense(entry);
    setEditExpDate(entry.date || new Date().toISOString().split('T')[0]);
    setEditExpCategory(entry.category || 'Logistics & Reefer Freight');
    setEditExpDescription(entry.description || '');
    setEditExpEntity(entry.entityName || '');
    setEditExpAmount(String(entry.amount ?? ''));
    setEditExpPaymentMethod(entry.paymentMethod || 'Bank Transfer');
    setEditExpReference(entry.voucherNumber || entry.referenceId || '');
    setEditExpStatus((entry.status as 'Settled' | 'Pending' | 'Overdue') || 'Settled');
    setEditExpNotes(entry.notes || '');
    setEditExpenseError(null);
  };

  const handleSaveExpenseEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !onUpdateExpense || isSavingExpenseEdit) return;

    const parsedAmount = parseFloat(editExpAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setEditExpenseError('Expense amount must be greater than zero.');
      return;
    }
    if (!editExpDescription.trim()) {
      setEditExpenseError('Please provide a description or memo for this expense.');
      return;
    }

    setIsSavingExpenseEdit(true);
    setEditExpenseError(null);
    try {
      const updated: FinancialLedgerEntry = {
        ...editingExpense,
        date: editExpDate || editingExpense.date,
        type: editExpCategory === 'COGS (Catch Intake)' ? 'COGS' : 'OpEx',
        category: editExpCategory,
        description: editExpDescription.trim(),
        entityName: editExpEntity.trim() || 'Operational Vendor',
        amount: Number(parsedAmount.toFixed(2)),
        paymentMethod: editExpPaymentMethod.trim() || 'Bank Transfer',
        referenceId: editExpReference.trim() || editingExpense.referenceId,
        voucherNumber: editExpReference.trim() || editingExpense.voucherNumber,
        status: editExpStatus,
        notes: editExpNotes.trim() || undefined,
      };

      const res = await onUpdateExpense(updated);
      if (res.requiresSqlMigration) {
        setEditExpenseError(
          `Supabase SQL migration required (${res.error || 'insert-only trigger'}). Run supabase/migrations/034_update_financial_ledger_expense_rpc.sql in Supabase SQL Editor first.`
        );
        return;
      }
      if (res.error) {
        setEditExpenseError(res.error);
        return;
      }

      const statusPayload = {
        type: 'success' as const,
        message: `Expense "${res.updatedEntry.description}" updated (${
          res.source === 'supabase_rpc' ? 'synced to Supabase' : 'saved to local cache'
        }).`
      };
      setExpenseActionStatus(statusPayload);
      setReversalClearStatus(statusPayload);
      setEditingExpense(null);
    } catch (err: any) {
      setEditExpenseError(err?.message || 'Failed to save expense changes.');
    } finally {
      setIsSavingExpenseEdit(false);
    }
  };

  const handleOpenPaymentModal = (type: 'AR' | 'AP', entityId: string, entityName: string, refId: string, balance: number) => {
    setSelectedEntityForPayment({ type, entityId, entityName, refId, balance });
    setPaymentAmountInput(balance.toString());
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntityForPayment) return;
    const amt = parseFloat(paymentAmountInput);
    if (isNaN(amt) || amt <= 0) return;
    onRecordPayment(
      selectedEntityForPayment.type,
      selectedEntityForPayment.entityId,
      amt,
      selectedEntityForPayment.refId
    );
    setSelectedEntityForPayment(null);
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) return;

    if (onSaveAdjustmentAccount) {
      onSaveAdjustmentAccount({
        id: `adj-acc-${newAccCode.trim()}`,
        accountCode: newAccCode.trim(),
        accountName: newAccName.trim(),
        accountType: newAccType,
        description: newAccDesc.trim(),
        isDefault: newAccIsDefault,
        isActive: true,
        balanceUSD: 0
      });
    }

    setIsAddAccountModalOpen(false);
    setNewAccCode('');
    setNewAccName('');
    setNewAccDesc('');
    setNewAccIsDefault(false);
  };

  const handleCreateExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newExpenseAmount);
    if (isNaN(amt) || amt <= 0 || !newExpenseDesc.trim()) return;

    if (onAddExpense) {
      onAddExpense({
        date: new Date().toISOString().split('T')[0],
        type: 'OpEx',
        category: newExpenseCategory,
        description: newExpenseDesc.trim(),
        referenceId: `EXP-${Date.now().toString().slice(-4)}`,
        entityName: newExpenseEntity.trim() || 'Vendor / Logistics',
        amount: amt,
        paymentMethod: 'Corporate ACH / Direct',
        status: 'Settled'
      });
    }

    setNewExpenseDesc('');
    setNewExpenseAmount('');
    setNewExpenseEntity('');
    setIsAddExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Tab Switcher & Quick Add Expense */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3.5 sm:gap-4 bg-white p-3.5 sm:p-5 lg:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs max-w-full">
        <div className="min-w-0 max-w-full">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-100/80 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              Financials & P&L Operations
            </h1>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 line-clamp-2 sm:line-clamp-none leading-relaxed">
            Real-time Revenue, Cost of Catch (COGS), Accounts Receivable & Payable, and Profit Margins.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full 2xl:w-auto min-w-0 max-w-full flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          <div className="bg-slate-100/90 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl flex items-center gap-1 sm:gap-1.5 border border-slate-200/90 overflow-x-auto no-scrollbar touch-pan-x scroll-smooth overscroll-x-contain min-w-0 flex-1 2xl:flex-initial max-w-full">
            <button
              id="fin-tab-overview"
              onClick={() => setActiveTab('overview')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 select-none active:scale-[0.98] ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              P&L Overview
            </button>
            <button
              id="fin-tab-reports"
              onClick={() => setActiveTab('reports')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 select-none active:scale-[0.98] ${
                activeTab === 'reports'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600" />
              <span>Reports & Trends</span>
            </button>
            <button
              id="fin-tab-ar"
              onClick={() => setActiveTab('receivables')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 select-none active:scale-[0.98] ${
                activeTab === 'receivables'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Receivables (AR)</span>
              {totalAccountsReceivable > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-amber-100 text-amber-800 rounded-full font-extrabold">
                  {formatCurrency(totalAccountsReceivable)}
                </span>
              )}
            </button>
            <button
              id="fin-tab-payables"
              onClick={() => setActiveTab('payables')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 select-none active:scale-[0.98] ${
                activeTab === 'payables'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Payables (AP)</span>
              {totalAccountsPayable > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-rose-100 text-rose-800 rounded-full font-extrabold">
                  {formatCurrency(totalAccountsPayable)}
                </span>
              )}
            </button>
            <button
              id="fin-tab-expenses"
              onClick={() => setActiveTab('expenses')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 select-none active:scale-[0.98] ${
                activeTab === 'expenses'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600" />
              <span>Expense Ledger</span>
              {opexEntries.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-rose-50 text-rose-700 rounded-full font-extrabold border border-rose-100">
                  {opexEntries.length}
                </span>
              )}
            </button>
            <button
              id="fin-tab-adjustments"
              onClick={() => setActiveTab('adjustments')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 select-none active:scale-[0.98] ${
                activeTab === 'adjustments'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600" />
              <span>Adjustment Accounts</span>
              {adjustmentAccounts.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-indigo-50 text-indigo-700 rounded-full font-extrabold border border-indigo-100">
                  {adjustmentAccounts.length}
                </span>
              )}
            </button>
            <button
              id="fin-tab-ledger"
              onClick={() => setActiveTab('ledger')}
              className={`px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[36px] rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 select-none active:scale-[0.98] ${
                activeTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Ledger Transactions</span>
              {reversalEntries.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-amber-100 text-amber-800 rounded-full font-extrabold">
                  {reversalEntries.length} rev
                </span>
              )}
              {inventoryAdjustmentEntries.length > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] bg-violet-100 text-violet-800 rounded-full font-extrabold">
                  {inventoryAdjustmentEntries.length} adj
                </span>
              )}
            </button>
          </div>

          <button
            id="btn-add-expense"
            onClick={() => setIsAddExpenseModalOpen(true)}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer w-full sm:w-auto shrink-0 select-none active:scale-[0.98] min-h-[38px] whitespace-nowrap z-10"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Record Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Gross Revenue</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">Wholesale: <strong className="text-slate-800">{formatCurrency(wholesaleRevenue)}</strong></span>
            <span className="text-slate-500">Retail: <strong className="text-slate-800">{formatCurrency(retailRevenue)}</strong></span>
          </div>
        </div>

        {/* Cost of Catch (COGS) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Cost of Goods Sold (COGS)</span>
            <span className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <Ship className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(totalCOGS)}
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
            <span>Sold Units &amp; Shrinkage</span>
            <span className="text-emerald-700 font-bold font-mono-code" title={`Cumulative inward PO intake spend: ${formatCurrency(totalIntakeSpend)}`}>
              {purchaseOrders.length} Dock Landings
            </span>
          </div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Profit</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono-code">
              {formatCurrency(grossProfit)}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {grossMarginPct.toFixed(1)}% Margin
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-500">
            <span>Operating Net: <strong className="text-slate-800">{formatCurrency(netOperatingProfit)}</strong></span>
            <span className="text-slate-600 font-medium">({netMarginPct.toFixed(1)}% Net)</span>
          </div>
        </div>

        {/* Receivables vs Payables */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Unsettled Cash Position</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-amber-800 font-medium">Receivables (AR)</div>
              <div className="text-base font-bold text-amber-950 font-mono-code">{formatCurrency(totalAccountsReceivable)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-rose-800 font-medium">Payables (AP)</div>
              <div className="text-base font-bold text-rose-950 font-mono-code">{formatCurrency(totalAccountsPayable)}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
            <span>Net Unsettled Balance:</span>
            <strong className={`font-mono-code font-bold ${totalAccountsReceivable - totalAccountsPayable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(totalAccountsReceivable - totalAccountsPayable)}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Income Statement & Channel Split (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Income & Expense Breakdown Table */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Profit & Loss (P&L) Statement</h2>
                  <p className="text-xs text-slate-500">Financial summary for the current operating period.</p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  Live Period ({currentPeriodLabel})
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-sm">
                {/* Revenue Section */}
                <div className="bg-slate-50/80 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-700 flex justify-between">
                  <span>Net Sales & Revenue (Ex-Tax)</span>
                  <span>{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between text-slate-700 pl-8">
                  <span>Wholesale B2B Restaurant & Hotel Orders ({fin.activeOrdersCount} active)</span>
                  <span className="font-mono-code font-semibold">{formatCurrency(wholesaleRevenue)}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between text-slate-700 pl-8">
                  <span>Retail Counter & Point-of-Sale ({fin.activeRetailSalesCount} tickets)</span>
                  <span className="font-mono-code font-semibold">{formatCurrency(retailRevenue)}</span>
                </div>

                {/* COGS Section */}
                <div className="bg-slate-50/80 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-700 flex justify-between">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="text-rose-700">-{formatCurrency(totalCOGS)}</span>
                </div>
                <div className="px-4 py-2.5 flex justify-between text-slate-700 pl-8">
                  <span>Matched Landed Cost on Fulfilled Wholesale &amp; POS Sales</span>
                  <span className="font-mono-code font-semibold text-rose-600">-{formatCurrency(soldCOGS)}</span>
                </div>
                {netInventoryAdjustmentCost !== 0 && (
                  <div className="px-4 py-2.5 flex justify-between text-slate-700 pl-8">
                    <span>Inventory Shrinkage, Yield Loss & Spoilage Write-Offs</span>
                    <span className={`font-mono-code font-semibold ${netInventoryAdjustmentCost > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {netInventoryAdjustmentCost > 0 ? `-${formatCurrency(netInventoryAdjustmentCost)}` : `+${formatCurrency(Math.abs(netInventoryAdjustmentCost))}`}
                    </span>
                  </div>
                )}

                {/* Gross Margin Row */}
                <div className="bg-emerald-50/50 px-4 py-3 font-bold text-sm text-emerald-950 flex justify-between border-t-2 border-slate-300">
                  <span>Gross Operating Profit</span>
                  <span className="font-mono-code text-base text-emerald-700 font-black">
                    {formatCurrency(grossProfit)} ({grossMarginPct.toFixed(1)}%)
                  </span>
                </div>

                {/* OpEx Section */}
                <div className="bg-slate-50/80 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-700 flex justify-between">
                  <span>Operating Expenses (OpEx)</span>
                  <span className="text-rose-700">-{formatCurrency(totalOpEx)}</span>
                </div>
                {opexCategoryRows.length === 0 ? (
                  <div className="px-4 py-2.5 flex justify-between text-slate-400 italic pl-8">
                    <span>No operating expenses recorded yet</span>
                    <span className="font-mono-code">{formatCurrency(0)}</span>
                  </div>
                ) : (
                  opexCategoryRows.map(([category, data]) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setExpenseCategoryFilter(category);
                        setExpenseSearch('');
                        setActiveTab('expenses');
                      }}
                      className="w-full px-4 py-2.5 flex justify-between items-center text-slate-600 pl-8 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      title="Click to inspect operating expense history for this category"
                    >
                      <span>
                        {category}{' '}
                        <span className="text-[11px] text-slate-400 font-medium">
                          ({data.count} {data.count === 1 ? 'entry' : 'entries'})
                        </span>
                      </span>
                      <span className="font-mono-code text-rose-600">-{formatCurrency(data.amount)}</span>
                    </button>
                  ))
                )}

                {/* Net Profit Row */}
                <div className="bg-slate-900 px-4 py-3.5 font-bold text-base text-white flex justify-between">
                  <span>Net Operating Income</span>
                  <span className="font-mono-code text-lg text-emerald-400 font-black">
                    {formatCurrency(netOperatingProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Margin Analyzer by Species */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Profit Margin Benchmark by Inventory Species</h3>
                <span className="text-[11px] font-semibold text-slate-500">Live from Supabase Inventory &amp; Price Book</span>
              </div>
              {speciesMarginBenchmarks.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  Add inventory batches or catalog products to compute live species margin benchmarks.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {speciesMarginBenchmarks.slice(0, 6).map(item => (
                    <div key={item.speciesName} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">{item.speciesName}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          item.marginPct >= 25
                            ? 'text-emerald-600 bg-emerald-50'
                            : item.marginPct >= 10
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-rose-700 bg-rose-50'
                        }`}>
                          {item.marginPct.toFixed(1)}% Margin
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <div>Landing Cost: <strong className="text-slate-700">{formatCurrency(item.avgCostPerKg)}/kg</strong></div>
                        <div>Wholesale: <strong className="text-slate-700">{formatCurrency(item.avgWholesalePerKg)}/kg</strong></div>
                        <div>Retail Counter: <strong className="text-slate-700">{formatCurrency(item.avgRetailPerUnit)}/kg</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 cols: Sales Channel Breakdown & Fast Action Card */}
          <div className="lg:col-span-4 space-y-6">
            {/* Channel Revenue Comparison */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Sales Channel Distribution</h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Wholesale Bulk B2B</span>
                    <span>{((wholesaleRevenue / (totalRevenue || 1)) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(wholesaleRevenue / (totalRevenue || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono-code font-bold">
                    {formatCurrency(wholesaleRevenue)}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Direct Retail & Counter POS</span>
                    <span>{((retailRevenue / (totalRevenue || 1)) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(retailRevenue / (totalRevenue || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono-code font-bold">
                    {formatCurrency(retailRevenue)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                Wholesale contracts provide stable volume throughput, while direct retail counter sales generate higher margin yields (avg 55-60%).
              </div>
            </div>

            {/* Quick Settle Alert Cards */}
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-bold text-sm">Actionable Settlements</h4>
              </div>
              <p className="text-xs text-slate-300">
                {customers.filter(c => c.outstandingBalanceUSD > 0).length} customer invoices awaiting collection, and {suppliers.filter(s => s.outstandingPayableUSD > 0).length} supplier bills due for payout.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setActiveTab('receivables')}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer flex items-center justify-between"
                >
                  <span>Collect Outstanding Receivables</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab('payables')}
                  className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-between"
                >
                  <span>Settle Harvester Payables</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports & Analytics Tab */}
      {activeTab === 'reports' && (
        <FinancialReportsView
          financialEntries={financialEntries}
          orders={orders}
          retailSales={retailSales}
          purchaseOrders={purchaseOrders}
          batches={batches}
          products={products}
          customers={customers}
          suppliers={suppliers}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Receivables Tab */}
      {activeTab === 'receivables' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Accounts Receivable (Customer Invoices)</h2>
              <p className="text-xs text-slate-500">Uncollected client balances, payment terms, and aging.</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total Outstanding Receivables</div>
              <div className="text-xl font-black text-amber-700 font-mono-code">{formatCurrency(totalAccountsReceivable)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Payment Terms</th>
                  <th className="py-3 px-4">Credit Limit</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{cust.name}</div>
                      <div className="text-slate-400 text-[11px]">{cust.companyName} • {cust.contactPerson}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-medium text-[11px]">
                        {cust.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {cust.paymentTerms}
                    </td>
                    <td className="py-3.5 px-4 font-mono-code text-slate-600">
                      {formatCurrency(cust.creditLimitUSD)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-code font-bold text-slate-900">
                      {cust.outstandingBalanceUSD > 0 ? (
                        <span className="text-amber-700 font-black">{formatCurrency(cust.outstandingBalanceUSD)}</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">{formatCurrency(0)} (Cleared)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        cust.outstandingBalanceUSD === 0 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {cust.outstandingBalanceUSD === 0 ? 'Current' : 'Due for Settlement'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {cust.outstandingBalanceUSD > 0 ? (
                        <button
                          onClick={() => handleOpenPaymentModal('AR', cust.id, cust.name, cust.id, cust.outstandingBalanceUSD)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          Record Payment
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">All Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payables Tab */}
      {activeTab === 'payables' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Accounts Payable (Harvesters & Sourcing Bills)</h2>
              <p className="text-xs text-slate-500">Unsettled purchase orders and boat payouts.</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total Outstanding Payables</div>
              <div className="text-xl font-black text-rose-700 font-mono-code">{formatCurrency(totalAccountsPayable)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Supplier / Vessel Co-Op</th>
                  <th className="py-3 px-4">Type & Location</th>
                  <th className="py-3 px-4">Payment Terms</th>
                  <th className="py-3 px-4">Lifetime Sourced</th>
                  <th className="py-3 px-4 text-right">Outstanding Payable</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map(sup => (
                  <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{sup.name}</div>
                      <div className="text-slate-400 text-[11px]">{sup.contactPerson} • {sup.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{sup.type}</div>
                      <div className="text-[11px] text-slate-500">{sup.portLocation}, {sup.country}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {sup.paymentTerms}
                    </td>
                    <td className="py-3.5 px-4 font-mono-code text-slate-600">
                      {formatCurrency(sup.totalPurchasedUSD)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-code font-bold">
                      {sup.outstandingPayableUSD > 0 ? (
                        <span className="text-rose-700 font-black">{formatCurrency(sup.outstandingPayableUSD)}</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">{formatCurrency(0)} (Settled)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {sup.outstandingPayableUSD > 0 ? (
                        <button
                          onClick={() => handleOpenPaymentModal('AP', sup.id, sup.name, sup.id, sup.outstandingPayableUSD)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          Settle Bill
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operating Expense Ledger & History Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-5">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                    <Receipt className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900">Operating Expense Ledger & History</h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Supabase Source of Truth
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Full disbursement history for freight, cold storage utilities, packaging, cutting labor, and port fees.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <ExportDropdown
                  label="Export Expenses"
                  variant="secondary"
                  onExportExcel={() =>
                    exportExpensesToExcel({
                      expenses: filteredExpenses,
                      companyName,
                      currencySymbol
                    })
                  }
                  onExportPdf={() =>
                    exportExpensesToPdf({
                      expenses: filteredExpenses,
                      companyName,
                      currencySymbol
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Expense</span>
                </button>
              </div>
            </div>

            {/* Expense KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                  Total Filtered OpEx
                </span>
                <div className="text-xl font-black text-rose-700 font-mono-code mt-1">
                  {formatCurrency(filteredExpenseTotal)}
                </div>
                <span className="text-[11px] text-rose-500">
                  {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'} shown
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Top Expense Category
                </span>
                <div className="text-sm font-black text-slate-900 mt-1.5 truncate">
                  {topOpexCategory ? topOpexCategory[0] : 'No OpEx recorded'}
                </div>
                <span className="text-[11px] text-slate-500 font-mono-code">
                  {topOpexCategory && totalOpEx > 0
                    ? `${formatCurrency(topOpexCategory[1].amount)} (${((topOpexCategory[1].amount / totalOpEx) * 100).toFixed(1)}%)`
                    : formatCurrency(0)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Settled Disbursements
                </span>
                <div className="text-xl font-black text-emerald-700 font-mono-code mt-1">
                  {formatCurrency(filteredSettledExpenseTotal)}
                </div>
                <span className="text-[11px] text-emerald-600">Paid & posted</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                  Pending / Accrued
                </span>
                <div className="text-xl font-black text-amber-700 font-mono-code mt-1">
                  {formatCurrency(filteredPendingExpenseTotal)}
                </div>
                <span className="text-[11px] text-amber-600">Awaiting settlement</span>
              </div>
            </div>

            {/* Category Breakdown Filter Pills */}
            {opexCategoryRows.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                {opexCategoryRows.map(([cat, info]) => {
                  const isSelected = expenseCategoryFilter === cat;
                  const sharePct = totalOpEx > 0 ? (info.amount / totalOpEx) * 100 : 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExpenseCategoryFilter(prev => (prev === cat ? 'all' : cat))}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                          {cat}
                        </span>
                        <span className={`text-[10px] font-mono-code font-bold ${isSelected ? 'text-rose-300' : 'text-slate-400'}`}>
                          {sharePct.toFixed(0)}%
                        </span>
                      </div>
                      <div className={`text-sm font-black font-mono-code mt-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {formatCurrency(info.amount)}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {info.count} {info.count === 1 ? 'expense' : 'expenses'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vendor, memo, voucher #, or category..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All OpEx Categories ({opexEntries.length})</option>
                {expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={expenseDateFrom}
                  onChange={(e) => setExpenseDateFrom(e.target.value)}
                  aria-label="Expense date from"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={expenseDateTo}
                  onChange={(e) => setExpenseDateTo(e.target.value)}
                  aria-label="Expense date to"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                />
              </div>

              {(expenseCategoryFilter !== 'all' || expenseSearch || expenseDateFrom || expenseDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setExpenseCategoryFilter('all');
                    setExpenseSearch('');
                    setExpenseDateFrom('');
                    setExpenseDateTo('');
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {expenseActionStatus && (
              <div
                className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border text-xs ${
                  expenseActionStatus.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : expenseActionStatus.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {expenseActionStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <p className="font-medium leading-relaxed">{expenseActionStatus.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpenseActionStatus(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                  aria-label="Dismiss status message"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Expense History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Ref / Voucher #</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Vendor / Payee</th>
                    <th className="py-3 px-4">Description & Memo</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    {(onUpdateExpense || onDeleteFinancialEntries) && (
                      <th className="py-3 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={(onUpdateExpense || onDeleteFinancialEntries) ? 9 : 8} className="py-12 px-4 text-center">
                        <div className="max-w-sm mx-auto space-y-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <Receipt className="w-5 h-5" />
                          </div>
                          <div className="text-sm font-bold text-slate-700">
                            {opexEntries.length === 0
                              ? 'No operating expenses recorded in Supabase yet'
                              : 'No expenses match your current filters'}
                          </div>
                          <p className="text-xs text-slate-500">
                            {opexEntries.length === 0
                              ? 'Record freight, cold storage, ice, packaging, or labor disbursements to build your expense ledger.'
                              : 'Try clearing your search or date range filters.'}
                          </p>
                          {opexEntries.length === 0 && (
                            <button
                              type="button"
                              onClick={() => setIsAddExpenseModalOpen(true)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer mt-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Record First Expense</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono-code text-slate-600 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-3.5 px-4 font-mono-code font-bold text-slate-900 whitespace-nowrap">
                          {entry.voucherNumber || entry.referenceId || entry.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 whitespace-nowrap">
                            {entry.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {entry.entityName || 'Operational Vendor'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800">
                          <div className="font-medium">{entry.description}</div>
                          {entry.notes && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{entry.notes}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {entry.paymentMethod}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.status === 'Settled'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-code font-bold text-rose-700 whitespace-nowrap">
                          -{formatCurrency(entry.amount)}
                        </td>
                        {(onUpdateExpense || onDeleteFinancialEntries) && (
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {confirmDeleteEntryId === entry.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntriesClick([entry.id])}
                                  disabled={isDeletingEntries}
                                  className="px-2 py-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-60"
                                >
                                  {isDeletingEntries ? '...' : 'Delete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteEntryId(null)}
                                  disabled={isDeletingEntries}
                                  className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                {onUpdateExpense && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditExpense(entry)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit this expense"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onDeleteFinancialEntries && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteEntryId(entry.id)}
                                    disabled={isDeletingEntries}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title="Delete this expense"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredExpenses.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-bold text-xs">
                    <tr>
                      <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-slate-300">
                        Total Filtered Operating Expenses ({filteredExpenses.length}{' '}
                        {filteredExpenses.length === 1 ? 'entry' : 'entries'})
                      </td>
                      <td className="py-3 px-4 text-right font-mono-code text-sm text-rose-300 font-black whitespace-nowrap">
                        -{formatCurrency(filteredExpenseTotal)}
                      </td>
                      {(onUpdateExpense || onDeleteFinancialEntries) && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">General Financial Ledger</h2>
              <p className="text-xs text-slate-500">Chronological transaction logs, disbursements, and receipts.</p>
            </div>

            {/* Filter, Search & Reversal Cleanup */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="income">Income / Revenue</option>
                <option value="cogs">COGS (Catch Intake)</option>
                <option value="opex">Operating Expenses (OpEx)</option>
                <option value="adjustment">Inventory Adjustment ({inventoryAdjustmentEntries.length})</option>
                <option value="reversals">Reversal Entries ({reversalEntries.length})</option>
              </select>

              {onClearInventoryAdjustmentEntries && inventoryAdjustmentEntries.length > 0 && !confirmClearAdjustments && (
                <button
                  type="button"
                  onClick={() => setConfirmClearAdjustments(true)}
                  disabled={isClearingAdjustments}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Inventory Adjustments ({inventoryAdjustmentEntries.length})</span>
                </button>
              )}

              {onClearInventoryAdjustmentEntries && confirmClearAdjustments && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-300">
                  <span className="text-[11px] font-bold text-rose-800">
                    Delete all {inventoryAdjustmentEntries.length} Inventory Adjustment row{inventoryAdjustmentEntries.length === 1 ? '' : 's'} from Supabase?
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAdjustmentsClick}
                    disabled={isClearingAdjustments}
                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {isClearingAdjustments ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAdjustments(false)}
                    disabled={isClearingAdjustments}
                    className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {onClearReversalEntries && reversalEntries.length > 0 && !confirmClearReversals && (
                <button
                  type="button"
                  onClick={() => setConfirmClearReversals(true)}
                  disabled={isClearingReversals}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Reversals ({reversalEntries.length})</span>
                </button>
              )}

              {onClearReversalEntries && confirmClearReversals && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-300">
                  <span className="text-[11px] font-bold text-rose-800">
                    Purge {reversalEntries.length} reversal{reversalEntries.length === 1 ? '' : 's'} from Supabase?
                  </span>
                  <button
                    type="button"
                    onClick={handleClearReversalsClick}
                    disabled={isClearingReversals}
                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {isClearingReversals ? 'Purging...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearReversals(false)}
                    disabled={isClearingReversals}
                    className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {onDeleteFinancialEntries && searchQuery.trim().length > 0 && filteredLedger.length > 0 && !confirmDeleteFiltered && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteFiltered(true)}
                  disabled={isDeletingEntries}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                  title="Delete all ledger rows currently matching your search query from Supabase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Matching ({filteredLedger.length})</span>
                </button>
              )}

              {onDeleteFinancialEntries && confirmDeleteFiltered && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-300">
                  <span className="text-[11px] font-bold text-rose-800">
                    Delete {filteredLedger.length} matching row{filteredLedger.length === 1 ? '' : 's'} from Supabase?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntriesClick(filteredLedger.map(e => e.id))}
                    disabled={isDeletingEntries}
                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {isDeletingEntries ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteFiltered(false)}
                    disabled={isDeletingEntries}
                    className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {reversalClearStatus && (
            <div
              className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border text-xs ${
                reversalClearStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : reversalClearStatus.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {reversalClearStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <p className="font-medium leading-relaxed">{reversalClearStatus.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setReversalClearStatus(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                aria-label="Dismiss status message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {(onDeleteFinancialEntries || onUpdateExpense) && (
                    <th className="py-3 px-4 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={(onDeleteFinancialEntries || onUpdateExpense) ? 8 : 7} className="py-10 px-4 text-center text-slate-400 font-medium">
                      No financial ledger entries match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono-code text-slate-600 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-3.5 px-4 font-mono-code font-bold text-slate-900">
                        {entry.referenceId}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {entry.description}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {entry.entityName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isReversalLedgerEntry(entry)
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : entry.category === 'Inventory Adjustment'
                            ? 'bg-violet-50 text-violet-700 border border-violet-200'
                            : entry.type === 'Income'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : entry.type === 'COGS'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {entry.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code font-bold">
                        <span className={entry.type === 'Income' && !isReversalLedgerEntry(entry) ? 'text-emerald-600' : 'text-slate-900'}>
                          {entry.type === 'Income' && !isReversalLedgerEntry(entry) ? '+' : '-'}{formatCurrency(entry.amount)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.status === 'Settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      {(onDeleteFinancialEntries || onUpdateExpense) && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {confirmDeleteEntryId === entry.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteEntriesClick([entry.id])}
                                disabled={isDeletingEntries}
                                className="px-2 py-1 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-60"
                              >
                                {isDeletingEntries ? '...' : 'Delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteEntryId(null)}
                                disabled={isDeletingEntries}
                                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              {onUpdateExpense && entry.type === 'OpEx' && !isReversalLedgerEntry(entry) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditExpense(entry)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit this operating expense"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteFinancialEntries && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteEntryId(entry.id)}
                                  disabled={isDeletingEntries}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Delete this entry from Supabase ledger"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Adjustment Accounts Tab */}
      {activeTab === 'adjustments' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Inventory Adjustment Accounts & Valuation</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Connected to Supabase
                </span>
              </div>
              <p className="text-xs text-slate-500">
                General Ledger accounts for stock shrinkage, processing trimming losses, retail conversions, and physical audit variances.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onClearInventoryAdjustmentEntries && (inventoryAdjustmentEntries.length > 0 || stockAdjustments.length > 0) && (
                <button
                  type="button"
                  onClick={handleClearAdjustmentsClick}
                  disabled={isClearingAdjustments}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isClearingAdjustments ? 'Clearing...' : 'Clear Adjustment Data'}</span>
                </button>
              )}
              <button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Adjustment Account</span>
              </button>
            </div>
          </div>

          {/* KPI Summary for Adjustments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Accounts</span>
              <div className="text-xl font-black text-slate-900 font-mono-code mt-1">{adjustmentAccounts.length}</div>
              <span className="text-[11px] text-slate-400">Chart of Accounts</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Shrinkage & Spoilage Write-Off</span>
              <div className="text-xl font-black text-rose-700 font-mono-code mt-1">-{formatCurrency(invAdjustmentLoss)}</div>
              <span className="text-[11px] text-rose-500">Unavoidable loss & trimming</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Count Recoveries / Surplus</span>
              <div className="text-xl font-black text-emerald-700 font-mono-code mt-1">+{formatCurrency(invAdjustmentGain)}</div>
              <span className="text-[11px] text-emerald-600">Physical count gains</span>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">Net COGS Impact</span>
              <div className={`text-xl font-black font-mono-code mt-1 ${netInventoryAdjustmentCost > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {netInventoryAdjustmentCost > 0 ? `-${formatCurrency(netInventoryAdjustmentCost)}` : `+${formatCurrency(Math.abs(netInventoryAdjustmentCost))}`}
              </div>
              <span className="text-[11px] text-indigo-700">Applied to Gross Profit</span>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Account Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Balance / Variance</th>
                  <th className="py-3 px-4 text-center">Default</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustmentAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No adjustment accounts configured. Add standard seafood processing accounts above.
                    </td>
                  </tr>
                ) : (
                  adjustmentAccounts.map(account => {
                    const accAdjustments = stockAdjustments.filter(a => a.adjustmentAccountCode === account.accountCode);
                    const cumVar = accAdjustments.reduce((sum, a) => sum + a.valuationVarianceUSD, 0);

                    return (
                      <tr key={account.id || account.accountCode} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono-code font-bold text-slate-900">
                          {account.accountCode}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {account.accountName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            account.accountType === 'Income'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : account.accountType === 'Contra-Asset'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {account.accountType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {account.description || 'Standard variance reconciliation'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-code font-bold">
                          <span className={cumVar < 0 ? 'text-rose-600' : cumVar > 0 ? 'text-emerald-600' : 'text-slate-800'}>
                            {cumVar < 0 ? `-${formatCurrency(Math.abs(cumVar))}` : formatCurrency(cumVar)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {account.isDefault ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Default
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment / Settle Balance Modal */}
      {selectedEntityForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${selectedEntityForPayment.type === 'AR' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedEntityForPayment.type === 'AR' ? 'Record Customer Payment' : 'Settle Supplier Payables'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedEntityForPayment(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {selectedEntityForPayment.type === 'AR'
                ? `Recording incoming payment from ${selectedEntityForPayment.entityName}. Outstanding balance is ${formatCurrency(selectedEntityForPayment.balance)}.`
                : `Recording disbursement / wire settlement to ${selectedEntityForPayment.entityName}. Current payable is ${formatCurrency(selectedEntityForPayment.balance)}.`
              }
            </p>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedEntityForPayment.balance}
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEntityForPayment(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Confirm & Post Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Expense Modal */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Record Operating Expense</h3>
              </div>
              <button 
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpenseSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                >
                  <option value="Logistics & Reefer Freight">Logistics & Reefer Freight</option>
                  <option value="Cold Storage Utilities">Cold Storage Utilities & Cryo-Gas</option>
                  <option value="Packaging & Ice">Packaging, Dry Ice & Cartons</option>
                  <option value="Labor & Cutting Crew">Labor & Cutting Crew Wages</option>
                  <option value="Dock Fees & Port Taxes">Dock Fees & Port Taxes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Dry ice bulk reload for Reefer 02"
                  value={newExpenseDesc}
                  onChange={(e) => setNewExpenseDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  placeholder="e.g. Pacific Cryo Logistics Inc"
                  value={newExpenseEntity}
                  onChange={(e) => setNewExpenseEntity(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Amount</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Operating Expense Modal */}
      {editingExpense && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isSavingExpenseEdit && setEditingExpense(null)}
        >
          <div
            className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Operating Expense</h3>
                  <p className="text-[11px] text-slate-500 font-mono-code">
                    Entry ID: {editingExpense.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSavingExpenseEdit && setEditingExpense(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {editExpenseError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editExpenseError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpenseEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Category</label>
                  <select
                    value={editExpCategory}
                    onChange={(e) => setEditExpCategory(e.target.value as FinancialEntryCategory)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Logistics & Reefer Freight">Logistics & Reefer Freight</option>
                    <option value="Cold Storage Utilities">Cold Storage Utilities & Cryo-Gas</option>
                    <option value="Packaging & Ice">Packaging, Dry Ice & Cartons</option>
                    <option value="Labor & Cutting Crew">Labor & Cutting Crew Wages</option>
                    <option value="Dock Fees & Port Taxes">Dock Fees & Port Taxes</option>
                    <option value="COGS (Catch Intake)">COGS (Catch Intake)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editExpAmount}
                    onChange={(e) => {
                      setEditExpAmount(e.target.value);
                      setEditExpenseError(null);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={editExpDescription}
                  onChange={(e) => {
                    setEditExpDescription(e.target.value);
                    setEditExpenseError(null);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vendor / Payee</label>
                  <input
                    type="text"
                    value={editExpEntity}
                    onChange={(e) => setEditExpEntity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={editExpDate}
                    onChange={(e) => setEditExpDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={editExpPaymentMethod}
                    onChange={(e) => setEditExpPaymentMethod(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Bank Transfer (ACH / SEPA)">Bank Transfer (ACH / SEPA)</option>
                    <option value="Corporate ACH / Direct">Corporate ACH / Direct</option>
                    <option value="Cash on Dock">Cash on Dock</option>
                    <option value="Company Card">Company Card</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Cheque">Cheque</option>
                    {editExpPaymentMethod &&
                      ![
                        'Bank Transfer',
                        'Bank Transfer (ACH / SEPA)',
                        'Corporate ACH / Direct',
                        'Cash on Dock',
                        'Company Card',
                        'Mobile Money',
                        'Cheque'
                      ].includes(editExpPaymentMethod) && (
                        <option value={editExpPaymentMethod}>{editExpPaymentMethod}</option>
                      )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ref / Voucher #</label>
                  <input
                    type="text"
                    value={editExpReference}
                    onChange={(e) => setEditExpReference(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editExpStatus}
                    onChange={(e) => setEditExpStatus(e.target.value as 'Settled' | 'Pending' | 'Overdue')}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 cursor-pointer"
                  >
                    <option value="Settled">Settled</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional audit note..."
                  value={editExpNotes}
                  onChange={(e) => setEditExpNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  disabled={isSavingExpenseEdit}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpenseEdit}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSavingExpenseEdit ? 'Saving Changes...' : 'Update Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Adjustment Account Modal */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">New Adjustment Account</h3>
              </div>
              <button 
                onClick={() => setIsAddAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Create a general ledger adjustment account synced to your Supabase database for tracking specific variance reasons.
            </p>

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Account Code *</label>
                <input
                  type="text"
                  placeholder="e.g. 5165"
                  value={newAccCode}
                  onChange={(e) => setNewAccCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Saku Cutting & Quality Trimming Loss"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Account Type</label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium cursor-pointer"
                >
                  <option value="COGS">COGS (Direct Production & Biomass Loss)</option>
                  <option value="OpEx">OpEx (Operating Expense)</option>
                  <option value="Contra-Asset">Contra-Asset (Inventory Offset)</option>
                  <option value="Income">Income (Physical Audit Surplus)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description / Audit Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Biomass loss during loin skinning and preparation..."
                  value={newAccDesc}
                  onChange={(e) => setNewAccDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAccIsDefault}
                  onChange={(e) => setNewAccIsDefault(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-slate-700 font-medium">Set as default account for stock adjustments</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save to Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
