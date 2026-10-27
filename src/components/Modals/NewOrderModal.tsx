import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Truck, 
  ShoppingBag, 
  Layers, 
  DollarSign, 
  Sparkles,
  Package,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  ShieldAlert,
  Building2,
  Info
} from 'lucide-react';
import { ClientOrder, OrderLineItem, InventoryBatch, Customer, PaymentTerms } from '../../types';
import { formatCurrency, formatWeight } from '../../utils/formatters';

interface NewOrderModalProps {
  batches: InventoryBatch[];
  customers?: Customer[];
  preselectedCustomerId?: string | null;
  onClose: () => void;
  onAddOrder: (order: ClientOrder) => void;
  useImperial: boolean;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  batches,
  customers = [],
  preselectedCustomerId,
  onClose,
  onAddOrder,
  useImperial
}) => {
  // Customer selection mode: registered account vs custom walk-in
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (preselectedCustomerId) return preselectedCustomerId;
    if (customers.length > 0) return customers[0].id;
    return '';
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Billing and Credit Sale Terms
  const [saleType, setSaleType] = useState<'Credit Sale (On Account)' | 'Immediate Settlement / COD'>('Credit Sale (On Account)');
  const [creditTerms, setCreditTerms] = useState<PaymentTerms>('Net-30');

  // Client Details
  const [clientName, setClientName] = useState('');
  const [clientCategory, setClientCategory] = useState<ClientOrder['clientCategory']>('Michelin Restaurant');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [packaging, setPackaging] = useState<ClientOrder['packagingRequirement']>('Waxed Seafood Master Box');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Credit Override state if limit exceeded or on hold
  const [creditOverrideConfirmed, setCreditOverrideConfirmed] = useState(false);
  const [creditOverrideApprover, setCreditOverrideApprover] = useState('Operations Finance Lead');
  const [creditOverrideReason, setCreditOverrideReason] = useState('Authorized wholesale catch-rate credit extension');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Synchronize customer details whenever customer selection changes
  useEffect(() => {
    if (selectedCustomer) {
      setClientName(selectedCustomer.companyName || selectedCustomer.name);
      setContactPerson(selectedCustomer.contactPerson || 'Purchasing Chef');
      setContactEmail(selectedCustomer.email || '');
      setContactPhone(selectedCustomer.phone || '');
      setDestinationCity(selectedCustomer.city || 'San Francisco, CA');
      setDeliveryAddress(selectedCustomer.address || 'Pier 38 Commercial Berth');
      setCreditTerms(selectedCustomer.paymentTerms || 'Net-30');

      // Map customer type to order category
      if (selectedCustomer.type === 'Hotel & Resort') {
        setClientCategory('Luxury Hotel Group');
      } else if (selectedCustomer.type === 'Supermarket / Retailer') {
        setClientCategory('Supermarket Chain');
      } else if (selectedCustomer.type === 'Fishmonger / Distributor') {
        setClientCategory('Gourmet Fishmonger');
      } else {
        setClientCategory('Michelin Restaurant');
      }
    }
  }, [selectedCustomerId, selectedCustomer]);

  // Order Items
  const [items, setItems] = useState<OrderLineItem[]>(() => {
    if (batches.length === 0) return [];
    const b = batches[0];
    return [
      {
        id: 'item-' + Date.now(),
        speciesId: b.speciesId,
        speciesName: b.speciesName,
        grade: b.grade,
        lotId: b.id,
        requestedWeightKg: Math.min(10, b.availableWeightKg),
        actualWeighedKg: null,
        pricePerKg: b.wholesalePricePerKg,
        notes: ''
      }
    ];
  });

  const handleAddItem = () => {
    const defaultBatch = batches[0];
    if (!defaultBatch) return;
    setItems([
      ...items,
      {
        id: 'item-' + Date.now() + Math.random(),
        speciesId: defaultBatch.speciesId,
        speciesName: defaultBatch.speciesName,
        grade: defaultBatch.grade,
        lotId: defaultBatch.id,
        requestedWeightKg: Math.min(10, defaultBatch.availableWeightKg),
        actualWeighedKg: null,
        pricePerKg: defaultBatch.wholesalePricePerKg,
        notes: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemLotChange = (index: number, lotId: string) => {
    const batch = batches.find(b => b.id === lotId);
    if (!batch) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      lotId: batch.id,
      speciesId: batch.speciesId,
      speciesName: batch.speciesName,
      grade: batch.grade,
      pricePerKg: batch.wholesalePricePerKg
    };
    setItems(updated);
  };

  const handleItemWeightChange = (index: number, weight: number) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      requestedWeightKg: Math.max(0.5, weight)
    };
    setItems(updated);
  };

  const totalQuoted = items.reduce((sum, item) => sum + item.requestedWeightKg * item.pricePerKg, 0);

  // Credit Calculations
  const creditLimit = selectedCustomer?.creditLimitUSD || 0;
  const outstandingBalance = selectedCustomer?.outstandingBalanceUSD || 0;
  const availableCredit = Math.max(0, creditLimit - outstandingBalance);
  const remainingCreditAfterOrder = availableCredit - totalQuoted;
  const isOverCreditLimit = totalQuoted > availableCredit;
  const isCreditHold = selectedCustomer?.status === 'Credit Hold';
  const creditUtilizationPct = creditLimit > 0 ? Math.min(100, Math.round((outstandingBalance / creditLimit) * 100)) : 0;
  const projectedUtilizationPct = creditLimit > 0 
    ? Math.min(100, Math.round(((outstandingBalance + totalQuoted) / creditLimit) * 100)) 
    : 0;

  // Compute payment due date based on payment terms
  const calculateDueDate = (terms: PaymentTerms): string => {
    const d = new Date();
    if (terms === 'Net-15') d.setDate(d.getDate() + 15);
    else if (terms === 'Net-30') d.setDate(d.getDate() + 30);
    else if (terms === 'Net-60' as any) d.setDate(d.getDate() + 60);
    else d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (items.length === 0) {
      setValidationError('Please add at least one line item to the order.');
      return;
    }

    if (!clientName.trim()) {
      setValidationError('Please enter or select a client business name.');
      return;
    }

    // Safeguards for Credit Sales
    if (saleType === 'Credit Sale (On Account)') {
      if (isCreditHold && !creditOverrideConfirmed) {
        setValidationError(
          `Customer ${selectedCustomer?.name} is on CREDIT HOLD. A manager credit override is required to authorize this credit sale.`
        );
        return;
      }

      if (isOverCreditLimit && !creditOverrideConfirmed) {
        setValidationError(
          `Order total (${formatCurrency(totalQuoted)}) exceeds available credit limit (${formatCurrency(availableCredit)}). Manager override required.`
        );
        return;
      }
    }

    const orderId = `ORD-${Math.floor(8000 + Math.random() * 1999)}`;
    const dueDate = calculateDueDate(creditTerms);

    let paymentStatus: ClientOrder['paymentStatus'] = 'Pending Net-30';
    if (saleType === 'Immediate Settlement / COD') {
      paymentStatus = 'Paid';
    } else {
      if (creditTerms === 'Net-15') paymentStatus = 'Pending Net-15';
      else if (creditTerms === 'Net-30') paymentStatus = 'Pending Net-30';
      else if (creditTerms === ('Net-60' as any)) paymentStatus = 'Pending Net-60';
      else paymentStatus = 'Invoiced';
    }

    const newOrder: ClientOrder = {
      id: orderId,
      customerId: selectedCustomer?.id,
      clientName: clientName.trim(),
      clientCategory,
      contactPerson,
      contactEmail,
      contactPhone,
      destinationCity,
      deliveryAddress,
      orderDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      requiredDeliveryDate,
      status: 'Pending Confirmation',
      items,
      quotedTotalUSD: totalQuoted,
      adjustedTotalUSD: totalQuoted,
      saleType: saleType === 'Credit Sale (On Account)' ? 'Credit Sale (On Account)' : 'Immediate Settlement',
      paymentTerms: creditTerms,
      paymentDueDate: dueDate,
      creditAuthorizedBy: creditOverrideConfirmed ? creditOverrideApprover : undefined,
      creditOverrideNote: creditOverrideConfirmed ? creditOverrideReason : undefined,
      paymentStatus,
      packagingRequirement: packaging,
      specialInstructions,
      packingSlipGenerated: false
    };

    onAddOrder(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              Wholesale B2B Catch Order & Credit Facility
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
            Create Client Seafood Order
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Enables dynamic catch-weight fulfillment, customer credit verification, cold-chain routing, and invoice dispatch.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 text-xs text-slate-700">
          {/* Validation Alert */}
          {validationError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold">{validationError}</div>
            </div>
          )}

          {/* Customer Account Selection */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Select Customer Account (CRM Directory)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId('')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    !selectedCustomerId ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Custom / Non-Directory Client
                </button>
              </div>
            </div>

            {customers.length > 0 && (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Choose from Registered Customer Directory --</option>
                {customers.map((c) => {
                  const avail = Math.max(0, c.creditLimitUSD - c.outstandingBalanceUSD);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.companyName}) — Limit: {formatCurrency(c.creditLimitUSD)} | Avail: {formatCurrency(avail)} | Status: {c.status}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Live Customer Credit Facility Breakdown */}
            {selectedCustomer && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Account Status</div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        selectedCustomer.status === 'Active' ? 'bg-emerald-500' : selectedCustomer.status === 'Credit Hold' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} />
                      <span className={`font-bold text-xs ${
                        selectedCustomer.status === 'Active' ? 'text-emerald-700' : selectedCustomer.status === 'Credit Hold' ? 'text-rose-700' : 'text-amber-700'
                      }`}>
                        {selectedCustomer.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Approved Credit Limit</div>
                    <div className="font-mono-code font-bold text-xs text-slate-900 mt-0.5">
                      {formatCurrency(selectedCustomer.creditLimitUSD)}
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Current Balance Due</div>
                    <div className="font-mono-code font-bold text-xs text-amber-700 mt-0.5">
                      {formatCurrency(selectedCustomer.outstandingBalanceUSD)}
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Available Credit</div>
                    <div className={`font-mono-code font-bold text-xs mt-0.5 ${
                      availableCredit >= totalQuoted ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {formatCurrency(availableCredit)}
                    </div>
                  </div>
                </div>

                {/* Credit Utilization Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Credit Utilization: <strong>{creditUtilizationPct}% used</strong></span>
                    {totalQuoted > 0 && (
                      <span className={isOverCreditLimit ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                        Projected: <strong>{projectedUtilizationPct}%</strong> ({formatCurrency(remainingCreditAfterOrder)} left)
                      </span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full ${creditUtilizationPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, creditUtilizationPct)}%` }}
                    />
                    {totalQuoted > 0 && (
                      <div 
                        className={`h-full ${isOverCreditLimit ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(100 - creditUtilizationPct, Math.max(0, projectedUtilizationPct - creditUtilizationPct))}%` }}
                      />
                    )}
                  </div>
                </div>

                {/* Credit Hold Warning Banner */}
                {isCreditHold && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">CREDIT HOLD ACTIVE: </span>
                      This client has overdue unpaid invoices or is under credit review. Orders cannot be billed on credit without manager authorization.
                    </div>
                  </div>
                )}

                {/* Credit Over-Limit Warning */}
                {!isCreditHold && isOverCreditLimit && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">CREDIT LIMIT EXCEEDED: </span>
                      Order total ({formatCurrency(totalQuoted)}) exceeds available credit limit by {formatCurrency(totalQuoted - availableCredit)}.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Billing Mode & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Billing & Settlement Type</label>
              <select
                value={saleType}
                onChange={(e) => setSaleType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Credit Sale (On Account)">Credit Sale (Charge to Customer Account)</option>
                <option value="Immediate Settlement / COD">Immediate Settlement / Cash on Delivery</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
              <select
                value={creditTerms}
                onChange={(e) => setCreditTerms(e.target.value as PaymentTerms)}
                disabled={saleType !== 'Credit Sale (On Account)'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              >
                <option value="Net-30">Net-30 (Standard Commercial)</option>
                <option value="Net-15">Net-15 (Accelerated Wholesale)</option>
                <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                <option value="Prepaid / Due on Receipt">Prepaid / Due on Receipt</option>
              </select>
            </div>
          </div>

          {/* Manager Credit Override Section if Hold or Over Limit */}
          {saleType === 'Credit Sale (On Account)' && (isCreditHold || isOverCreditLimit) && (
            <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-300 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="credit-override-checkbox"
                  checked={creditOverrideConfirmed}
                  onChange={(e) => setCreditOverrideConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="credit-override-checkbox" className="font-bold text-amber-950 text-xs cursor-pointer">
                  Authorize Manager Credit Override for this Order
                </label>
              </div>

              {creditOverrideConfirmed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/80">
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Approving Manager Name</label>
                    <input
                      type="text"
                      value={creditOverrideApprover}
                      onChange={(e) => setCreditOverrideApprover(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-1">Override Justification / Reason</label>
                    <input
                      type="text"
                      value={creditOverrideReason}
                      onChange={(e) => setCreditOverrideReason(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Client Business Name</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Client Category</label>
              <select
                value={clientCategory}
                onChange={(e) => setClientCategory(e.target.value as ClientOrder['clientCategory'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Michelin Restaurant">Michelin Restaurant</option>
                <option value="Luxury Hotel Group">Luxury Hotel Group</option>
                <option value="Seafood Wholesaler">Seafood Wholesaler</option>
                <option value="Supermarket Chain">Supermarket Chain</option>
                <option value="Gourmet Fishmonger">Gourmet Fishmonger</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 (415) 555-..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="purchasing@restaurant.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Required Delivery Window</label>
              <input
                type="date"
                required
                value={requiredDeliveryDate}
                onChange={(e) => setRequiredDeliveryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Delivery Address & Loading Dock</label>
              <input
                type="text"
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Line Items Selection */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-600" />
                Select Allocated Inventory Batches & Target Yield
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Line
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Select Inventory Lot
                    </label>
                    <select
                      value={item.lotId}
                      onChange={(e) => handleItemLotChange(idx, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-900"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.speciesName} ({b.grade}) — {b.id} [{formatWeight(b.availableWeightKg, useImperial)} avail]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Target Weight ({useImperial ? 'lbs' : 'kg'})
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={item.requestedWeightKg}
                      onChange={(e) => handleItemWeightChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900 font-mono-code"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Est. Quoted
                    </label>
                    <div className="p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-indigo-700 font-mono-code">
                      {formatCurrency(item.requestedWeightKg * item.pricePerKg)}
                    </div>
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Packaging & Special Logistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Packaging Specification</label>
              <select
                value={packaging}
                onChange={(e) => setPackaging(e.target.value as ClientOrder['packagingRequirement'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Dry Ice & Insulated Wax Carton">Dry Ice & Insulated Wax Carton (Super-Cryo)</option>
                <option value="Slush Ice Gel Packed">Slush Ice Gel Packed (Fresh Catch)</option>
                <option value="Live Oxygenated Tank Container">Live Oxygenated Tank Container</option>
                <option value="Standard Cryo-Box">Standard Cryo-Box</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Special Handling Instructions</label>
              <input
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Temperature data logger printout requested at drop-off."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Total Quoted & Credit Order Summary Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs text-indigo-950">
              <div className="font-bold flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>
                  {saleType === 'Credit Sale (On Account)' 
                    ? `Credit Sale • Terms: ${creditTerms} (Due ${calculateDueDate(creditTerms)})`
                    : 'Immediate Settlement / Cash on Delivery'}
                </span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Final commercial invoice will reflect certified scale catch-weight upon dispatch.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-indigo-700">Total Order Quoted</div>
              <div className="text-xl font-extrabold text-indigo-900 font-mono-code">
                {formatCurrency(totalQuoted)}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saleType === 'Credit Sale (On Account)' && (isCreditHold || isOverCreditLimit) && !creditOverrideConfirmed}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold shadow-md shadow-indigo-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Confirm & Issue Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
