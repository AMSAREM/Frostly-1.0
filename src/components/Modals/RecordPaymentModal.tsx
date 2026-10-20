import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Hash, 
  FileText, 
  CheckCircle2, 
  Building2, 
  X,
  Receipt
} from 'lucide-react';
import { Customer, ClientOrder } from '../../types';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  orders: ClientOrder[];
  preselectedOrderId?: string;
  suggestedAmount?: number;
  formatCurrency: (val: number) => string;
  onRecordPayment: (
    type: 'AR' | 'AP', 
    entityId: string, 
    amount: number, 
    refId: string,
    paymentMethod: string,
    notes: string,
    specificOrderId?: string
  ) => void;
  onPaymentSuccess?: (receiptData: any) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  orders = [],
  preselectedOrderId,
  suggestedAmount,
  formatCurrency,
  onRecordPayment,
  onPaymentSuccess
}) => {
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Wire Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [viewReceiptAfter, setViewReceiptAfter] = useState<boolean>(true);

  // Initialize or reset when customer or preselected order changes
  useEffect(() => {
    if (customer) {
      if (suggestedAmount !== undefined && suggestedAmount > 0) {
        setAmount(suggestedAmount.toString());
      } else if (customer.outstandingBalanceUSD > 0) {
        setAmount(customer.outstandingBalanceUSD.toString());
      } else {
        setAmount('');
      }

      if (preselectedOrderId) {
        setSelectedOrderId(preselectedOrderId);
        setReferenceNumber(`PMT-${preselectedOrderId}`);
      } else {
        setSelectedOrderId('');
        const randCode = Math.floor(1000 + Math.random() * 9000);
        setReferenceNumber(`WIRE-${randCode}`);
      }

      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [customer, preselectedOrderId, suggestedAmount, isOpen]);

  if (!isOpen || !customer) return null;

  // Unpaid orders for this customer
  const unpaidOrders = orders.filter(o => {
    const matchesCust = 
      o.customerId === customer.id ||
      o.clientName.toLowerCase().trim() === customer.name.toLowerCase().trim() ||
      o.clientName.toLowerCase().trim() === customer.companyName.toLowerCase().trim();
    return matchesCust && o.paymentStatus !== 'Paid';
  });

  const handleQuickAmount = (val: number) => {
    setAmount(val.toFixed(2));
  };

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (orderId) {
      const ord = unpaidOrders.find(o => o.id === orderId);
      if (ord) {
        const orderAmt = ord.adjustedTotalUSD || ord.quotedTotalUSD || 0;
        setAmount(orderAmt.toString());
        setReferenceNumber(`PMT-${ord.id}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const finalRef = referenceNumber.trim() || `PMT-${Date.now().toString().slice(-6)}`;
    const finalNotes = notes.trim();

    onRecordPayment(
      'AR',
      customer.id,
      numAmount,
      finalRef,
      paymentMethod,
      finalNotes,
      selectedOrderId || undefined
    );

    if (onPaymentSuccess) {
      onPaymentSuccess({
        id: `LEDG-PMT-${Date.now()}`,
        customerId: customer.id,
        customerName: customer.name,
        date: paymentDate,
        type: 'Payment',
        referenceId: finalRef,
        description: selectedOrderId 
          ? `Customer AR Payment for Order #${selectedOrderId}` 
          : `Customer AR Settlement Received - ${customer.name}`,
        debit: 0,
        credit: numAmount,
        runningBalance: Math.max(0, customer.outstandingBalanceUSD - numAmount),
        paymentMethod,
        status: 'Settled',
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
        notes: finalNotes,
        orderId: selectedOrderId || undefined
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-lg w-full rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Record Customer Payment</h3>
              <p className="text-xs text-slate-500">Post Accounts Receivable settlement to ledger</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Account Summary Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>{customer.companyName || customer.name}</span>
            </div>
            <span className="font-mono-code font-bold text-slate-500">{customer.id}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Balance Due (AR)</div>
              <div className="text-base font-black font-mono-code text-amber-700 mt-0.5">
                {formatCurrency(customer.outstandingBalanceUSD)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Credit Terms</div>
              <div className="text-xs font-bold text-slate-700 mt-1">
                {customer.paymentTerms} (Limit: {formatCurrency(customer.creditLimitUSD)})
              </div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Amount Input & Quick Fill */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-800">
                Payment Amount Received ($ USD) <span className="text-rose-600">*</span>
              </label>
              {customer.outstandingBalanceUSD > 0 && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(customer.outstandingBalanceUSD)}
                    className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                  >
                    Full Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAmount(customer.outstandingBalanceUSD / 2)}
                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                  >
                    50%
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-3 font-bold text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-black text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Bank Wire Transfer">Bank Wire Transfer (Swift / Fedwire)</option>
                <option value="ACH / Direct Bank Transfer">ACH / Direct Bank Transfer</option>
                <option value="Company Check">Company Check / Certified Check</option>
                <option value="Corporate Credit Card">Corporate Credit Card</option>
                <option value="Cash / Dock Settlement">Cash / Pier Settlement</option>
                <option value="Letter of Credit">Letter of Credit (LC)</option>
                <option value="Store Credit Adjustment">Store Credit Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          {/* Reference # / Check # */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Check # / Wire Ref / Receipt ID</label>
              <input
                type="text"
                placeholder="e.g. WIRE-88129 or CHK-4011"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            {/* Allocate to Invoice */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Allocate to Specific Invoice</label>
              <select
                value={selectedOrderId}
                onChange={(e) => handleOrderChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Apply to Overall AR Balance (FIFO)</option>
                {unpaidOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    Order #{o.id} ({formatCurrency(o.adjustedTotalUSD || o.quotedTotalUSD)}) - {o.orderDate}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes / Memo */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Payment Notes / Memo (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Payment for Invoice #ORD-9421 received via wire from accounts payable office..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Submit Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Post Payment to Ledger</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
