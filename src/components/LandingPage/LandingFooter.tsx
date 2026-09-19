import React, { useState } from 'react';
import { Globe, ShieldCheck, CheckCircle2, Phone, Mail, Copy, Check, X, Headphones } from 'lucide-react';
import { FrostlyLogo } from '../FrostlyLogo';

interface LandingFooterProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onOpenLegal: (type: 'privacy' | 'terms' | 'sitemap') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onSignIn,
  onGetStarted,
  onOpenLegal
}) => {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };
  return (
    <footer className="bg-white border-t border-slate-200 text-left text-xs text-slate-500">
      
      {/* Top Pre-Footer Call to Action */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Ready to streamline your seafood operations?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto">
            Join commercial fleets and cold storage operators who rely on Frostly every day for catch weighing, cold chain integrity, and dual fulfillment.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3 rounded-md shadow-md transition-all active:scale-95 text-sm sm:text-base"
            >
              Start 14-Day Free Trial
            </button>
            <button
              onClick={onSignIn}
              className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-semibold px-6 py-3 rounded-md transition-all active:scale-95 text-sm sm:text-base"
            >
              Sign In to Organization
            </button>
          </div>
        </div>
      </div>

      {/* Main 5-Column Sitemap */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          
          {/* Col 1: Brand & Overview */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <FrostlyLogo size={22} iconOnly variant="blue" />
              <span className="font-bold text-base text-slate-900">Frostly</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              The modern operating system for the commercial seafood cold chain.
            </p>
            <div className="mt-4 flex items-center gap-2 text-emerald-600 font-semibold">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <div className="font-bold text-slate-900 uppercase tracking-wider mb-3">
              Product
            </div>
            <ul className="space-y-2">
              <li><a href="#features" className="hover:text-slate-900 transition-colors">Catch Inward & Scales</a></li>
              <li><a href="#features" className="hover:text-slate-900 transition-colors">Cold Storage & HACCP</a></li>
              <li><a href="#features" className="hover:text-slate-900 transition-colors">Retail Touch POS</a></li>
              <li><a href="#features" className="hover:text-slate-900 transition-colors">B2B Wholesale Orders</a></li>
              <li><a href="#copilot" className="hover:text-slate-900 transition-colors">AI Catch Copilot</a></li>
            </ul>
          </div>

          {/* Col 3: Compliance & Trust */}
          <div>
            <div className="font-bold text-slate-900 uppercase tracking-wider mb-3">
              Compliance
            </div>
            <ul className="space-y-2">
              <li><a href="#traceability" className="hover:text-slate-900 transition-colors">FDA FSMA 204 Rule</a></li>
              <li><a href="#traceability" className="hover:text-slate-900 transition-colors">HACCP Critical Points</a></li>
              <li><a href="#traceability" className="hover:text-slate-900 transition-colors">Cryptographic QR Passports</a></li>
              <li><a href="#traceability" className="hover:text-slate-900 transition-colors">EU Catch Certificates</a></li>
              <li><a href="#traceability" className="hover:text-slate-900 transition-colors">Multi-Tenant Security</a></li>
            </ul>
          </div>

          {/* Col 4: Solutions */}
          <div>
            <div className="font-bold text-slate-900 uppercase tracking-wider mb-3">
              Solutions
            </div>
            <ul className="space-y-2">
              <li><span className="hover:text-slate-900 cursor-pointer">Fishing Fleets & Vessels</span></li>
              <li><span className="hover:text-slate-900 cursor-pointer">Cold Storage Facilities</span></li>
              <li><span className="hover:text-slate-900 cursor-pointer">Seafood Processing Plants</span></li>
              <li><span className="hover:text-slate-900 cursor-pointer">Wholesale Exporters</span></li>
              <li><span className="hover:text-slate-900 cursor-pointer">Waterfront Fishmongers</span></li>
            </ul>
          </div>

          {/* Col 5: Company & Legal */}
          <div>
            <div className="font-bold text-slate-900 uppercase tracking-wider mb-3">
              Company & Legal
            </div>
            <ul className="space-y-2">
              <li><button onClick={() => onOpenLegal('privacy')} className="hover:text-slate-900">Privacy Policy</button></li>
              <li><button onClick={() => onOpenLegal('terms')} className="hover:text-slate-900">Terms of Service</button></li>
              <li><button onClick={() => onOpenLegal('sitemap')} className="hover:text-slate-900">Platform Architecture</button></li>
              <li>
                <button 
                  onClick={() => setIsContactOpen(true)} 
                  className="hover:text-slate-900 cursor-pointer text-left transition-colors flex flex-col group"
                  title="Contact Support: 0554234590 / amoakoimml@gmail.com"
                >
                  <span className="group-hover:text-blue-600 transition-colors font-medium">Contact Support</span>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5">0554234590</span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[170px]">amoakoimml@gmail.com</span>
                </button>
              </li>
              <li><button onClick={onSignIn} className="hover:text-slate-900 font-semibold text-blue-700">Staff Portal</button></li>
            </ul>
          </div>

        </div>

        {/* Bottom Legal Bar (Microsoft style) */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="hover:text-slate-600 cursor-pointer">English (United States)</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <button onClick={() => onOpenLegal('privacy')} className="hover:text-slate-600">Privacy & Cookies</button>
            <button onClick={() => onOpenLegal('terms')} className="hover:text-slate-600">Terms of Use</button>
            <button onClick={() => onOpenLegal('sitemap')} className="hover:text-slate-600">Compliance Specs</button>
            <span>© 2026 Frostly Technologies, Inc. All rights reserved.</span>
          </div>
        </div>

      </div>

      {/* Contact Support Dialog Modal */}
      {isContactOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsContactOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">Frostly Support</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Cold-chain logistics & platform helpdesk</p>
                </div>
              </div>
              <button
                onClick={() => setIsContactOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Channels */}
            <div className="mt-5 space-y-3">
              {/* Phone Channel */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Phone Support</div>
                    <a 
                      href="tel:0554234590"
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors font-mono"
                    >
                      0554234590
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy('0554234590', 'phone')}
                    className="p-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors inline-flex items-center gap-1"
                    title="Copy phone number"
                  >
                    {copiedKey === 'phone' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[11px]">{copiedKey === 'phone' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href="tel:0554234590"
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    Call
                  </a>
                </div>
              </div>

              {/* Email Channel */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Helpdesk</div>
                    <a 
                      href="mailto:amoakoimml@gmail.com"
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors truncate block"
                    >
                      amoakoimml@gmail.com
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy('amoakoimml@gmail.com', 'email')}
                    className="p-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors inline-flex items-center gap-1"
                    title="Copy email address"
                  >
                    {copiedKey === 'email' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[11px]">{copiedKey === 'email' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href="mailto:amoakoimml@gmail.com"
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Email
                  </a>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Response time: Under 1 hour</span>
              <button 
                onClick={() => setIsContactOpen(false)}
                className="text-slate-500 hover:text-slate-800 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
