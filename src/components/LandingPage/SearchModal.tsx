import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, Check, ArrowRight } from 'lucide-react';
import { FEATURED_PRODUCTS, COOL_TREATS_PRODUCTS, AmansoceanProduct, CURRENCY } from '../../data/amansoceanProducts';
import { useCart } from '../../context/CartContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct?: (product: AmansoceanProduct) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
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

  if (!isOpen) return null;

  const allProducts = [...FEATURED_PRODUCTS, ...COOL_TREATS_PRODUCTS];
  const results = query.trim()
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : allProducts.slice(0, 4);

  const handleAdd = (product: AmansoceanProduct) => {
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
          <Search className="w-5 h-5 text-neutral-800" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search prawns, cod fillets, golden fries, gelato..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-base sm:text-lg font-bold text-[#1A1A1A] placeholder-neutral-700 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-neutral-700 hover:text-black"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#C8102E] text-white rounded-full font-bold text-xs hover:bg-[#9B0B20] transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 px-1">
            {query.trim() ? `Search Results (${results.length})` : 'Popular Recommendations'}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              No matching ocean delicacies found. Try "prawns", "fish", or "fries".
            </div>
          ) : (
            results.map((product) => {
              const isAdded = !!addedIds[product.id];
              return (
                <div
                  key={product.id}
                  className="bg-white p-3 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-shadow"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-amber-50"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-[#C8102E] uppercase">
                      {product.category}
                    </span>
                    <h4 className="font-extrabold text-sm text-[#1A1A1A] truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-neutral-500 font-medium">
                      {CURRENCY}{product.price.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdd(product)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1 shadow-xs shrink-0 ${
                      isAdded
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[#FFC400] text-[#1A1A1A] hover:bg-amber-300'
                    }`}
                  >
                    {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{isAdded ? 'Added' : 'Add'}</span>
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
