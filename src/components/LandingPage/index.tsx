import React, { useState, useEffect, useCallback } from 'react';
import { CartProvider, useCart } from '../../context/CartContext';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { CategoryCards } from './CategoryCards';
import { FeaturedProducts } from './FeaturedProducts';
import { BottomFeatureRow } from './BottomFeatureRow';
import { FooterSection } from './FooterSection';
import { CartDrawer } from './CartDrawer';
import { SearchModal } from './SearchModal';
import { OrderTrackingModal } from './OrderTrackingModal';
import { FeedbackModal } from './FeedbackModal';
import { LegalModal } from '../LegalModal';
import { AmansoceanProduct } from '../../data/amansoceanProducts';
import {
  fetchStorefrontCatalog,
  fetchStorefrontFavorites,
  toggleStorefrontFavorite,
  trackStorefrontEvent,
} from '../../services/storefrontService';

export interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onExploreDemo: () => void;
}

const LandingPageContent: React.FC<LandingPageProps> = ({
  onSignIn,
}) => {
  const { syncCatalogProducts } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [trackingModal, setTrackingModal] = useState<{
    isOpen: boolean;
    orderNumber?: string;
    contact?: string;
  }>({ isOpen: false });

  const [catalogProducts, setCatalogProducts] = useState<AmansoceanProduct[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const [legalModal, setLegalModal] = useState<{
    isOpen: boolean;
    type: 'privacy' | 'terms' | 'sitemap';
  }>({
    isOpen: false,
    type: 'privacy'
  });

  const loadCatalog = useCallback(async () => {
    try {
      const result = await fetchStorefrontCatalog();
      setCatalogProducts(result.products);
      syncCatalogProducts(result.products);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [syncCatalogProducts]);

  useEffect(() => {
    loadCatalog();
    fetchStorefrontFavorites().then((ids) => {
      const favMap: Record<string, boolean> = {};
      ids.forEach((id) => {
        favMap[id] = true;
      });
      setFavorites(favMap);
    });
    trackStorefrontEvent('page_view', {
      metadata: { path: typeof window !== 'undefined' ? window.location.pathname : '/' },
    });
  }, [loadCatalog]);

  const handleToggleFavorite = async (product: AmansoceanProduct) => {
    const nextState = !favorites[product.id];
    setFavorites((prev) => ({ ...prev, [product.id]: nextState }));
    try {
      const confirmed = await toggleStorefrontFavorite(product.id, product.name);
      setFavorites((prev) => ({ ...prev, [product.id]: confirmed.favorited }));
    } catch {
      // Revert optimistic toggle if backend fails
      setFavorites((prev) => ({ ...prev, [product.id]: !nextState }));
    }
  };

  const coolTreatsProducts = catalogProducts.filter(
    (p) => p.category === 'Fish & Shrimp Powders'
  );

  return (
    <div className="min-h-screen bg-[#FBF3E4] text-[#1A1A1A] font-sans antialiased selection:bg-[#FFC400] selection:text-[#1A1A1A]">
      
      {/* 1. Navbar */}
      <Navbar 
        onSignIn={onSignIn}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenTrackOrder={() => setTrackingModal({ isOpen: true })}
      />

      {/* 2. Hero */}
      <HeroSection 
        onShopNow={() => {
          const el = document.getElementById('shop');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* 3. Category Cards */}
      <CategoryCards
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => setSelectedCategory(cat)}
      />

      {/* 4. Featured Products (Live Supabase Catalog + Stock + Persistent Favorites) */}
      <FeaturedProducts
        selectedCategory={selectedCategory}
        products={catalogProducts}
        isLoading={isLoadingCatalog}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* 5. Bottom Feature Row */}
      <BottomFeatureRow coolTreatsProducts={coolTreatsProducts} />

      {/* 6. Footer */}
      <FooterSection
        onSignIn={onSignIn}
        onOpenLegal={(type) => setLegalModal({ isOpen: true, type })}
        onOpenTrackOrder={() => setTrackingModal({ isOpen: true })}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />

      {/* Slide-out Cart Drawer with Dual-Ledger Supabase Checkout */}
      <CartDrawer
        onOrderConfirmed={() => {
          loadCatalog();
        }}
        onTrackOrder={(orderNumber, contact) => {
          setTrackingModal({ isOpen: true, orderNumber, contact });
        }}
      />

      {/* Quick Search Modal */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={catalogProducts}
      />

      {/* Live Cold-Chain Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={trackingModal.isOpen}
        onClose={() => setTrackingModal({ isOpen: false })}
        initialOrderNumber={trackingModal.orderNumber}
        initialContact={trackingModal.contact}
      />

      {/* Customer Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
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
