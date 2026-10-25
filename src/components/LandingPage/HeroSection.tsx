import React from 'react';
import { ArrowRight, Snowflake, Flame, Star } from 'lucide-react';

interface HeroSectionProps {
  onShopNow?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onShopNow }) => {
  const handleScrollToShop = () => {
    if (onShopNow) {
      onShopNow();
      return;
    }
    const el = document.getElementById('shop');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative w-full overflow-visible bg-[#C8102E] text-white pt-10 sm:pt-16 pb-20 sm:pb-28">
      {/* Subtle Radial Gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-90"
        style={{
          background: 'radial-gradient(circle at 75% 35%, #e6193c 0%, #C8102E 45%, #9B0B20 100%)'
        }}
      />

      {/* Decorative Ocean Sparkle / Water Bubble Accents */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#FFC400]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* Left Column: Headline, Subtext, Badges, CTA */}
          <div className="lg:col-span-7 space-y-6 text-left z-10">
            
            {/* Small Top Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-xs border border-white/25 text-white text-xs font-bold uppercase tracking-wider">
              <Snowflake className="w-4 h-4 text-[#FFC400]" />
              <span>Flash-Frozen at -40°C Sea Harvest</span>
            </div>

            {/* Large White Headline: 64-72px on desktop and 40px on mobile, tight line-height */}
            <h1 className="text-[40px] sm:text-[56px] lg:text-[68px] font-extrabold text-white leading-[1.05] tracking-tight drop-shadow-xs font-heading">
              Fresh From the Ocean, <br className="hidden sm:inline" />
              Delivered Frozen.
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg lg:text-xl text-white/90 font-medium max-w-2xl leading-relaxed">
              Premium seafood, ready meals and frozen favorites from Amansocean, flash-frozen and delivered to your door.
            </p>

            {/* Actions: Yellow rounded "Shop Now" button with hover lift effect + Secondary button */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={handleScrollToShop}
                className="px-8 py-4 rounded-full bg-[#FFC400] text-[#1A1A1A] font-extrabold text-base sm:text-lg hover:bg-[#ffcf33] transition-all duration-200 shadow-xl hover-lift flex items-center gap-3 group"
              >
                <span>Shop Now</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#offers"
                className="px-6 py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-base transition-colors border border-white/30 backdrop-blur-xs flex items-center gap-2"
              >
                <Flame className="w-4 h-4 text-[#FFC400]" />
                <span>Today's Catch Deals</span>
              </a>
            </div>

            {/* Trust Highlights */}
            <div className="pt-4 grid grid-cols-3 gap-3 border-t border-white/20 max-w-lg">
              <div className="space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-[#FFC400] tabular-nums">2 Hrs</div>
                <div className="text-[11px] sm:text-xs text-white/80 font-medium leading-tight">Catch-to-Freeze Peak Lock</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-[#FFC400] tabular-nums">100%</div>
                <div className="text-[11px] sm:text-xs text-white/80 font-medium leading-tight">Frozen Solid Guarantee</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-xl sm:text-2xl font-black text-[#FFC400] tabular-nums">4.9 ★</div>
                <div className="text-[11px] sm:text-xs text-white/80 font-medium leading-tight">15,000+ Happy Foodies</div>
              </div>
            </div>

          </div>

          {/* Right Column: Large product photo with soft drop shadow, slightly overlapping bottom edge */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            
            {/* Soft Ambient Glow */}
            <div className="absolute inset-0 bg-[#FFC400]/20 rounded-full blur-2xl transform scale-90 pointer-events-none" />

            {/* Overlapping Hero Product Card / Platter */}
            <div className="relative z-20 -mb-16 sm:-mb-24 lg:-mb-32 w-full max-w-md lg:max-w-none group">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/90 bg-[#FBF3E4] transition-transform duration-300 hover:scale-[1.02]">
                
                {/* Product Photo: Rich plate of prawns / seafood platter */}
                <img
                  src="https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=800&q=75&fm=webp"
                  alt="Amansocean Premium Jumbo Wild Tiger Prawns and Seafood Platter"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-72 sm:h-96 lg:h-[440px] object-cover object-center"
                />

                {/* Overlaid Badge & Tag */}
                <div className="absolute top-4 left-4 bg-[#FFC400] text-[#1A1A1A] font-extrabold text-xs px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-[#1A1A1A]" />
                  <span>Chef's Choice Wild Catch</span>
                </div>

                {/* Bottom floating micro card */}
                <div className="absolute bottom-4 inset-x-4 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-lg border border-amber-200/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#1A1A1A]">Jumbo Tiger Prawns & Langoustines</h4>
                    <p className="text-xs text-neutral-500 font-medium">Flash-frozen at sea · Sweet & Succulent</p>
                  </div>
                  <span className="font-black text-base text-[#C8102E] shrink-0 bg-red-50 px-2.5 py-1 rounded-lg">
                    Top Rated
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Small downward-pointing triangle notch at the bottom center, flowing into the cream section */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full z-20 pointer-events-none">
        <div 
          className="w-0 h-0"
          style={{
            borderLeft: '22px solid transparent',
            borderRight: '22px solid transparent',
            borderTop: '18px solid #9B0B20'
          }}
        />
      </div>
    </section>
  );
};
