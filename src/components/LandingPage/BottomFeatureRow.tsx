import React, { useState } from 'react';
import { 
  Truck, 
  Snowflake, 
  ArrowRight, 
  Clock, 
  X, 
  CheckCircle2,
  Package
} from 'lucide-react';
import {
  AmansoceanProduct,
  COOL_TREATS_PRODUCTS,
  AMANSOCEAN_CATEGORIES,
  AMANSOCEAN_CONTACT_PHONE,
  AMANSOCEAN_LOCATION,
  CURRENCY,
} from '../../data/amansoceanProducts';
import { useCart } from '../../context/CartContext';

interface BottomFeatureRowProps {
  coolTreatsProducts?: AmansoceanProduct[];
}

export const BottomFeatureRow: React.FC<BottomFeatureRowProps> = ({
  coolTreatsProducts,
}) => {
  const { addToCart, setIsCartOpen } = useCart();
  const [activeLearnMore, setActiveLearnMore] = useState<'delivery' | 'freshness' | null>(null);

  const handleOrderTreats = () => {
    const sourceList =
      coolTreatsProducts && coolTreatsProducts.length > 0
        ? coolTreatsProducts
        : COOL_TREATS_PRODUCTS;
    const treat = sourceList.find((t) => t.inStock !== false) || sourceList[0];
    if (treat) {
      addToCart(treat, 1);
      setIsCartOpen(true);
    }
  };

  return (
    <section id="delivery" className="py-12 sm:py-16 bg-[#FBF3E4] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Two cards in roughly 2:1 width ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* LEFT CARD (Peach/Tan #F5DDB0, ~2/3 width = 8 cols) */}
          <div className="lg:col-span-8 bg-[#F5DDB0] rounded-[28px] p-6 sm:p-10 border border-amber-300/80 shadow-md flex flex-col justify-between relative overflow-hidden">
            
            {/* Top row: heading and rider */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Heading on the left */}
              <div className="md:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 text-[#C8102E] text-xs font-black uppercase tracking-wider">
                  <Truck className="w-3.5 h-3.5 text-[#C8102E]" />
                  <span>Amansocean Cold-Fleet</span>
                </div>
                <h3 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-[#1A1A1A] tracking-tight leading-[1.1] font-heading">
                  Cold Chain, <br className="hidden sm:inline" />
                  Fresh Taste.
                </h3>
                <p className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed max-w-md">
                  From ocean landing docks into multi-temp sub-zero delivery boxes. We monitor continuous thermal integrity so your food thaws only when you say so.
                </p>
              </div>

              {/* Delivery rider in a green shirt on a red scooter */}
              <div className="md:col-span-5 flex justify-center items-center py-2">
                <div className="relative w-52 h-44 sm:w-60 sm:h-52 flex items-center justify-center">
                  
                  {/* Stylized custom SVG illustration: Rider in green shirt on a red scooter */}
                  <svg 
                    viewBox="0 0 240 200" 
                    className="w-full h-full drop-shadow-lg transition-transform duration-300 hover:scale-105"
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Road shadow */}
                    <ellipse cx="120" cy="180" rx="90" ry="8" fill="#1A1A1A" fillOpacity="0.12" />
                    
                    {/* Back wheel */}
                    <circle cx="50" cy="155" r="24" fill="#2b2d42" />
                    <circle cx="50" cy="155" r="14" fill="#e2e8f0" />
                    <circle cx="50" cy="155" r="5" fill="#2b2d42" />
                    
                    {/* Front wheel */}
                    <circle cx="178" cy="155" r="24" fill="#2b2d42" />
                    <circle cx="178" cy="155" r="14" fill="#e2e8f0" />
                    <circle cx="178" cy="155" r="5" fill="#2b2d42" />

                    {/* Red Scooter Body (#C8102E) */}
                    <path d="M50 155 L85 140 L130 140 L165 110 L178 155" stroke="#C8102E" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M80 140 L115 140 L135 115 L165 115" fill="#C8102E" />
                    <rect x="90" y="125" width="45" height="18" rx="8" fill="#9B0B20" />
                    
                    {/* Scooter Footboard */}
                    <rect x="90" y="142" width="48" height="6" rx="3" fill="#1A1A1A" />

                    {/* Front Scooter Fairing & Headlight */}
                    <path d="M155 125 L172 85 L182 85" stroke="#C8102E" strokeWidth="8" strokeLinecap="round" />
                    <circle cx="185" cy="85" r="7" fill="#FFC400" stroke="#FFFFFF" strokeWidth="2" />
                    
                    {/* Handlebars */}
                    <path d="M168 85 L158 80" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" />

                    {/* Cold Cargo Thermal Box on Rear */}
                    <rect x="35" y="85" width="48" height="50" rx="8" fill="#FFFFFF" stroke="#C8102E" strokeWidth="3" />
                    <rect x="40" y="90" width="38" height="16" rx="4" fill="#C8102E" />
                    <text x="59" y="102" fontSize="10" fontWeight="900" fill="#FFFFFF" textAnchor="middle" fontFamily="sans-serif">AO</text>
                    {/* Snowflake icon on box */}
                    <circle cx="59" cy="122" r="8" fill="#FBF3E4" />
                    <path d="M59 117 V127 M54 122 H64" stroke="#C8102E" strokeWidth="2" strokeLinecap="round" />

                    {/* Rider: Green Shirt (#10B981 / #059669) & Helmet */}
                    {/* Legs in dark trousers */}
                    <path d="M86 110 L108 116 L118 142" stroke="#1E293B" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Green Shirt Torso */}
                    <path d="M82 108 L112 88 L126 95 L112 115 Z" fill="#10B981" />
                    {/* Green Arm to Handlebar */}
                    <path d="M112 90 L140 85 L158 83" stroke="#059669" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Rider Head & Red Helmet */}
                    <circle cx="118" cy="62" r="16" fill="#C8102E" />
                    <path d="M106 62 Q118 50 130 62" fill="#9B0B20" />
                    {/* Helmet Visor */}
                    <path d="M124 60 H134" stroke="#FFC400" strokeWidth="4" strokeLinecap="round" />
                  </svg>

                </div>
              </div>

            </div>

            {/* Two feature items on the right bottom: "Fast Delivery" & "Frozen at Peak Freshness" */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-6 border-t border-amber-300/80">
              
              {/* Feature 1: Fast Delivery */}
              <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-amber-200/90 flex flex-col justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-[#1A1A1A]">Fast Delivery</h4>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-snug">
                      Same-day or next-morning dispatch in dedicated dry ice thermal pods.
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-right">
                  <button
                    onClick={() => setActiveLearnMore('delivery')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C8102E] text-white text-xs font-bold hover:bg-[#9B0B20] transition-colors shadow-xs"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Feature 2: Frozen at Peak Freshness */}
              <div className="bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-amber-200/90 flex flex-col justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center shrink-0">
                    <Snowflake className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-[#1A1A1A]">Frozen at Peak Freshness</h4>
                    <p className="text-xs text-neutral-600 mt-0.5 leading-snug">
                      Flash-frozen within 120 minutes of dock landing at -40°C cryogenic chill.
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-right">
                  <button
                    onClick={() => setActiveLearnMore('freshness')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#C8102E] text-white text-xs font-bold hover:bg-[#9B0B20] transition-colors shadow-xs"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT CARD (Red #C8102E, ~1/3 width = 4 cols) */}
          <div className="lg:col-span-4 bg-[#C8102E] text-white rounded-[28px] p-6 sm:p-8 shadow-xl flex flex-col justify-between relative overflow-hidden group">
            
            {/* Subtle Gradient Backing */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-80"
              style={{
                background: 'radial-gradient(circle at 80% 20%, #e6193c 0%, #C8102E 60%, #9B0B20 100%)'
              }}
            />

            <div className="relative z-10 space-y-4">
              {/* Fish & Shrimp Powders Local Artwork */}
              <div className="w-full h-48 sm:h-52 rounded-2xl overflow-hidden bg-white/10 border-2 border-white/20 shadow-md relative">
                <img
                  src={AMANSOCEAN_CATEGORIES[3].image}
                  alt="Amans Ocean Pure Fish and Shrimp Powders"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 px-3 py-1 rounded-md bg-[#FFC400] text-[#1A1A1A] text-xs font-extrabold flex items-center gap-1 shadow-sm">
                  <Package className="w-3.5 h-3.5" />
                  <span>{CURRENCY} 50 · {CURRENCY} 100 Packs</span>
                </div>
              </div>

              {/* Title: Fish & Shrimp Powders + Bulk Offers */}
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-white">
                Fish &amp; Shrimp Powders
              </h3>

              {/* Short Description + Flyer Bulk Offer Note */}
              <p className="text-sm text-red-100 font-medium leading-relaxed">
                100% pure milled Fish Powder and Shrimp Powder in Regular ({CURRENCY} 50) &amp; Large ({CURRENCY} 100) packs. Discounted offers on purchases above 5kg &amp; negotiable wholesale rates.
              </p>

              <div className="text-xs text-amber-200 font-semibold">
                {AMANSOCEAN_LOCATION} · Tel {AMANSOCEAN_CONTACT_PHONE}
              </div>
            </div>

            {/* Yellow "Add Powder Pack" Button */}
            <div className="relative z-10 pt-6">
              <button
                onClick={handleOrderTreats}
                className="w-full py-4 rounded-full bg-[#FFC400] text-[#1A1A1A] font-extrabold text-base hover:bg-[#ffcf33] transition-all duration-200 shadow-lg hover-lift flex items-center justify-center gap-2 group-hover:shadow-xl cursor-pointer whitespace-nowrap"
              >
                <span>Add Powder Pack</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Interactive Modal for "Learn more" buttons */}
      {activeLearnMore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-amber-200 animate-fade-in-up">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-[#C8102E]">
                {activeLearnMore === 'delivery' ? (
                  <Truck className="w-6 h-6" />
                ) : (
                  <Snowflake className="w-6 h-6" />
                )}
                <h4 className="font-extrabold text-lg text-[#1A1A1A]">
                  {activeLearnMore === 'delivery' 
                    ? 'Amansocean Express Cold Delivery' 
                    : 'The -40°C Cryo-Freeze Standard'}
                </h4>
              </div>
              <button
                onClick={() => setActiveLearnMore(null)}
                className="p-1 rounded-full hover:bg-neutral-100 text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-sm text-neutral-700">
              {activeLearnMore === 'delivery' ? (
                <>
                  <p>
                    Our urban delivery scooters and refrigerated vans are equipped with custom sealed polyurethane cooler chests cooled with medical-grade dry ice blocks.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Guaranteed core temperature below -18°C upon arrival.
                    </li>
                    <li className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Insulated biodegradable wool-liners for porch drop-offs.
                    </li>
                    <li className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Live SMS cold-chain tracking and arrival alerts.
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p>
                    Standard consumer freezers freeze food over 8 to 12 hours, creating jagged ice crystals that rupture cellular walls and dry out delicate fish proteins.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Blast freezing locks in sweetness in just 45 minutes.
                    </li>
                    <li className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Microscopic ice crystals preserve pristine sashimi-grade texture.
                    </li>
                    <li className="flex items-center gap-2 text-xs font-semibold text-neutral-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Zero chemical preservatives or additives required.
                    </li>
                  </ul>
                </>
              )}
            </div>

            <button
              onClick={() => setActiveLearnMore(null)}
              className="w-full mt-2 py-3 bg-[#C8102E] text-white rounded-full font-bold hover:bg-[#9B0B20] transition-colors"
            >
              Got it, close
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
