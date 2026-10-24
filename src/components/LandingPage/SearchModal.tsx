import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, Check } from 'lucide-react';
import { FEATURED_PRODUCTS, COOL_TREATS_PRODUCTS, AmansoceanProduct, CURRENCY } from '../../data/amansoceanProducts';
import { useCart } from '../../context/CartContext';
import { trackStorefrontEvent } from '../../services/storefrontService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: AmansoceanProduct[];
  onSelectProduct?: (product: AmansoceanProduct) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToCart } = useCart();
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen || trimmed.length < 2) return;
    const timer = setTimeout(() => {
      trackStorefrontEvent('product_search', {
        metadata: { query: trimmed },
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const allProducts =
    products && products.length > 0
      ? products
      : [...FEATURED_PRODUCTS, ...COOL_TREATS_PRODUCTS];

  const results = query.trim()
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : allProducts.slice(0, 5);

  const handleAdd = (product: AmansoceanProduct) => {
    if (product.inStock === false || (typeof product.stockKg === 'number' && product.stockKg <= 0)) {
      return;
    }
    addToCart(product, 1);
    setAddedIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [product.id]: false }));
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#FBF3E4] rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-amber-300 overflow-hidden animate-fade-in-up">
        
        {/* Search Input Bar */}
        <div className="p-4 bg-[#FFC400] flex items-center gap-3 border-b border-amber-300">
          <Search className="w-5 h-5 text-neutral-800 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search red snapper, jumbo prawns, grouper fillet, fish powder..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base sm:text-lg font-bold text-[#1A1A1A] placeholder-neutral-700 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-neutral-700 hover:text-black"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#C8102E] text-white rounded-full font-bold text-xs hover:bg-[#9B0B20] transition-colors shrink-0"
          >
            Close
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          <div className="text-xs font-bold text-neutral-600 px-1 tabular-nums">
            {query.trim() ? `Search Results (${results.length})` : 'Popular Coldstore Picks'}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              No matching seafood items found. Try &quot;snapper&quot;, &quot;prawns&quot;, &quot;grouper&quot;, or &quot;powder&quot;.
            </div>
          ) : (
            results.map((product) => {
              const isAdded = !!addedIds[product.id];
              const isOutOfStock =
                product.inStock === false ||
                (typeof product.stockKg === 'number' && product.stockKg <= 0);
              return (
                <div
                  key={product.id}
                  className="bg-white p-3 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-shadow"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-amber-50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#C8102E]">
                      <span>{product.category}</span>
                      {typeof product.stockKg === 'number' && (
                        <>
                          <span aria-hidden="true" className="text-neutral-400">·</span>
                          <span className="tabular-nums text-neutral-500">
                            {isOutOfStock ? 'Sold out' : `${Math.floor(product.stockKg)} in stock`}
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-[#1A1A1A] truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-neutral-600 font-bold font-mono tabular-nums">
                      {CURRENCY} {product.price.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdd(product)}
                    disabled={isOutOfStock}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1 shadow-xs shrink-0 whitespace-nowrap ${
                      isOutOfStock
                        ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                        : isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#FFC400] text-[#1A1A1A] hover:bg-amber-300 cursor-pointer'
                    }`}
                  >
                    {isOutOfStock ? (
                      <span>Sold Out</span>
                    ) : isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
