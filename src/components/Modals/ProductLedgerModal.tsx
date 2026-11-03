import React from 'react';
import { X, Package, Printer, Download, ExternalLink } from 'lucide-react';
import { 
  RetailWholesaleProduct, 
  InventoryBatch, 
  RetailTransaction, 
  ClientOrder, 
  InventoryStockAdjustment, 
  PurchaseOrderLanding 
} from '../../types';
import { ProductLedgerTab } from '../ProductLedgerTab';

interface ProductLedgerModalProps {
  product: RetailWholesaleProduct | null;
  products: RetailWholesaleProduct[];
  batches?: InventoryBatch[];
  retailSales?: RetailTransaction[];
  wholesaleOrders?: ClientOrder[];
  stockAdjustments?: InventoryStockAdjustment[];
  purchaseOrders?: PurchaseOrderLanding[];
  formatCurrency: (amount: number) => string;
  useImperial?: boolean;
  onClose: () => void;
  onSelectProduct?: (productId: string) => void;
}

export const ProductLedgerModal: React.FC<ProductLedgerModalProps> = ({
  product,
  products,
  batches = [],
  retailSales = [],
  wholesaleOrders = [],
  stockAdjustments = [],
  purchaseOrders = [],
  formatCurrency,
  useImperial = false,
  onClose,
  onSelectProduct
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-100 w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  {product.name}
                </h2>
                <span className="font-mono text-indigo-400 text-xs px-2 py-0.5 rounded bg-white/10 font-bold">
                  {product.sku}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {product.grade}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Perpetual Stock Movement & Cost Ledger Statement
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <ProductLedgerTab
            products={products}
            selectedProductId={product.id}
            onSelectProduct={onSelectProduct}
            batches={batches}
            retailSales={retailSales}
            wholesaleOrders={wholesaleOrders}
            stockAdjustments={stockAdjustments}
            purchaseOrders={purchaseOrders}
            formatCurrency={formatCurrency}
            useImperial={useImperial}
          />
        </div>
      </div>
    </div>
  );
};
