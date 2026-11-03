import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  DollarSign, 
  Scale, 
  Package, 
  Truck, 
  Calendar, 
  Building2, 
  Check, 
  AlertCircle,
  FileText,
  Calculator
} from 'lucide-react';
import { ClientOrder, OrderLineItem, InventoryBatch, Customer, OrderStatus, PaymentStatus } from '../../types';
import { formatCurrency, formatWeight } from '../../utils/formatters';

interface EditOrderModalProps {
  order: ClientOrder;
  batches: InventoryBatch[];
  customers?: Customer[];
  onClose: () => void;
  onSaveOrder: (updatedOrder: ClientOrder) => Promise<void> | void;
  useImperial: boolean;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  batches = [],
  customers = [],
  onClose,
  onSaveOrder,
  useImperial
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(order.customerId || '');
  const [clientName, setClientName] = useState(order.clientName || '');
  const [clientCategory, setClientCategory] = useState<ClientOrder['clientCategory']>(order.clientCategory);
  const [contactPerson, setContactPerson] = useState(order.contactPerson || '');
  const [contactEmail, setContactEmail] = useState(order.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(order.contactPhone || '');
  const [destinationCity, setDestinationCity] = useState(order.destinationCity || '');
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress || '');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState(order.requiredDeliveryDate || '');
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order.paymentStatus as PaymentStatus);
  const [packaging, setPackaging] = useState<ClientOrder['packagingRequirement']>(order.packagingRequirement);
  const [specialInstructions, setSpecialInstructions] = useState(order.specialInstructions || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Line items state
  const [items, setItems] = useState<OrderLineItem[]>(() => {
    return order.items && order.items.length > 0
      ? order.items.map(item => ({ ...item }))
      : [];
  });

  // Calculate live dynamic quote total
  const liveQuotedTotal = items.reduce((sum, item) => {
    const qty = Number(item.requestedWeightKg) || 0;
    const rate = Number(item.pricePerKg) || 0;
    return sum + (qty * rate);
  }, 0);

  const totalWeightKg = items.reduce((sum, item) => sum + (Number(item.requestedWeightKg) || 0), 0);

  // If customer selection changes, sync contact & address
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const cust = customers.find(c => c.id === customerId);
    if (cust) {
      setClientName(cust.companyName || cust.name);
      setContactPerson(cust.contactPerson || '');
      setContactEmail(cust.email || '');
      setContactPhone(cust.phone || '');
      setDestinationCity(cust.city || '');
      setDeliveryAddress(cust.address || '');
    }
  };

  const handleAddItem = () => {
    const defaultBatch = batches[0];
    const newItem: OrderLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      speciesId: defaultBatch?.speciesId || 'spec-landed',
      speciesName: defaultBatch?.speciesName || 'Fresh Seafood Catch',
      grade: defaultBatch?.grade || 'Grade #1',
      lotId: defaultBatch?.id || 'LOT-GENERAL',
      requestedWeightKg: 10,
      actualWeighedKg: null,
      pricePerKg: defaultBatch?.wholesalePricePerKg || 65,
      notes: ''
    };
    setItems([...items, newItem]);
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
      pricePerKg: batch.wholesalePricePerKg || updated[index].pricePerKg
    };
    setItems(updated);
  };

  const handleItemWeightChange = (index: number, val: string) => {
    const num = parseFloat(val);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      requestedWeightKg: isNaN(num) ? 0 : Math.max(0, num)
    };
    setItems(updated);
  };

  const handleItemPriceChange = (index: number, val: string) => {
    const num = parseFloat(val);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      pricePerKg: isNaN(num) ? 0 : Math.max(0, num)
    };
    setItems(updated);
  };

  const handleItemNotesChange = (index: number, val: string) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      notes: val
    };
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (items.length === 0) {
      setValidationError('An order must have at least one line item.');
      return;
    }

    if (!clientName.trim()) {
      setValidationError('Please specify the customer or client business name.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate adjusted total if actual weighed weights exist, otherwise maintain quoted
      const hasWeighedItems = items.some(i => i.actualWeighedKg !== null && i.actualWeighedKg !== undefined);
      const calculatedAdjusted = hasWeighedItems
        ? items.reduce((sum, item) => sum + ((item.actualWeighedKg ?? item.requestedWeightKg) * item.pricePerKg), 0)
        : liveQuotedTotal;

      const updatedOrder: ClientOrder = {
        ...order,
        customerId: selectedCustomerId || order.customerId,
        clientName: clientName.trim(),
        clientCategory,
        contactPerson: contactPerson.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        destinationCity: destinationCity.trim(),
        deliveryAddress: deliveryAddress.trim(),
        requiredDeliveryDate,
        status,
        paymentStatus,
        packagingRequirement: packaging,
        specialInstructions: specialInstructions.trim() || undefined,
        items,
        quotedTotalUSD: liveQuotedTotal,
        adjustedTotalUSD: calculatedAdjusted
      };

      await onSaveOrder(updatedOrder);
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to save changes to order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Modify Wholesale Order</span>
                <span className="font-mono text-indigo-400 text-xs px-2 py-0.5 rounded bg-white/10">
                  {order.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Update client account details, line items, and estimated quote value.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Customer & Account Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Customer Account & Destination</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Customer Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Registered Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">Custom / One-time Client</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Business / Trading Name *
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="e.g. Olives Restaurant"
                />
              </div>

              {/* Client Category */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Client Sector
                </label>
                <select
                  value={clientCategory}
                  onChange={(e) => setClientCategory(e.target.value as any)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="Michelin Restaurant">Michelin Restaurant</option>
                  <option value="Luxury Hotel Group">Luxury Hotel Group</option>
                  <option value="Supermarket Chain">Supermarket Chain</option>
                  <option value="Gourmet Fishmonger">Gourmet Fishmonger</option>
                  <option value="Wholesale Distributor">Wholesale Distributor</option>
                  <option value="Catering Service">Catering Service</option>
                </select>
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Purchasing Chef / Manager"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="0551187045"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="orders@business.com"
                />
              </div>

              {/* Destination City */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Destination City
                </label>
                <input
                  type="text"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Kumasi, Accra, Tema..."
                />
              </div>

              {/* Delivery Address */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Delivery Address & Berth
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Street address, building, coldstore receiving bay..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Fulfillment & Status Controls */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Schedule & Workflow Status</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Required Delivery Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Required Delivery Date</span>
                </label>
                <input
                  type="date"
                  value={requiredDeliveryDate}
                  onChange={(e) => setRequiredDeliveryDate(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Order Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Fulfillment Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="Pending Confirmation">Pending Confirmation</option>
                  <option value="Weighing & Grading">Weighing & Grading</option>
                  <option value="Cryo-Packed & Iced">Cryo-Packed & Iced</option>
                  <option value="In Reefer Transit">In Reefer Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className={`w-full h-9 border rounded-xl px-3 text-xs font-bold focus:outline-none focus:ring-2 ${
                    paymentStatus === 'Paid in Full' || paymentStatus === 'Paid'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500/20'
                      : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500/20'
                  }`}
                >
                  <option value="Paid in Full">Paid in Full</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending Net-30">Pending Net-30</option>
                  <option value="Pending Net-15">Pending Net-15</option>
                  <option value="Invoiced">Invoiced (Payment Pending)</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Partial Paid">Partial Paid</option>
                  <option value="Pending Settlement">Pending Settlement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Allocated Line Items & Editable Estimated Quotes */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Seafood Line Items & Estimated Quote</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Adjust requested weight and unit prices. Estimated quote total recalculates automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Inventory Batch / Lot</th>
                    <th className="py-2.5 px-2">Grade</th>
                    <th className="py-2.5 px-2 w-28">Weight ({useImperial ? 'lbs' : 'kg'})</th>
                    <th className="py-2.5 px-2 w-32">Rate ({formatCurrency(1).replace(/[\d.,]/g, '').trim()}/{useImperial ? 'lb' : 'kg'})</th>
                    <th className="py-2.5 px-3 text-right">Quoted Total</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item, index) => {
                    const itemTotal = (Number(item.requestedWeightKg) || 0) * (Number(item.pricePerKg) || 0);

                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50/60 transition-colors">
                        {/* Lot / Species Selection */}
                        <td className="py-2 px-3">
                          <select
                            value={item.lotId}
                            onChange={(e) => handleItemLotChange(index, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {batches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.speciesName} ({b.id}) - Avail: {b.availableWeightKg}kg
                              </option>
                            ))}
                            {batches.length === 0 && (
                              <option value={item.lotId}>{item.speciesName} ({item.lotId})</option>
                            )}
                          </select>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleItemNotesChange(index, e.target.value)}
                            placeholder="Optional line notes / specifications..."
                            className="w-full mt-1 bg-transparent border-0 border-b border-dashed border-slate-200 text-[10px] text-slate-500 placeholder-slate-300 focus:outline-none focus:border-indigo-400 py-0.5"
                          />
                        </td>

                        {/* Grade */}
                        <td className="py-2 px-2 text-slate-600 text-[11px] whitespace-nowrap">
                          {item.grade}
                        </td>

                        {/* Requested Weight */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={item.requestedWeightKg}
                            onChange={(e) => handleItemWeightChange(index, e.target.value)}
                            className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                          />
                        </td>

                        {/* Price per Kg */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.pricePerKg}
                            onChange={(e) => handleItemPriceChange(index, e.target.value)}
                            className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                          />
                        </td>

                        {/* Calculated Subtotal */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                          {formatCurrency(itemTotal)}
                        </td>

                        {/* Remove Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Dynamic Total Banner */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                    Calculated Estimated Quote Total
                  </div>
                  <div className="text-xs text-indigo-900">
                    {items.length} line item(s) • Total Weight: <strong className="font-mono">{formatWeight(totalWeightKg, useImperial)}</strong>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">
                  Total Quoted Value
                </span>
                <span className="text-2xl font-black font-mono text-indigo-900">
                  {formatCurrency(liveQuotedTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Order & Update Quote</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
