import React from 'react';
import { AMANSOCEAN_CATEGORIES } from '../../data/amansoceanProducts';
import { Utensils, Check } from 'lucide-react';

interface CategoryCardsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryCards: React.FC<CategoryCardsProps> = ({
  selectedCategory,
  onSelectCategory
}) => {
  return (
    <section className="relative pt-24 sm:pt-32 pb-12 bg-[#FBF3E4] text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="text-xs font-extrabold tracking-wide text-[#9B0B20] mb-2 flex items-center justify-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            <span>Explore By Category</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A1A] tracking-tight font-heading">
            What Are You Craving Today?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-neutral-600 font-medium">
            Click any category below to filter our premium flash-frozen range
          </p>

          {/* Quick reset "All Categories" button */}
          {selectedCategory !== 'All' && (
            <button
              onClick={() => onSelectCategory('All')}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-amber-300 text-xs font-bold text-[#C8102E] hover:bg-amber-100 transition-colors shadow-xs"
            >
              <span>Showing: <strong>{selectedCategory}</strong> (Click to view all)</span>
            </button>
          )}
        </div>

        {/* 4 Official Amans Ocean Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7 max-w-6xl mx-auto">
          {AMANSOCEAN_CATEGORIES.map((cat) => {
            const isRed = cat.theme === 'red';
            const isSelected = selectedCategory === cat.id;

            return (
              <div key={cat.id} className="relative flex flex-col items-center">
                {/* Main Speech Bubble Card */}
                <button
                  type="button"
                  onClick={() => onSelectCategory(isSelected ? 'All' : cat.id)}
                  className={`group relative w-full rounded-[24px] p-6 text-center shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer text-left focus:outline-none ${
                    isRed
                      ? 'bg-[#C8102E] text-white hover:bg-[#b20d28]'
                      : 'bg-[#FFC400] text-[#1A1A1A] hover:bg-[#f5bc00]'
                  } ${
                    isSelected ? 'ring-4 ring-[#1A1A1A] shadow-2xl scale-[1.03]' : ''
                  }`}
                  style={{ minHeight: '260px' }}
                >
                  {/* Selected Tick Indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white text-[#1A1A1A] flex items-center justify-center shadow-sm">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}

                  {/* Circular Image Inside Bubble */}
                  <div className="mx-auto w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white shadow-md bg-white mb-4 transition-transform duration-300 group-hover:rotate-2 group-hover:scale-105">
                    <img
                      src={cat.image}
                      alt={cat.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Centered Label */}
                  <div className="text-center">
                    <h3
                      className={`text-2xl font-extrabold tracking-tight font-heading ${
                        isRed ? 'text-white' : 'text-[#1A1A1A]'
                      }`}
                    >
                      {cat.label}
                    </h3>
                    <p
                      className={`text-xs font-semibold mt-1 ${
                        isRed ? 'text-red-100' : 'text-neutral-800'
                      }`}
                    >
                      {cat.tagline}
                    </p>
                  </div>

                  {/* Small pointer triangle at the bottom of the speech bubble */}
                  <div
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 transition-transform group-hover:translate-y-0.5"
                    style={{
                      borderLeft: '14px solid transparent',
                      borderRight: '14px solid transparent',
                      borderTop: `14px solid ${isRed ? '#C8102E' : '#FFC400'}`
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
