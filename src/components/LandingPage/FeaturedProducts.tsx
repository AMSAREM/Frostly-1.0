import React, { useState } from 'react';
import { 
  Heart, 
  Plus, 
  Check, 
  Flame, 
  Sparkles, 
  Star,
  ShoppingBag,
  SlidersHorizontal
} from 'lucide-react';
import { 
  FEATURED_PRODUCTS, 
  AmansoceanProduct, 
  CURRENCY 
} from '../../data/amansoceanProducts';
import { useCart } from '../../context/CartContext';

interface FeaturedProductsProps {
  selectedCategory: string;
  searchQuery?: string;
}

export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  selectedCategory,
  searchQuery = ''
}) => {
  const { addToCart } = useCart();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});

  const toggleFavorite = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const handleAdd = (product: AmansoceanProduct) => {
    addToCart(product, 1);
    // Temporary feedback tick
    setAddedItemIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [product.id]: false }));
    }, 900);
  };

  // Filter products by category and search query
  const filteredProducts = FEATURED_PRODUCTS.filter((product) => {
    const matchesCategory = 
      selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = 
      !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section id="shop" className="py-14 sm:py-20 bg-[#FBF3E4] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading & Category Filter Tab bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#C8102E] mb-2">
              <Flame className="w-4 h-4 text-[#C8102E]" />
              <span>Freezer Essentials</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-heading text-[#1A1A1A]">
              Featured Products
            </h2>
            <p className="mt-1 text-sm sm:text-base text-neutral-600 font-medium">
              Individually quick-frozen (IQF) to preserve peak cellular texture and natural ocean flavor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-500 hidden sm:inline">
              Showing {filteredProducts.length} items
            </span>
          </div>
        </div>

        {/* 3 White Cards Grid (20px rounded corners, soft shadow, responsive 3 cols to 1 col) */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-[20px] p-12 text-center border border-amber-200 max-w-lg mx-auto shadow-md">
            <ShoppingBag className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#1A1A1A]">No products found</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Try adjusting your category filter or search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map((product) => {
              const isFav = !!favorites[product.id];
              const isAdded = !!addedItemIds[product.id];

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-[20px] p-5 shadow-sm hover:shadow-xl transition-all duration-300 border border-amber-200/70 flex flex-col justify-between hover-lift relative"
                >
                  {/* Top Image Container on Light Cream Background */}
                  <div className="relative w-full h-56 sm:h-60 rounded-2xl bg-[#FBF3E4] overflow-hidden flex items-center justify-center p-3 mb-4">
                    
                    {/* Badge Top-Left (small red "New" or "Hot") */}
                    {product.badge && (
                      <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-[#C8102E] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm z-10 flex items-center gap-1">
                        {product.badge === 'Hot' ? <Flame className="w-3 h-3 fill-white" /> : <Sparkles className="w-3 h-3" />}
                        <span>{product.badge}</span>
                      </span>
                    )}

                    {/* Heart Icon Top-Right (Favorite Toggle) */}
                    <button
                      onClick={(e) => toggleFavorite(product.id, e)}
                      className={`absolute top-3.5 right-3.5 p-2 rounded-full transition-all duration-200 z-10 ${
                        isFav
                          ? 'bg-red-50 text-[#C8102E] shadow-sm scale-110'
                          : 'bg-white/80 hover:bg-white text-neutral-500 hover:text-[#C8102E] shadow-xs'
                      }`}
                      aria-label="Save to favorites"
                    >
                      <Heart 
                        className={`w-4 h-4 transition-colors ${
                          isFav ? 'fill-[#C8102E] stroke-[#C8102E]' : 'stroke-current'
                        }`} 
                      />
                    </button>

                    {/* Product Photo */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Weight tag */}
                    {product.weight && (
                      <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold">
                        {product.weight}
                      </span>
                    )}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="font-semibold text-neutral-700">{product.category}</span>
                      {product.rating && (
                        <span className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{product.rating}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-lg sm:text-xl text-[#1A1A1A] group-hover:text-[#C8102E] transition-colors leading-snug">
                      {product.name}
                    </h3>

                    {/* Two-line Gray Description */}
                    <p className="text-xs sm:text-sm text-neutral-600 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Bottom Row: Price Bottom-Left, Small Yellow "Add" Button Bottom-Right */}
                  <div className="pt-4 mt-3 border-t border-amber-100/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 block -mb-1">
                        Price
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-[#1A1A1A] tracking-tight">
                        {CURRENCY}{product.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Small Yellow "Add" Button */}
                    <button
                      onClick={() => handleAdd(product)}
                      className={`px-4 sm:px-5 py-2.5 rounded-full font-extrabold text-xs sm:text-sm transition-all duration-200 flex items-center gap-1.5 shadow-sm hover-lift ${
                        isAdded
                          ? 'bg-emerald-500 text-white shadow-emerald-200'
                          : 'bg-[#FFC400] text-[#1A1A1A] hover:bg-[#ffcf33]'
                      }`}
                      aria-label={`Add ${product.name} to cart`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>Add</span>
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
