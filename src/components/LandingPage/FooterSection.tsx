import React from 'react';
import { 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck,
  Snowflake,
  ArrowUp
} from 'lucide-react';

interface FooterSectionProps {
  onSignIn?: () => void;
  onOpenLegal?: (type: 'privacy' | 'terms') => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({
  onSignIn,
  onOpenLegal
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#9B0B20] text-white pt-16 pb-12 border-t-4 border-[#FFC400]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-red-900/80">
          
          {/* Col 1: Amansocean Brand, Logo, Pitch (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              {/* Circular Red/Yellow Logo Badge */}
              <div className="w-12 h-12 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-black text-xl shadow-lg border-2 border-[#FFC400]">
                AO
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-2xl tracking-tight text-white font-heading">
                  Amansocean
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFC400]">
                  Ocean Fresh · Delivered Frozen
                </span>
              </div>
            </div>

            <p className="text-sm text-red-100/90 font-medium leading-relaxed max-w-sm">
              We connect wild sustainable fisheries with rapid deep-freeze technology. Every prawn, fish fillet, and ready meal arrives at your doorstep frozen solid.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Twitter / X"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-extrabold text-base text-[#FFC400] tracking-wide uppercase text-xs">
              Explore
            </h4>
            <ul className="space-y-2 text-sm text-red-100 font-medium">
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Our Shop</a>
              </li>
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Wild Seafood</a>
              </li>
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Ready Meals</a>
              </li>
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Crispy Sides</a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Cool Treats</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Delivery & Service (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-extrabold text-base text-[#FFC400] tracking-wide uppercase text-xs">
              Delivery
            </h4>
            <ul className="space-y-2 text-sm text-red-100 font-medium">
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Cold Chain Protocol</a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Dry Ice Safety</a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Delivery Zones</a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Next-Day Dispatch</a>
              </li>
              <li>
                <button 
                  onClick={onSignIn} 
                  className="hover:text-white transition-colors text-left font-bold text-amber-200"
                >
                  Staff & Admin Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter / Stay Updated (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-extrabold text-base text-[#FFC400] tracking-wide uppercase text-xs">
              Fresh Catch Alerts
            </h4>
            <p className="text-xs text-red-100/90 leading-relaxed font-medium">
              Subscribe to get seasonal catch alerts and $10 off your first flash-frozen ocean order.
            </p>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thank you for subscribing to Amansocean Catch Alerts!');
              }}
              className="space-y-2"
            >
              <div className="flex rounded-full overflow-hidden bg-white/10 p-1 border border-white/20">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="w-full px-3 py-1.5 text-xs text-white placeholder-red-200 bg-transparent focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full bg-[#FFC400] text-[#1A1A1A] font-extrabold text-xs hover:bg-amber-300 transition-colors shrink-0"
                >
                  Join
                </button>
              </div>
            </form>
            <div className="flex items-center gap-1.5 text-[11px] text-red-200 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FFC400]" />
              <span>Zero spam · Unsubscribe anytime</span>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright line + Back to top */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-red-200/90 font-medium">
          <p>© 2026 Amansocean. All rights reserved.</p>
          
          <div className="flex items-center gap-6">
            <button
              onClick={() => onOpenLegal && onOpenLegal('privacy')}
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onOpenLegal && onOpenLegal('terms')}
              className="hover:text-white transition-colors"
            >
              Terms of Service
            </button>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-[#FFC400] hover:text-white transition-colors font-bold ml-2"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
