import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  DollarSign,
  ShieldAlert,
  Archive,
  Building2,
  Scale,
  FileWarning,
  ClipboardCheck,
  CheckCircle2,
  PackageX
} from 'lucide-react';
import {
  InventoryBatch,
  InventoryAdjustmentAccount,
  ClientOrder,
  PurchaseOrderLanding,
  RetailWholesaleProduct
} from '../../types';
import { formatWeight, formatCurrency as defaultFormatCurrency } from '../../utils/formatters';
import { supabase, isSupabaseConfigured } from '../../utils/supabase';

export type BatchDisposalMode =
  | 'write_off_and_delete'
  | 'write_off_and_decommission'
  | 'void_erroneous_entry';

export interface DeleteBatchOptions {
  mode: BatchDisposalMode;
  reason: string;
  adjustmentAccountId?: string;
  adjustmentAccountCode: string;
  adjustmentAccountName: string;
  notes: string;
  removeLinkedProduct: boolean;
}

interface DeleteBatchModalProps {
  batch: InventoryBatch | null;
  orders?: ClientOrder[];
  purchaseOrders?: PurchaseOrderLanding[];
  products?: RetailWholesaleProduct[];
  adjustmentAccounts?: InventoryAdjustmentAccount[];
  defaultAccountCode?: string;
  useImperial: boolean;
  currencySymbol?: string;
  formatCurrency?: (amount: number) => string;
  onClose: () => void;
  onConfirmDelete: (batchId: string, options: DeleteBatchOptions) => Promise<void> | void;
}

const WRITE_OFF_REASONS = [
  { label: 'Spoilage / Cold-Chain Excursions', defaultCode: '5150' },
  { label: 'Freezer Burn / Quality Rejection', defaultCode: '5150' },
  { label: 'Processing Yield & Trimming Shrinkage', defaultCode: '5155' },
  { label: 'Physical Audit / Scale Reconciliation', defaultCode: '5160' },
  { label: 'Damaged Packaging / Unsellable Lot', defaultCode: '5150' },
  { label: 'Duplicate / Erroneous Dock Entry', defaultCode: '5160' }
];

const DEFAULT_FALLBACK_ACCOUNTS: InventoryAdjustmentAccount[] = [
  {
    id: 'adj-acc-shrinkage-5150',
    accountCode: '5150',
    accountName: 'Inventory Shrinkage & Spoilage',
    accountType: 'COGS',
    description: 'Unavoidable drip loss, physical shrinkage, freezer burn, or spoilage write-down.',
    isDefault: true,
    isActive: true,
    balanceUSD: 0
  },
  {
    id: 'adj-acc-yield-5155',
    accountCode: '5155',
    accountName: 'Processing Yield & Trimming Loss',
    accountType: 'COGS',
    description: 'Biomass reduction from head removal, gutting, loin deboning, and sashimi trimming.',
    isDefault: false,
    isActive: true,
    balanceUSD: 0
  },
  {
    id: 'adj-acc-scale-5160',
    accountCode: '5160',
    accountName: 'Scale Calibration & Count Variance',
    accountType: 'COGS',
    description: 'Adjustments following periodic certified physical floor counts and crane scale recalibration.',
    isDefault: false,
    isActive: true,
    balanceUSD: 0
  }
];

