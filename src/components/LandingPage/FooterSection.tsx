import React, { useState } from 'react';
import { 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube, 
  ShieldCheck,
  ArrowUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MessageSquare,
  PackageSearch
} from 'lucide-react';
import { subscribeStorefrontNewsletter } from '../../services/storefrontService';
import {
  AMANSOCEAN_LOCATION,
  AMANSOCEAN_CONTACT_PHONE,
} from '../../data/amansoceanProducts';

interface FooterSectionProps {
  onSignIn?: () => void;
  onOpenLegal?: (type: 'privacy' | 'terms') => void;
  onOpenTrackOrder?: () => void;
  onOpenFeedback?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({
  onSignIn,
  onOpenLegal,
  onOpenTrackOrder,
  onOpenFeedback,
}) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [submittingNewsletter, setSubmittingNewsletter] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubmittingNewsletter(true);
    setNewsletterStatus(null);
    try {
      const result = await subscribeStorefrontNewsletter(newsletterEmail.trim());
      setNewsletterStatus({
        type: 'success',
        text: result.message,
      });
      setNewsletterEmail('');
    } catch (err: any) {
      setNewsletterStatus({
        type: 'error',
        text: err?.message || 'Unable to subscribe right now. Please try again.',
      });
    } finally {
      setSubmittingNewsletter(false);
    }
  };

  return (
    <footer id="footer-about" className="bg-[#9B0B20] text-white pt-16 pb-12 border-t-4 border-[#FFC400]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-red-900/80">
          
          {/* Col 1: Amansocean Brand, Logo, Pitch (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-black text-xl shadow-lg border-2 border-[#FFC400]">
                AO
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-2xl tracking-tight text-white font-heading">
                  Amansocean
                </span>
                <span className="text-[11px] font-bold tracking-wide text-[#FFC400]">
                  Ocean Fresh · Delivered Frozen
                </span>
              </div>
            </div>

            <p className="text-sm text-red-100/90 font-medium leading-relaxed max-w-sm">
              Official coldstore supply of wild ocean fish, boneless fillets, jumbo prawns, shellfish, and pure milled fish &amp; shrimp powders.
            </p>
            <div className="text-xs text-amber-200 font-semibold space-y-0.5">
              <div>{AMANSOCEAN_LOCATION}</div>
              <div className="tabular-nums">Tel / WhatsApp: {AMANSOCEAN_CONTACT_PHONE}</div>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="#footer-about"
                onClick={(e) => e.preventDefault()}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#footer-about"
                onClick={(e) => e.preventDefault()}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#footer-about"
                onClick={(e) => e.preventDefault()}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="Twitter / X"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#footer-about"
                onClick={(e) => e.preventDefault()}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#FFC400] hover:text-[#1A1A1A] text-white flex items-center justify-center transition-colors shadow-xs"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-extrabold text-xs text-[#FFC400] tracking-wide">
              Explore
            </h4>
            <ul className="space-y-2 text-sm text-red-100 font-medium">
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Whole Fish</a>
              </li>
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Fillets &amp; Chunks</a>
              </li>
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Shrimps &amp; Prawns</a>
              </li>
              <li>
                <a href="#shop" className="hover:text-white transition-colors">Shellfish &amp; Lobster</a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Fish &amp; Shrimp Powders</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Delivery & Customer Care (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-extrabold text-xs text-[#FFC400] tracking-wide">
              Customer Care
            </h4>
            <ul className="space-y-2 text-sm text-red-100 font-medium">
              {onOpenTrackOrder && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenTrackOrder}
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors text-left font-bold text-[#FFC400] cursor-pointer"
                  >
                    <PackageSearch className="w-3.5 h-3.5 shrink-0" />
                    <span>Track My Order</span>
                  </button>
                </li>
              )}
              {onOpenFeedback && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenFeedback}
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors text-left cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>Send Feedback</span>
                  </button>
                </li>
              )}
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Cold Chain Protocol</a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition-colors">Next-Day Dispatch</a>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={onSignIn} 
                  className="hover:text-white transition-colors text-left font-bold text-amber-200 cursor-pointer"
                >
                  Staff &amp; Admin Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter / Stay Updated (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-extrabold text-xs text-[#FFC400] tracking-wide">
              Fresh Catch Alerts
            </h4>
            <p className="text-xs text-red-100/90 leading-relaxed font-medium">
              Subscribe to receive weekly wild-catch drops and seasonal coldstore offers.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-2">
              <div className="flex rounded-full overflow-hidden bg-white/10 p-1 border border-white/20">
                <label htmlFor="footer-newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3 py-1.5 text-xs text-white placeholder-red-200 bg-transparent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingNewsletter}
                  className="px-4 py-1.5 rounded-full bg-[#FFC400] disabled:opacity-60 text-[#1A1A1A] font-extrabold text-xs hover:bg-amber-300 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  {submittingNewsletter ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Join</span>
                  )}
                </button>
              </div>
              {newsletterStatus && (
                <div
                  className={`flex items-start gap-1.5 text-xs font-semibold pt-1 ${
                    newsletterStatus.type === 'success' ? 'text-emerald-300' : 'text-amber-200'
                  }`}
                >
                  {newsletterStatus.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  )}
                  <span>{newsletterStatus.text}</span>
                </div>
              )}
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
          
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Customer Feedback
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal && onOpenLegal('terms')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-[#FFC400] hover:text-white transition-colors font-bold ml-2 cursor-pointer"
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
