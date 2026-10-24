import React, { useState } from 'react';
import { 
  Heart, 
  Plus, 
  Check, 
  Flame, 
  Star,
  ShoppingBag,
  Fish
} from 'lucide-react';
import { 
  ALL_AMANSOCEAN_STOREFRONT_PRODUCTS,
  AMANSOCEAN_FLYER_NOTES,
  AMANSOCEAN_CONTACT_PHONE,
  AMANSOCEAN_LOCATION,
  AmansoceanProduct, 
  CURRENCY 
} from '../../data/amansoceanProducts';
import { useCart } from '../../context/CartContext';

interface FeaturedProductsProps {
  selectedCategory: string;
  searchQuery?: string;
  products?: AmansoceanProduct[];
  isLoading?: boolean;
  favorites?: Record<string, boolean>;
  onToggleFavorite?: (product: AmansoceanProduct, e: React.MouseEvent) => void;
}

export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  selectedCategory,
  searchQuery = '',
  products,
  isLoading = false,
  favorites: externalFavorites,
  onToggleFavorite,
}) => {
  const { addToCart } = useCart();
  const [localFavorites, setLocalFavorites] = useState<Record<string, boolean>>({});
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const activeFavorites = externalFavorites || localFavorites;
  const savedCount = Object.values(activeFavorites).filter(Boolean).length;

  const catalogItems =
    products && products.length > 0
      ? products
      : ALL_AMANSOCEAN_STOREFRONT_PRODUCTS;

  const handleFavoriteClick = (product: AmansoceanProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(product, e);
    } else {
      setLocalFavorites((prev) => ({ ...prev, [product.id]: !prev[product.id] }));
    }
  };

  const handleAdd = (product: AmansoceanProduct) => {
    if (product.inStock === false || (typeof product.stockKg === 'number' && product.stockKg <= 0)) {
      return;
    }
    addToCart(product, 1);
    setAddedItemIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [product.id]: false }));
    }, 900);
  };

  const filteredProducts = catalogItems.filter((product) => {
    const matchesCategory =
      selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = !onlyFavorites || !!activeFavorites[product.id];
    return matchesCategory && matchesSearch && matchesFav;
  });

  return (
    <section id="shop" className="py-14 sm:py-20 bg-[#FBF3E4] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading & Saved Favorites Filter */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-[#C8102E] mb-2">
              <Flame className="w-4 h-4 text-[#C8102E]" />
              <span>Official Coldstore Price List ({CURRENCY})</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-heading text-[#1A1A1A]">
              Fresh &amp; Flash-Frozen Seafood
            </h2>
            <p className="mt-1 text-sm sm:text-base text-neutral-600 font-medium">
              {AMANSOCEAN_LOCATION} · Tel {AMANSOCEAN_CONTACT_PHONE} · {AMANSOCEAN_FLYER_NOTES[0]}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {savedCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyFavorites
                    ? 'bg-[#C8102E] text-white shadow-xs'
                    : 'bg-white border border-amber-300 text-[#1A1A1A] hover:border-[#C8102E]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-white' : 'fill-[#C8102E] text-[#C8102E]'}`} />
                <span className="tabular-nums">Saved Favorites ({savedCount})</span>
              </button>
            )}
            <span className="text-xs font-bold text-neutral-600 tabular-nums whitespace-nowrap">
              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading && filteredProducts.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-[20px] p-5 border border-amber-200/70 space-y-4 animate-pulse"
              >
                <div className="w-full h-56 sm:h-60 rounded-2xl bg-[#FBF3E4]" />
                <div className="h-4 w-1/3 bg-amber-100 rounded" />
                <div className="h-6 w-3/4 bg-amber-100 rounded" />
                <div className="h-10 w-full bg-amber-50 rounded" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-[20px] p-12 text-center border border-amber-200 max-w-lg mx-auto shadow-md">
            <ShoppingBag className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#1A1A1A]">No products found</h3>
            <p className="text-sm text-neutral-500 mt-1">
              {onlyFavorites
                ? 'No saved favorites match this category filter.'
                : 'Try adjusting your category filter or search query.'}
            </p>
            {onlyFavorites && (
              <button
                type="button"
                onClick={() => setOnlyFavorites(false)}
                className="mt-4 px-5 py-2 rounded-full bg-[#FFC400] text-[#1A1A1A] text-xs font-extrabold hover:bg-amber-300 transition-colors"
              >
                Show All Products
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map((product) => {
              const isFav = !!activeFavorites[product.id];
              const isAdded = !!addedItemIds[product.id];
              const stockCount =
                typeof product.stockKg === 'number' ? Math.max(0, Math.floor(product.stockKg)) : null;
              const isOutOfStock =
                product.inStock === false || (stockCount !== null && stockCount <= 0);
              const isLowStock = !isOutOfStock && stockCount !== null && stockCount <= 10;

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-[20px] p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-amber-200/70 flex flex-col justify-between hover-lift relative"
                >
                  {/* Top Image Container */}
                  <div className="relative w-full h-56 sm:h-60 rounded-2xl bg-[#FBF3E4] overflow-hidden flex items-center justify-center p-3 mb-4">
                    
                    {/* Single Subtle Tag Top-Left */}
                    {isOutOfStock ? (
                      <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-extrabold z-10">
                        Sold Out
                      </span>
                    ) : product.badge ? (
                      <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-md bg-[#C8102E] text-white text-[11px] font-extrabold shadow-xs z-10">
                        {product.badge}
                      </span>
                    ) : null}

                    {/* Heart Icon Top-Right (Persistent Favorite Toggle) */}
                    <button
                      onClick={(e) => handleFavoriteClick(product, e)}
                      className={`absolute top-3.5 right-3.5 p-2.5 rounded-full transition-all duration-200 z-10 cursor-pointer ${
                        isFav
                          ? 'bg-red-50 text-[#C8102E] shadow-sm scale-110'
                          : 'bg-white/90 hover:bg-white text-neutral-500 hover:text-[#C8102E] shadow-xs'
                      }`}
                      aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                    >
                      <Heart 
                        className={`w-4 h-4 transition-colors ${
                          isFav ? 'fill-[#C8102E] stroke-[#C8102E]' : 'stroke-current'
                        }`} 
                      />
                    </button>

                    {/* Product Photo with Resilient Fallback */}
                    {failedImages[product.id] || !product.image ? (
                      <div className="w-full h-full rounded-xl bg-amber-100/70 flex flex-col items-center justify-center text-[#9B0B20] p-4 text-center">
                        <Fish className="w-10 h-10 mb-2 opacity-80" />
                        <span className="text-xs font-bold">{product.name}</span>
                      </div>
                    ) : (
                      <img
                        src={product.image}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                        }
                        className={`w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105 ${
                          isOutOfStock ? 'opacity-60 grayscale' : ''
                        }`}
                        loading="lazy"
                      />
                    )}
                  </div>

                  {/* Middle Content — Clean Unboxed Metadata */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-neutral-700">{product.category}</span>
                        {product.weight && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{product.weight}</span>
                          </>
                        )}
                        {stockCount !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`tabular-nums font-semibold ${
                                isOutOfStock
                                  ? 'text-rose-700'
                                  : isLowStock
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {isOutOfStock
                                ? 'Out of stock'
                                : isLowStock
                                ? `${stockCount} left`
                                : `${stockCount} in stock`}
                            </span>
                          </>
                        )}
                      </div>
                      {product.rating && (
                        <span className="flex items-center gap-1 text-amber-600 font-bold tabular-nums shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{product.rating.toFixed(1)}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-lg sm:text-xl text-[#1A1A1A] group-hover:text-[#C8102E] transition-colors leading-snug">
                      {product.name}
                    </h3>

                    <p className="text-xs sm:text-sm text-neutral-600 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Bottom Row: Tabular Price & Add Button */}
                  <div className="pt-4 mt-3 border-t border-amber-100/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-neutral-500 block">
                        {product.unit === 'pack' || (product.weight && /pack/i.test(product.weight))
                          ? 'Pack Price'
                          : 'Price per Kilo'}
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight tabular-nums font-mono">
                        {CURRENCY} {product.price.toFixed(2)}
                      </span>
                      {typeof product.wholesalePrice === 'number' &&
                        product.wholesalePrice < product.price && (
                          <span className="text-[11px] font-bold text-[#9B0B20] block tabular-nums">
                            {CURRENCY} {product.wholesalePrice.toFixed(2)}/kg on{' '}
                            {product.wholesaleMinQty || 10}kg+
                          </span>
                        )}
                    </div>

                    <button
                      onClick={() => handleAdd(product)}
                      disabled={isOutOfStock}
                      className={`px-4 sm:px-5 py-2.5 rounded-full font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 ${
                        isOutOfStock
                          ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                          : isAdded
                          ? 'bg-emerald-600 text-white cursor-pointer'
                          : 'bg-[#FFC400] text-[#1A1A1A] hover:bg-[#ffcf33] hover-lift cursor-pointer'
                      }`}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      {isOutOfStock ? (
                        <span>Sold Out</span>
                      ) : isAdded ? (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>Add to Bag</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