export const DeleteBatchModal: React.FC<DeleteBatchModalProps> = ({
  batch,
  orders = [],
  purchaseOrders = [],
  products = [],
  adjustmentAccounts = [],
  defaultAccountCode = '5150',
  useImperial,
  currencySymbol = 'GHS',
  formatCurrency,
  onClose,
  onConfirmDelete
}) => {
  const fmtMoney = useMemo(
    () => formatCurrency || ((amt: number) => defaultFormatCurrency(amt, currencySymbol)),
    [formatCurrency, currencySymbol]
  );

  const [haccpRecordCount, setHaccpRecordCount] = useState<number>(0);
  const [isCheckingRefs, setIsCheckingRefs] = useState<boolean>(false);

  // Check Supabase HACCP audit records referencing this lot (fk_haccp_audit_lot ON DELETE RESTRICT)
  useEffect(() => {
    if (!batch) return;
    let active = true;
    const checkRefs = async () => {
      if (!isSupabaseConfigured) {
        if (active) setHaccpRecordCount(0);
        return;
      }
      setIsCheckingRefs(true);
      try {
        const { count, error } = await supabase
          .from('haccp_audit_records')
          .select('id', { count: 'exact', head: true })
          .eq('lot_id', batch.id);
        if (active && !error && typeof count === 'number') {
          setHaccpRecordCount(count);
        }
      } catch {
        // Offline or unreachable — fall back cleanly
      } finally {
        if (active) setIsCheckingRefs(false);
      }
    };
    checkRefs();
    return () => {
      active = false;
    };
  }, [batch?.id]);

  // Identify linked orders, allocations, POs, and retail catalog products
  const referencingOrders = useMemo(() => {
    if (!batch) return [];
    return orders.filter((o) => o.items?.some((item) => item.lotId === batch.id));
  }, [orders, batch]);

  const activeOrderAllocations = useMemo(() => {
    return referencingOrders.filter(
      (o) => o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Voided'
    );
  }, [referencingOrders]);

  const linkedProduct = useMemo(() => {
    if (!batch) return undefined;
    const skuClean = (batch.productSku || '').toLowerCase().trim();
    return products.find(
      (p) =>
        p.linkedBatchId === batch.id ||
        batch.linkedProductId === p.id ||
        (skuClean && (p.sku || '').toLowerCase().trim() === skuClean) ||
        p.id === `prod-${batch.id}`
    );
  }, [products, batch]);

  const linkedPO = useMemo(() => {
    if (!batch) return undefined;
    return purchaseOrders.find((po) => po.lotAssignedId === batch.id);
  }, [purchaseOrders, batch]);

  const allAccounts = useMemo(() => {
    const active = (adjustmentAccounts || []).filter((a) => a.isActive !== false && a.accountType !== 'Income');
    return active.length > 0 ? active : DEFAULT_FALLBACK_ACCOUNTS;
  }, [adjustmentAccounts]);

  const availableKg = Math.max(0, Number(batch?.availableWeightKg || 0));
  const allocatedKg = Math.max(0, Number(batch?.allocatedWeightKg || 0));
  const unitCost = Math.max(0, Number(batch?.costPerKg || 0));
  const costAssetValue = Number((availableKg * unitCost).toFixed(2));
  const wholesaleValue = Number((availableKg * Math.max(0, Number(batch?.wholesalePricePerKg || 0))).toFixed(2));

  const isAllocationBlocked = allocatedKg > 0.001;
  const hasImmutableReferences = referencingOrders.length > 0 || haccpRecordCount > 0;
  const isAlreadyDecommissioned = Boolean(batch?.notes && batch.notes.includes('[DECOMMISSIONED'));

  const [mode, setMode] = useState<BatchDisposalMode>(() => {
    if (hasImmutableReferences) return 'write_off_and_decommission';
    if (availableKg > 0.001) return 'write_off_and_delete';
    return 'void_erroneous_entry';
  });

  // Sync default mode whenever batch or async HACCP check updates
  useEffect(() => {
    if (!batch) return;
    if (hasImmutableReferences) {
      setMode('write_off_and_decommission');
    } else if (availableKg > 0.001) {
      setMode((prev) => (prev === 'write_off_and_decommission' ? 'write_off_and_delete' : prev));
    } else {
      setMode('void_erroneous_entry');
    }
  }, [batch?.id, hasImmutableReferences, availableKg]);

  const [reason, setReason] = useState<string>(WRITE_OFF_REASONS[0].label);
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>(
    defaultAccountCode || allAccounts[0]?.accountCode || '5150'
  );
  const [notes, setNotes] = useState<string>('');
  const [removeLinkedProduct, setRemoveLinkedProduct] = useState<boolean>(true);
  const [confirmText, setConfirmText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!batch) return null;

  const activeAccount =
    allAccounts.find((a) => a.accountCode === selectedAccountCode) || allAccounts[0];

  const handleReasonChange = (newReason: string) => {
    setReason(newReason);
    const match = WRITE_OFF_REASONS.find((r) => r.label === newReason);
    if (match) {
      const targetAcc = allAccounts.find((a) => a.accountCode === match.defaultCode);
      if (targetAcc) {
        setSelectedAccountCode(targetAcc.accountCode);
      }
    }
  };

  const requiresDeleteTyping = mode !== 'write_off_and_decommission';
  const isConfirmDisabled =
    isAllocationBlocked ||
    isSubmitting ||
    isCheckingRefs ||
    (requiresDeleteTyping && confirmText.trim().toUpperCase() !== 'DELETE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmDisabled) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmDelete(batch.id, {
        mode,
        reason,
        adjustmentAccountId: activeAccount?.id,
        adjustmentAccountCode: activeAccount?.accountCode || selectedAccountCode,
        adjustmentAccountName: activeAccount?.accountName || 'Inventory Shrinkage & Spoilage',
        notes: notes.trim(),
        removeLinkedProduct
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to process inventory disposal.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div
          className={`p-5 sm:p-6 text-white ${
            isAllocationBlocked
              ? 'bg-gradient-to-r from-amber-600 to-amber-700'
              : hasImmutableReferences
              ? 'bg-gradient-to-r from-indigo-700 to-slate-900'
              : 'bg-gradient-to-r from-rose-600 to-rose-700'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                {isAllocationBlocked ? (
                  <ShieldAlert className="w-5 h-5 text-white" />
                ) : hasImmutableReferences ? (
                  <Archive className="w-5 h-5 text-white" />
                ) : (
                  <Trash2 className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                  {isAllocationBlocked
                    ? 'Removal Blocked: Stock Reserved for Orders'
                    : hasImmutableReferences
                    ? 'Financial Write-Off & Lot Decommission'
                    : 'Remove / Write Off Inventory Lot'}
                </h3>
                <p className="text-xs text-white/80 font-mono">
                  {batch.id} • {batch.speciesName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {/* Batch Financial Valuation Snapshot */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Available Stock</span>
              <span className="font-mono font-extrabold text-sm text-slate-900">
                {formatWeight(availableKg, useImperial)}
              </span>
              {allocatedKg > 0 && (
                <span className="block text-[10px] font-semibold text-amber-700">
                  +{formatWeight(allocatedKg, useImperial)} reserved
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Asset Basis</span>
              <span className="font-mono font-extrabold text-sm text-rose-700">
                {fmtMoney(costAssetValue)}
              </span>
              <span className="block text-[10px] text-slate-400">
                @ {fmtMoney(unitCost)}/kg
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Wholesale Value</span>
              <span className="font-mono font-extrabold text-sm text-indigo-700">
                {fmtMoney(wholesaleValue)}
              </span>
              <span className="block text-[10px] text-slate-400">
                {batch.grade}
              </span>
            </div>
          </div>

          {/* Allocation Blocker */}
          {isAllocationBlocked ? (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    Cannot write off or delete while {formatWeight(allocatedKg, useImperial)} is allocated
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Open customer orders currently reserve stock from this cold-storage lot. Fulfill, reallocate, or void the active orders before removing this inventory item.
                  </p>
                </div>
              </div>

              {activeOrderAllocations.length > 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Active Orders Reserving This Lot
                  </div>
                  <div className="space-y-1.5">
                    {activeOrderAllocations.map((ord) => (
                      <div
                        key={ord.id}
                        className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">{ord.id}</span>
                          <span className="text-slate-500 ml-2">{ord.clientName}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {ord.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Traceability Notice when Orders / HACCP logs exist */}
              {hasImmutableReferences && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-950 flex items-start gap-3">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-xs text-indigo-950">
                      Protected Audit Trail — Financial Write-Off & Decommission Required
                    </div>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      This lot is linked to{' '}
                      {referencingOrders.length > 0 && (
                        <strong>{referencingOrders.length} sales order(s)</strong>
                      )}
                      {referencingOrders.length > 0 && haccpRecordCount > 0 && ' and '}
                      {haccpRecordCount > 0 && (
                        <strong>{haccpRecordCount} HACCP audit log(s)</strong>
                      )}
                      . To comply with database referential integrity (<span className="font-mono">fk_order_items_lot</span>), invoice COGS history, and FDA Title 21 CFR 123 traceability, the lot row is archived as <strong>Decommissioned (0 kg)</strong> while remaining asset value is formally written off to the General Financial Ledger.
                    </p>
                  </div>
                </div>
              )}

              {/* Unsettled Supplier PO Warning */}
              {linkedPO && linkedPO.paymentStatus !== 'Settled' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-start gap-2.5">
                  <FileWarning className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>Accounts Payable Note:</strong> This lot originated from Dock PO{' '}
                    <span className="font-mono font-bold">{linkedPO.id}</span> ({linkedPO.supplierName},{' '}
                    {fmtMoney(linkedPO.totalCostUSD)}, status: <strong>{linkedPO.paymentStatus}</strong>). Writing off or removing inventory reduces physical asset valuation to COGS but preserves your supplier AP obligation.
                  </div>
                </div>
              )}

              {/* Accounting Disposal Mode Picker (only when hard delete is allowed & stock > 0) */}
              {!hasImmutableReferences && availableKg > 0.001 && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700">
                    Accounting Method for Remaining Stock ({formatWeight(availableKg, useImperial)})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMode('write_off_and_delete')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        mode === 'write_off_and_delete'
                          ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">Write-Off to GL & Delete</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        Posts {fmtMoney(costAssetValue)} COGS shrinkage entry to the Financial Ledger before deleting lot.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('void_erroneous_entry')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        mode === 'void_erroneous_entry'
                          ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900'
                      }`}
                    >
                      <div className="font-bold mb-1">Void Erroneous Entry</div>
                      <p
                        className={`text-[11px] leading-snug ${
                          mode === 'void_erroneous_entry' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        For duplicate or typo intake only. Deletes lot with zero COGS expense posted.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* GL Write-Off Account & Reason (shown whenever mode writes off stock > 0) */}
              {mode !== 'void_erroneous_entry' && availableKg > 0.001 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      General Ledger Write-Off Posting
                    </span>
                    <span className="font-mono font-bold text-rose-700">
                      -{fmtMoney(costAssetValue)} Asset → COGS
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Disposal / Write-Off Reason
                      </label>
                      <select
                        value={reason}
                        onChange={(e) => handleReasonChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {WRITE_OFF_REASONS.map((r) => (
                          <option key={r.label} value={r.label}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Write-Off GL Account
                      </label>
                      <select
                        value={selectedAccountCode}
                        onChange={(e) => setSelectedAccountCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {allAccounts.map((acc) => (
                          <option key={acc.id || acc.accountCode} value={acc.accountCode}>
                            [{acc.accountCode}] {acc.accountName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Audit / Inspection Notes
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Freezer compressor downtime or quality rejection signed off by QA lead..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Zero-stock clean delete summary */}
              {availableKg <= 0.001 && !hasImmutableReferences && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>Zero Asset Balance ({fmtMoney(0)}):</strong> This lot is already depleted with no open orders or HACCP records. Removing it cleanly deletes an empty lot without altering financial asset balances.
                  </div>
                </div>
              )}

              {/* Linked Dual Price Book Product handling */}
              {linkedProduct && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  {hasImmutableReferences ? (
                    <div className="flex items-center gap-2 text-[11px] text-slate-700">
                      <PackageX className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>
                        Linked Dual Price Book item <strong>{linkedProduct.name}</strong> ({linkedProduct.sku}) will be set to <strong>0 kg</strong> and marked unavailable for sale.
                      </span>
                    </div>
                  ) : (
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeLinkedProduct}
                        onChange={(e) => setRemoveLinkedProduct(e.target.checked)}
                        className="mt-0.5 w-3.5 h-3.5 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-700 leading-relaxed">
                        Also remove 1:1 linked Dual Price Book SKU{' '}
                        <strong className="text-slate-900">
                          {linkedProduct.name} ({linkedProduct.sku})
                        </strong>{' '}
                        so Retail & Wholesale catalogs stay synchronized.
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Confirmation Input for Permanent Deletion */}
              {requiresDeleteTyping && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Type{' '}
                    <span className="font-mono-code text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      DELETE
                    </span>{' '}
                    to confirm permanent lot removal:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono-code focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {isAlreadyDecommissioned && (
                <div className="text-[11px] text-slate-500 italic">
                  This lot is already marked as Decommissioned.
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              {isAllocationBlocked ? 'Dismiss' : 'Cancel'}
            </button>
            {!isAllocationBlocked && (
              <button
                type="submit"
                disabled={isConfirmDisabled}
                className={`px-5 py-2 rounded-full text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === 'write_off_and_decommission'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting ? (
                  <>Processing...</>
                ) : mode === 'write_off_and_decommission' ? (
                  <>
                    <Archive className="w-3.5 h-3.5" />
                    <span>Write Off & Decommission Lot</span>
                  </>
                ) : mode === 'write_off_and_delete' ? (
                  <>
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Post Write-Off & Delete Lot</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete Lot</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
