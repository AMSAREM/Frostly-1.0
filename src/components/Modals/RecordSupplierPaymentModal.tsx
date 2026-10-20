import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Hash, 
  FileText, 
  CheckCircle2, 
  Ship, 
  X,
  Receipt,
  Anchor,
  AlertCircle
} from 'lucide-react';
import { Supplier, PurchaseOrderLanding } from '../../types';

interface RecordSupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  purchaseOrders: PurchaseOrderLanding[];
  preselectedPOId?: string;
  suggestedAmount?: number;
  formatCurrency: (val: number) => string;
  onRecordPayment: (
    type: 'AR' | 'AP', 
    entityId: string, 
    amount: number, 
    refId: string,
    paymentMethod: string,
    notes: string,
    specificPOId?: string
  ) => void;
  onPaymentSuccess?: (voucherData: any) => void;
}

export const RecordSupplierPaymentModal: React.FC<RecordSupplierPaymentModalProps> = ({
  isOpen,
  onClose,
  supplier,
  purchaseOrders = [],
  preselectedPOId,
  suggestedAmount,
  formatCurrency,
  onRecordPayment,
  onPaymentSuccess
}) => {
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Federal Wire Transfer / ACH');
  const [voucherNumber, setVoucherNumber] = useState<string>('');
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [viewVoucherAfter, setViewVoucherAfter] = useState<boolean>(true);

  // Initialize or reset when supplier or preselected PO changes
  useEffect(() => {
    if (supplier) {
      if (suggestedAmount !== undefined && suggestedAmount > 0) {
        setAmount(suggestedAmount.toString());
      } else if (supplier.outstandingPayableUSD > 0) {
        setAmount(supplier.outstandingPayableUSD.toString());
      } else {
        setAmount('');
      }

      if (preselectedPOId) {
        setSelectedPOId(preselectedPOId);
        const po = purchaseOrders.find(p => p.id === preselectedPOId);
        if (po) {
          setAmount(po.totalCostUSD.toString());
        }
        setVoucherNumber(`VOUCH-${preselectedPOId}`);
      } else {
        setSelectedPOId('');
        const randCode = Math.floor(1000 + Math.random() * 9000);
        setVoucherNumber(`VOUCH-${randCode}`);
      }

      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [supplier, preselectedPOId, suggestedAmount, isOpen]);

  if (!isOpen || !supplier) return null;

  // Unpaid or pending POs for this supplier
  const unpaidPOs = purchaseOrders.filter(po => {
    const matchesSup = 
      po.supplierId === supplier.id ||
      po.supplierName.toLowerCase().trim() === supplier.name.toLowerCase().trim();
    return matchesSup && po.paymentStatus !== 'Paid in Full';
  });

  const handleQuickAmount = (val: number) => {
    setAmount(val.toFixed(2));
  };

  const handlePOChange = (poId: string) => {
    setSelectedPOId(poId);
    if (poId) {
      const po = unpaidPOs.find(p => p.id === poId);
      if (po) {
        setAmount(po.totalCostUSD.toString());
        setVoucherNumber(`VOUCH-${po.id}`);
        setNotes(`Dock catch settlement for ${po.speciesItems[0]?.speciesName || 'Seafood Catch'} (Lot: ${po.lotAssignedId})`);
      }
    } else {
      if (supplier.outstandingPayableUSD > 0) {
        setAmount(supplier.outstandingPayableUSD.toString());
      }
      const randCode = Math.floor(1000 + Math.random() * 9000);
      setVoucherNumber(`VOUCH-${randCode}`);
      setNotes('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    const finalVoucherNum = voucherNumber.trim() || `VOUCH-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalRefId = selectedPOId || finalVoucherNum;

    onRecordPayment(
      'AP',
      supplier.id,
      numericAmount,
      finalRefId,
      paymentMethod,
      notes.trim(),
      selectedPOId || undefined
    );

    if (viewVoucherAfter && onPaymentSuccess) {
      const remainingBal = Math.max(0, supplier.outstandingPayableUSD - numericAmount);
      onPaymentSuccess({
        id: `LEDG-DSB-${Date.now().toString().slice(-4)}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: paymentDate,
        type: 'Disbursement',
        referenceId: finalRefId,
        voucherNumber: finalVoucherNum,
        description: notes.trim() || `Harvester AP Settlement Wire - ${supplier.name}`,
        debit: numericAmount,
        credit: 0,
        runningBalance: remainingBal,
        paymentMethod: paymentMethod,
        status: 'Settled',
        purchaseOrderId: selectedPOId || undefined,
        notes: notes.trim()
      });
    }

    onClose();
  };

  const numericAmount = parseFloat(amount) || 0;
  const projectedRemainingAP = Math.max(0, supplier.outstandingPayableUSD - numericAmount);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight uppercase">Disburse Harvester Payment</h3>
              <p className="text-[11px] text-slate-400">Post Accounts Payable (AP) Wire Settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Supplier Info Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                <Ship className="w-4 h-4" />
              </span>
              <div>
                <div className="font-bold text-slate-900 text-sm">{supplier.name}</div>
                <div className="text-[11px] text-slate-500">{supplier.portLocation}, {supplier.country} • Terms: {supplier.paymentTerms}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Outstanding AP</div>
              <div className="font-mono-code font-black text-rose-700 text-sm">
                {formatCurrency(supplier.outstandingPayableUSD)}
              </div>
            </div>
          </div>

          {/* Allocation: Specific Landed Catch PO or General AP Account */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Apply Payment Allocation To:
            </label>
            <select
              value={selectedPOId}
              onChange={(e) => handlePOChange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">General Accounts Payable (Oldest Outstanding Dues)</option>
              {unpaidPOs.map(po => {
                const item = po.speciesItems[0];
                return (
                  <option key={po.id} value={po.id}>
                    PO #{po.id} - {item?.speciesName} ({item?.weightKg.toLocaleString()}kg) • {formatCurrency(po.totalCostUSD)} [{po.paymentStatus}]
                  </option>
                );
              })}
            </select>
            {selectedPOId && (
              <p className="text-[11px] text-blue-700 mt-1 flex items-center gap-1 font-medium">
                <Anchor className="w-3 h-3" />
                <span>Targeted to Landed Catch PO #{selectedPOId}. Marked as "Paid in Full" on confirmation.</span>
              </p>
            )}
          </div>

          {/* Disbursement Amount & Quick Fill Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Disbursement Amount ($ USD) <span className="text-rose-600">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                {supplier.outstandingPayableUSD > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(supplier.outstandingPayableUSD)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer"
                    >
                      Full Balance ({formatCurrency(supplier.outstandingPayableUSD)})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(supplier.outstandingPayableUSD / 2)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer"
                    >
                      50%
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={supplier.outstandingPayableUSD > 0 ? supplier.outstandingPayableUSD * 1.5 : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method / Channel</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Federal Wire Transfer / ACH">Federal Wire Transfer / ACH</option>
                <option value="Direct Dockside Cash">Direct Dockside Cash</option>
                <option value="Harvester Commercial Cheque">Harvester Commercial Cheque</option>
                <option value="SWIFT International Wire">SWIFT International Wire</option>
                <option value="Escrow / Letter of Credit">Escrow / Letter of Credit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Settlement Date</label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Voucher / Check Reference Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Remittance Voucher # / Wire Reference
            </label>
            <div className="relative">
              <Hash className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. VOUCH-8821 or WIRE-4921"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          {/* Audit Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Remittance Advice Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Catch dock weight approved; net settlement wire sent"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Projected Balance Preview */}
          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-blue-900 font-bold">Remaining Accounts Payable Balance:</div>
              <div className="text-[10px] text-blue-700">Projected amount owed to {supplier.name} after posting this wire.</div>
            </div>
            <div className="font-mono-code font-black text-blue-900 text-sm">
              {formatCurrency(projectedRemainingAP)}
            </div>
          </div>

          {/* View Voucher Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="viewVoucherAfter"
              checked={viewVoucherAfter}
              onChange={(e) => setViewVoucherAfter(e.target.checked)}
              className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
            />
            <label htmlFor="viewVoucherAfter" className="text-xs text-slate-700 font-medium cursor-pointer">
              Open printable Remittance Voucher immediately upon confirmation
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Confirm & Disburse {formatCurrency(numericAmount)}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
