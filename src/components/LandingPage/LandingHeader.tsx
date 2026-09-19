import React, { useState } from 'react';
import { 
  Snowflake, 
  Search, 
  Menu, 
  X, 
  ChevronDown, 
  ExternalLink,
  ShieldCheck,
  Download,
  LogIn
} from 'lucide-react';
import { FrostlyLogo } from '../FrostlyLogo';

interface LandingHeaderProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onExploreDemo: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  onSignIn,
  onGetStarted,
  onExploreDemo
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Product Name */}
          <div className="flex items-center gap-6">
            <div 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <FrostlyLogo size={28} iconOnly variant="blue" />
              <div className="flex items-center">
                <span className="font-semibold text-xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  Frostly
                </span>
                <span className="mx-2.5 text-slate-300 font-light hidden sm:inline">|</span>
                <span className="text-sm font-medium text-slate-600 hidden sm:inline">
                  Seafood Platform
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              <button 
                onClick={() => scrollToSection('features')} 
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-md transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('traceability')} 
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-md transition-colors"
              >
                Traceability & HACCP
              </button>
              <button 
                onClick={() => scrollToSection('copilot')} 
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-md transition-colors flex items-center gap-1.5"
              >
                <span>AI Catch Intelligence</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Copilot
                </span>
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-md transition-colors"
              >
                Pricing
              </button>
              <button 
                onClick={() => scrollToSection('faq')} 
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 rounded-md transition-colors"
              >
                FAQ
              </button>
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onExploreDemo}
              className="hidden md:inline-flex items-center text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              Explore Live Demo
            </button>

            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:text-blue-700 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <LogIn className="w-4 h-4 text-slate-600" />
              <span>Sign in</span>
            </button>

            <button
              onClick={onGetStarted}
              className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-md shadow-xs transition-all active:scale-95"
            >
              Start Free Trial
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => scrollToSection('features')}
                className="text-left px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('traceability')}
                className="text-left px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                Traceability & HACCP
              </button>
              <button
                onClick={() => scrollToSection('copilot')}
                className="text-left px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                AI Catch Intelligence (Copilot)
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-left px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="text-left px-3 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                FAQ
              </button>
              <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
                <button
                  onClick={onExploreDemo}
                  className="w-full text-center py-2.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                >
                  Explore Live Demo
                </button>
                <button
                  onClick={onSignIn}
                  className="w-full text-center py-2.5 text-sm font-medium bg-slate-100 text-slate-900 rounded-md hover:bg-slate-200"
                >
                  Sign In
                </button>
                <button
                  onClick={onGetStarted}
                  className="w-full text-center py-2.5 text-sm font-medium bg-slate-900 text-white rounded-md shadow-xs"
                >
                  Start Free Trial
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
