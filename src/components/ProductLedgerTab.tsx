import React, { useState, useMemo } from 'react';
import { 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  Search, 
  Printer, 
  Download, 
  Filter, 
  Calendar, 
  DollarSign, 
  Scale, 
  ShieldCheck, 
  Layers, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  TrendingUp,
  FileText,
  ShoppingBag,
  Truck,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { 
  RetailWholesaleProduct, 
  InventoryBatch, 
  RetailTransaction, 
  ClientOrder, 
  InventoryStockAdjustment, 
  PurchaseOrderLanding,
  ProductLedgerEntry
} from '../types';
import { buildProductLedger } from '../utils/productLedger';
import { formatWeight } from '../utils/formatters';

interface ProductLedgerTabProps {
  products: RetailWholesaleProduct[];
  selectedProductId?: string;
  onSelectProduct?: (productId: string) => void;
  batches?: InventoryBatch[];
  retailSales?: RetailTransaction[];
  wholesaleOrders?: ClientOrder[];
  stockAdjustments?: InventoryStockAdjustment[];
  purchaseOrders?: PurchaseOrderLanding[];
  formatCurrency: (amount: number) => string;
  useImperial?: boolean;
  onOpenInvoice?: (order: ClientOrder) => void;
  onOpenReceipt?: (sale: RetailTransaction) => void;
}

export const ProductLedgerTab: React.FC<ProductLedgerTabProps> = ({
  products = [],
  selectedProductId,
  onSelectProduct,
  batches = [],
  retailSales = [],
  wholesaleOrders = [],
  stockAdjustments = [],
  purchaseOrders = [],
  formatCurrency,
  useImperial = false,
  onOpenInvoice,
  onOpenReceipt
}) => {
  const [activeProductId, setActiveProductId] = useState<string>(() => {
    if (selectedProductId) return selectedProductId;
    if (products.length > 0) return products[0].id;
    return '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<'all' | 'inflow' | 'outflow' | 'pos' | 'wholesale' | 'adjustments'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Sync if selectedProductId prop changes
  React.useEffect(() => {
    if (selectedProductId) {
      setActiveProductId(selectedProductId);
    }
  }, [selectedProductId]);

  const activeProduct = useMemo(() => {
    return products.find(p => p.id === activeProductId) || products[0];
  }, [products, activeProductId]);

  // Build ledger for the currently selected product
  const { entries, summary } = useMemo(() => {
    if (!activeProduct) {
      return {
        entries: [],
        summary: {
          productId: '',
          productName: 'No Product Selected',
          productSku: '',
          unit: 'kg',
          currentStock: 0,
          currentValuation: 0,
          totalInwardStock: 0,
          totalOutwardStock: 0,
          retailSalesQty: 0,
          retailSalesRevenue: 0,
          wholesaleSalesQty: 0,
          wholesaleSalesRevenue: 0,
          totalRevenue: 0,
          totalCogs: 0,
          grossMarginUSD: 0,
          grossMarginPct: 0,
          netAdjustmentQty: 0,
          movementsCount: 0
        }
      };
    }
    return buildProductLedger(
      activeProduct,
      batches,
      retailSales,
      wholesaleOrders,
      stockAdjustments,
      purchaseOrders
    );
  }, [activeProduct, batches, retailSales, wholesaleOrders, stockAdjustments, purchaseOrders]);

  // Filtered movements
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      // Movement filter
      if (movementFilter === 'inflow' && e.quantityIn <= 0) return false;
      if (movementFilter === 'outflow' && e.quantityOut <= 0) return false;
      if (movementFilter === 'pos' && e.channel !== 'Retail POS') return false;
      if (movementFilter === 'wholesale' && e.channel !== 'Wholesale B2B') return false;
      if (movementFilter === 'adjustments' && e.channel !== 'Cold Vault Audit') return false;

      // Channel filter
      if (channelFilter !== 'all' && e.channel !== channelFilter) return false;

      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesRef = e.referenceId.toLowerCase().includes(q);
        const matchesDesc = e.description.toLowerCase().includes(q);
        const matchesBy = (e.performedBy || '').toLowerCase().includes(q);
        const matchesLot = (e.batchLotId || '').toLowerCase().includes(q);
        const matchesNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchesRef && !matchesDesc && !matchesBy && !matchesLot && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [entries, movementFilter, channelFilter, searchQuery]);

  // Export CSV Statement
  const handleExportCSV = () => {
    if (!activeProduct || entries.length === 0) return;
    const headers = [
      'Date',
      'Movement Type',
      'Channel',
      'Reference ID',
      'Description',
      'Quantity In (' + activeProduct.unit + ')',
      'Quantity Out (' + activeProduct.unit + ')',
      'Net Change (' + activeProduct.unit + ')',
      'Running Balance (' + activeProduct.unit + ')',
      'Unit Cost',
      'Unit Price',
      'Valuation Total',
      'Revenue Realized',
      'Performed By',
      'Lot ID'
    ];

    const rows = entries.map(e => [
      e.date,
      `"${e.movementType}"`,
      `"${e.channel}"`,
      `"${e.referenceId}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      e.quantityIn.toFixed(2),
      e.quantityOut.toFixed(2),
      e.netChange.toFixed(2),
      e.runningBalance.toFixed(2),
      e.unitCost.toFixed(2),
      (e.unitPrice ?? 0).toFixed(2),
      e.totalValuationUSD.toFixed(2),
      (e.revenueUSD ?? 0).toFixed(2),
      `"${e.performedBy || ''}"`,
      `"${e.batchLotId || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Product_Ledger_${activeProduct.sku || activeProduct.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Product Selection & Master Details Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Perpetual Inventory Stock Card
                </span>
                <span className="text-xs text-slate-400 font-mono-code">{activeProduct?.sku}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                Product Stock Movement & Cost Ledger
              </h2>
              <p className="text-xs text-slate-500">
                Audit every inward catch landing, retail POS sale, B2B wholesale order, and vault calibration with real-time running balance.
              </p>
            </div>
          </div>

          {/* Product Dropdown Selector */}
          <div className="w-full lg:w-80 shrink-0">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Select Seafood Product / SKU
            </label>
            <div className="relative">
              <select
                value={activeProductId}
                onChange={(e) => {
                  setActiveProductId(e.target.value);
                  if (onSelectProduct) onSelectProduct(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 appearance-none cursor-pointer pr-10"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — {p.stockKg} {p.unit} in stock
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Selected Product Overview Banner */}
        {activeProduct && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              {activeProduct.imageUrl ? (
                <img 
                  src={activeProduct.imageUrl} 
                  alt={activeProduct.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span>{activeProduct.name}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {activeProduct.grade}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>Cut: <strong>{activeProduct.cutType}</strong></span>
                  <span>•</span>
                  <span>Zone: <strong>{activeProduct.storageZone || 'Commercial Cold Storage'}</strong></span>
                  <span>•</span>
                  <span>Origin: <strong>{activeProduct.origin || 'San Francisco Berth'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-slate-700 font-mono-code text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Cost Unit</span>
                <span className="font-bold text-slate-800">{formatCurrency(activeProduct.costPricePerUnit)}/{activeProduct.unit}</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Wholesale Rate</span>
                <span className="font-bold text-indigo-700">{formatCurrency(activeProduct.wholesalePricePerUnit)}/{activeProduct.unit}</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Retail Counter</span>
                <span className="font-bold text-emerald-700">{formatCurrency(activeProduct.retailPricePerUnit)}/{activeProduct.unit}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Current Stock On Hand */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stock on Hand</span>
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <Scale className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono-code text-slate-900">
            {formatWeight(summary.currentStock, useImperial)}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Asset Valuation:</span>
            <span className="font-mono-code font-bold text-slate-700">{formatCurrency(summary.currentValuation)}</span>
          </div>
        </div>

        {/* Total Inward Catch Landings */}
        <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Total Inward Intake</span>
            <span className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono-code text-sky-950">
            {formatWeight(summary.totalInwardStock, useImperial)}
          </div>
          <div className="text-[11px] text-sky-700">
            Landings, POs & intake adjustments
          </div>
        </div>

        {/* Total Outflow Dispatched */}
        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Total Sales Outflow</span>
            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono-code text-indigo-950">
            {formatWeight(summary.totalOutwardStock, useImperial)}
          </div>
          <div className="text-[11px] text-indigo-700 flex items-center justify-between">
            <span>POS: {formatWeight(summary.retailSalesQty, useImperial)}</span>
            <span>•</span>
            <span>B2B: {formatWeight(summary.wholesaleSalesQty, useImperial)}</span>
          </div>
        </div>

        {/* Realized Revenue & Gross Margin */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Realized Gross Margin</span>
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black font-mono-code text-emerald-950">
            {summary.grossMarginPct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-emerald-700 flex items-center justify-between">
            <span>Revenue: {formatCurrency(summary.totalRevenue)}</span>
            <span className="font-mono-code font-bold text-emerald-800">+{formatCurrency(summary.grossMarginUSD)}</span>
          </div>
        </div>
      </div>

      {/* Movements Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ref #, description, lot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {[
              { id: 'all', label: `All (${entries.length})` },
              { id: 'inflow', label: 'Inward (+)' },
              { id: 'outflow', label: 'Outward (-)' },
              { id: 'pos', label: 'Retail POS' },
              { id: 'wholesale', label: 'Wholesale B2B' },
              { id: 'adjustments', label: 'Audits / Variances' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setMovementFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  movementFilter === f.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Card</span>
            </button>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 font-bold">Date & Ref</th>
                <th className="py-3 px-3 font-bold">Movement Type</th>
                <th className="py-3 px-3 font-bold">Channel</th>
                <th className="py-3 px-4 font-bold">Transaction Description</th>
                <th className="py-3 px-3 font-bold text-right text-sky-800">Inward (+)</th>
                <th className="py-3 px-3 font-bold text-right text-indigo-800">Outward (-)</th>
                <th className="py-3 px-3 font-bold text-right text-slate-900">Running Balance</th>
                <th className="py-3 px-3 font-bold text-right">Valuation / Rev</th>
                <th className="py-3 px-4 font-bold">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    No product ledger movements match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(e => {
                  const isInflow = e.quantityIn > 0;
                  const isOutflow = e.quantityOut > 0;

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date & Ref */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{e.date}</div>
                        <div className="font-mono-code text-[11px] text-indigo-600 font-semibold">{e.referenceId}</div>
                      </td>

                      {/* Movement Type */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          e.movementType === 'Vessel Catch Intake' || e.movementType === 'Opening Stock / Intake'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : e.movementType === 'Retail POS Sale'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : e.movementType === 'Wholesale Order Fulfillment'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : e.movementType === 'Stock Calibration Recovery'
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {isInflow && <ArrowDownLeft className="w-3 h-3 text-sky-600" />}
                          {isOutflow && <ArrowUpRight className="w-3 h-3 text-indigo-600" />}
                          <span>{e.movementType}</span>
                        </span>
                      </td>

                      {/* Channel */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          e.channel === 'Retail POS'
                            ? 'bg-emerald-100 text-emerald-900'
                            : e.channel === 'Wholesale B2B'
                            ? 'bg-indigo-100 text-indigo-900'
                            : e.channel === 'Catch Landings'
                            ? 'bg-sky-100 text-sky-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {e.channel}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-slate-900 font-medium leading-snug line-clamp-2">
                          {e.description}
                        </div>
                        {e.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic">
                            {e.notes}
                          </div>
                        )}
                        {e.batchLotId && (
                          <span className="font-mono-code text-[9px] text-slate-400">
                            Lot: {e.batchLotId}
                          </span>
                        )}
                      </td>

                      {/* Quantity In */}
                      <td className="py-3.5 px-3 text-right font-mono-code font-bold">
                        {e.quantityIn > 0 ? (
                          <span className="text-sky-700">+{e.quantityIn.toFixed(2)} {e.unit}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Quantity Out */}
                      <td className="py-3.5 px-3 text-right font-mono-code font-bold">
                        {e.quantityOut > 0 ? (
                          <span className="text-rose-600">-{e.quantityOut.toFixed(2)} {e.unit}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Running Balance */}
                      <td className="py-3.5 px-3 text-right font-mono-code font-black text-slate-900 whitespace-nowrap">
                        <div className="text-xs">{e.runningBalance.toFixed(2)} {e.unit}</div>
                      </td>

                      {/* Valuation / Revenue */}
                      <td className="py-3.5 px-3 text-right font-mono-code whitespace-nowrap">
                        {e.revenueUSD && e.revenueUSD > 0 ? (
                          <div>
                            <span className="font-bold text-emerald-700">{formatCurrency(e.revenueUSD)}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              Cost: {formatCurrency(e.totalValuationUSD)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-700">{formatCurrency(e.totalValuationUSD)}</span>
                        )}
                      </td>

                      {/* Performed By */}
                      <td className="py-3.5 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                        <div className="font-medium text-slate-800">{e.performedBy || 'System Operation'}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
