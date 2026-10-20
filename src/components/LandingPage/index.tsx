import React, { useState } from 'react';
import { CartProvider } from '../../context/CartContext';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { CategoryCards } from './CategoryCards';
import { FeaturedProducts } from './FeaturedProducts';
import { BottomFeatureRow } from './BottomFeatureRow';
import { FooterSection } from './FooterSection';
import { CartDrawer } from './CartDrawer';
import { SearchModal } from './SearchModal';
import { LegalModal } from '../LegalModal';

export interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onExploreDemo: () => void;
}

const LandingPageContent: React.FC<LandingPageProps> = ({
  onSignIn,
  onGetStarted,
  onExploreDemo
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<{
    isOpen: boolean;
    type: 'privacy' | 'terms' | 'sitemap';
  }>({
    isOpen: false,
    type: 'privacy'
  });

  return (
    <div className="min-h-screen bg-[#FBF3E4] text-[#1A1A1A] font-sans antialiased selection:bg-[#FFC400] selection:text-[#1A1A1A]">
      
      {/* 1. Navbar (sticky, yellow background, red AO badge overlapping, center links, right cart/order/search/account) */}
      <Navbar 
        onSignIn={onSignIn}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* 2. Hero (full-width red background, radial gradient, large headline, yellow button, overlapping seafood platter, bottom triangle notch) */}
      <HeroSection 
        onShopNow={() => {
          const el = document.getElementById('shop');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* 3. Category Cards (3 speech-bubble style cards with bottom pointer triangle, filters products) */}
      <CategoryCards
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
      />

      {/* 4. Featured Products (3 white cards, 20px rounded corners, soft shadow, red New/Hot badge, heart icon, price, yellow Add button) */}
      <FeaturedProducts
        selectedCategory={selectedCategory}
      />

      {/* 5. Bottom Feature Row (2:1 width ratio: Peach card with green rider on red scooter + Fast Delivery/Freshness; Red card with Cool Treats + yellow Order Now) */}
      <BottomFeatureRow />

      {/* 6. Footer (Deep red #9B0B20, Amansocean logo, quick links, social icons, copyright line) */}
      <FooterSection
        onSignIn={onSignIn}
        onOpenLegal={(type) => setLegalModal({ isOpen: true, type })}
      />

      {/* Slide-out Cart Drawer with Items, Quantities, and Checkout */}
      <CartDrawer />

      {/* Quick Search Modal */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Legal & Terms Modal */}
      <LegalModal
        isOpen={legalModal.isOpen}
        type={legalModal.type}
        onClose={() => setLegalModal({ ...legalModal, isOpen: false })}
      />

    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = (props) => {
  return (
    <CartProvider>
      <LandingPageContent {...props} />
    </CartProvider>
  );
};

export default LandingPage;
