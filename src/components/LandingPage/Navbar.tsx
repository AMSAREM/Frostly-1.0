import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  ShoppingCart, 
  Menu, 
  X, 
  ArrowRight,
  Flame,
  Truck,
  Sparkles,
  ShoppingBag,
  Info
} from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface NavbarProps {
  onSignIn?: () => void;
  onOpenSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSignIn, onOpenSearch }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { totalCount, setIsCartOpen, bounceBadge } = useCart();

  // Close mobile menu when screen resizes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navLinks = [
    { label: 'Shop', href: '#shop', icon: ShoppingBag },
    { label: 'Offers', href: '#offers', icon: Flame },
    { label: 'Delivery', href: '#delivery', icon: Truck },
    { label: 'About', href: '#about', icon: Info }
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOrderNow = () => {
    setMobileMenuOpen(false);
    const shopEl = document.getElementById('shop');
    if (shopEl) {
      shopEl.scrollIntoView({ behavior: 'smooth' });
    } else {
      setIsCartOpen(true);
    }
  };

  return (
    <header 
      id="main-navbar"
      className="sticky top-0 z-40 w-full bg-[#FFC400] text-[#1A1A1A] shadow-md border-b border-amber-300 transition-colors select-none"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Left: circular red logo badge with "AO" overlapping bottom edge slightly + wordmark */}
          <div className="flex items-center gap-2 sm:gap-3.5 relative z-10 shrink-0">
            <a 
              href="#" 
              className="group flex items-center gap-2 sm:gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] rounded-2xl p-0.5"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label="Amansocean Home"
            >
              {/* Circular red logo badge overlapping slightly */}
              <div className="relative translate-y-1 sm:translate-y-2 -mb-2 sm:-mb-3 transition-transform duration-200 group-hover:scale-105 shrink-0">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-black text-lg sm:text-2xl shadow-lg border-[3px] border-[#FFC400] ring-2 ring-[#C8102E]/25">
                  AO
                </div>
              </div>
              
              <div className="flex flex-col justify-center">
                <span className="font-extrabold text-xl sm:text-2xl lg:text-3xl tracking-tight text-[#1A1A1A] group-hover:text-[#9B0B20] transition-colors leading-none font-heading">
                  Amansocean
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-neutral-800 mt-0.5 hidden xs:block sm:block leading-tight">
                  Ocean Fresh · Flash Frozen
                </span>
              </div>
            </a>
          </div>

          {/* Center Links (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="font-bold text-sm lg:text-base text-[#1A1A1A] hover:text-[#C8102E] transition-colors relative py-1 px-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] rounded-md"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#C8102E] transition-all duration-200 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* Right Action Icons & Order Now Button */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Search Icon */}
            <button
              onClick={onOpenSearch}
              className="p-2 sm:p-2.5 rounded-full hover:bg-black/10 active:bg-black/15 text-[#1A1A1A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
              title="Search seafood & meals"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Account Icon (Hidden on tiny mobile to keep header clean and tidy, visible inside mobile menu) */}
            <button
              onClick={onSignIn}
              className="hidden sm:flex items-center gap-1.5 p-2 sm:p-2.5 rounded-full hover:bg-black/10 active:bg-black/15 text-[#1A1A1A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
              title="Customer or Staff Account"
              aria-label="Account"
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-bold hidden lg:inline">Sign In</span>
            </button>

            {/* Cart Icon with bouncing red item-count badge */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-full hover:bg-black/10 active:bg-black/15 text-[#1A1A1A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
              title="View Cart"
              aria-label={`Shopping Cart with ${totalCount} items`}
            >
              <ShoppingCart className="w-5 h-5" />
              {totalCount > 0 && (
                <span 
                  className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-[#C8102E] text-white text-[10px] font-black flex items-center justify-center border-2 border-[#FFC400] shadow-sm leading-none ${
                    bounceBadge ? 'animate-cart-bounce ring-4 ring-[#C8102E]/30' : ''
                  }`}
                >
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}
            </button>

            {/* Red "Order Now" Pill Button */}
            <button
              onClick={handleOrderNow}
              className="hidden sm:inline-flex items-center gap-1.5 lg:gap-2 px-4 lg:px-5 py-2 lg:py-2.5 rounded-full bg-[#C8102E] text-white font-extrabold text-xs lg:text-sm hover:bg-[#9B0B20] active:scale-95 transition-all shadow-md hover-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B0B20]"
            >
              <span>Order Now</span>
              <ArrowRight className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-black/10 active:bg-black/15 text-[#1A1A1A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E]"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

          </div>

        </div>
      </div>

      {/* Tidy Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FFC400] border-t border-amber-300 px-4 pt-3 pb-6 shadow-xl animate-fade-in-up">
          {/* Quick Search in Drawer */}
          <div className="mb-3">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenSearch) onOpenSearch();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-amber-400/40 hover:bg-amber-400/60 rounded-xl text-xs font-bold text-neutral-800 transition-colors border border-amber-300"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-neutral-700" />
                <span>Search seafood, prawn platters, fries...</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-neutral-600 bg-white/40 px-2 py-0.5 rounded-md">Find</span>
            </button>
          </div>

          {/* Navigation Links Grid */}
          <nav className="grid grid-cols-2 gap-2 mb-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="flex items-center gap-2.5 font-bold text-sm text-[#1A1A1A] hover:text-[#C8102E] px-3 py-2.5 rounded-xl bg-amber-300/40 hover:bg-amber-400/50 transition-colors border border-amber-300/60"
                >
                  <Icon className="w-4 h-4 text-[#C8102E] shrink-0" />
                  <span>{link.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Primary Action Buttons */}
          <div className="pt-2 border-t border-amber-300/80 flex flex-col gap-2">
            <button
              onClick={handleOrderNow}
              className="w-full py-3 bg-[#C8102E] text-white font-extrabold text-sm text-center rounded-full hover:bg-[#9B0B20] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>Order Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onSignIn) onSignIn();
              }}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-neutral-900 hover:text-[#C8102E] bg-white/40 hover:bg-white/60 rounded-xl transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Sign In to Account / Staff Portal</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
