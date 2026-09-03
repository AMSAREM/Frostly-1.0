import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Truck, 
  ShoppingBag, 
  Layers, 
  DollarSign, 
  Sparkles,
  Package
} from 'lucide-react';
import { ClientOrder, OrderLineItem, InventoryBatch, QualityGrade } from '../../types';
import { SPECIES_CATALOG } from '../../data/mockData';
import { formatCurrency, formatWeight } from '../../utils/formatters';

interface NewOrderModalProps {
  batches: InventoryBatch[];
  onClose: () => void;
  onAddOrder: (order: ClientOrder) => void;
  useImperial: boolean;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  batches,
  onClose,
  onAddOrder,
  useImperial
}) => {
  const [clientName, setClientName] = useState('Sushi Yoshizumi (1 Michelin Star)');
  const [clientCategory, setClientCategory] = useState<ClientOrder['clientCategory']>('Michelin Restaurant');
  const [contactPerson, setContactPerson] = useState('Head Chef Akira Yoshizumi');
  const [contactEmail, setContactEmail] = useState('orders@yoshizumi.com');
  const [contactPhone, setContactPhone] = useState('+1 (650) 884-9021');
  const [destinationCity, setDestinationCity] = useState('San Mateo, CA');
  const [deliveryAddress, setDeliveryAddress] = useState('325 E 4th Ave, San Mateo, CA 94401');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState('2026-08-21 07:00');
  const [packaging, setPackaging] = useState<ClientOrder['packagingRequirement']>('Dry Ice & Insulated Wax Carton');
  const [specialInstructions, setSpecialInstructions] = useState('Pre-chill container to -50°C. Chef inspects loin upon dock arrival.');

  // Order Items
  const [items, setItems] = useState<OrderLineItem[]>([
    {
      id: 'item-' + Date.now(),
      speciesId: batches[0]?.speciesId || 'spec-bluefin',
      speciesName: batches[0]?.speciesName || 'Pacific Bluefin Tuna (Hon-Maguro)',
      grade: batches[0]?.grade || 'Sashimi AAA',
      lotId: batches[0]?.id || 'LOT-2026-BFT-0982',
      requestedWeightKg: 12.0,
      actualWeighedKg: null,
      pricePerKg: batches[0]?.wholesalePricePerKg || 118.00,
      notes: 'Center cut loin'
    }
  ]);

  const handleAddItem = () => {
    const defaultBatch = batches[0];
    setItems([
      ...items,
      {
        id: 'item-' + Date.now() + Math.random(),
        speciesId: defaultBatch?.speciesId || 'spec-salmon',
        speciesName: defaultBatch?.speciesName || 'Wild King & Atlantic Salmon (Icy Fjord)',
        grade: defaultBatch?.grade || 'Grade #1',
        lotId: defaultBatch?.id || 'LOT-2026-SAL-1104',
        requestedWeightKg: 10.0,
        actualWeighedKg: null,
        pricePerKg: defaultBatch?.wholesalePricePerKg || 25.50,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const orderId = `ORD-${Math.floor(8000 + Math.random() * 1999)}`;
    const newOrder: ClientOrder = {
      id: orderId,
      clientName,
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
      paymentStatus: 'Pending Net-30',
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
              Wholesale B2B Catch Order
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
            Create Client Seafood Order
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Enables dynamic catch-weight fulfillment, cold-chain route reservation, and invoice dispatch.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 text-xs text-slate-700">
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
              <label className="block font-semibold text-slate-700 mb-1">Contact Person & Phone</label>
              <input
                type="text"
                required
                value={`${contactPerson} (${contactPhone})`}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Required Delivery Window</label>
              <input
                type="text"
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

          {/* Total Quoted Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
            <div className="text-xs text-indigo-950">
              <span className="font-bold">Dynamic Catch-Weight Billing Note: </span>
              Final invoice will automatically adjust by weighed yield grams upon dock packaging.
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-indigo-700">Estimated Total Quoted</div>
              <div className="text-lg font-extrabold text-indigo-900 font-mono-code">
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold shadow-md shadow-indigo-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Wholesale Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
