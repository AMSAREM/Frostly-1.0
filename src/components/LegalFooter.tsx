import React from 'react';
import { ShieldCheck, FileText, Globe, ExternalLink, Bot } from 'lucide-react';

interface LegalFooterProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenSitemap: () => void;
}

export const LegalFooter: React.FC<LegalFooterProps> = ({
  onOpenPrivacy,
  onOpenTerms,
  onOpenSitemap
}) => {
  return (
    <footer 
      id="platform-legal-footer" 
      className="mt-auto border-t border-slate-200/80 bg-white/70 backdrop-blur-xs py-5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left branding and copyright */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
            F
          </div>
          <span className="font-semibold text-slate-800">Frostly Seafood Platform</span>
          <span className="text-slate-300">•</span>
          <span>© {new Date().getFullYear()} All rights reserved</span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="hidden sm:inline text-slate-400">HACCP Cold-Chain &amp; POS ERP</span>
        </div>

        {/* Middle/Right Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-medium">
          <button
            id="footer-privacy-btn"
            type="button"
            onClick={onOpenPrivacy}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>

          <button
            id="footer-terms-btn"
            type="button"
            onClick={onOpenTerms}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            Terms &amp; Conditions
          </button>

          <button
            id="footer-sitemap-btn"
            type="button"
            onClick={onOpenSitemap}
            className="hover:text-slate-900 transition-colors cursor-pointer"
          >
            Sitemap
          </button>

          <a
            id="footer-robots-link"
            href="/robots.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
            title="View web crawler directives"
          >
            <Bot className="w-3.5 h-3.5 text-slate-400" />
            <span>Robots.txt</span>
          </a>

          <a
            id="footer-xml-sitemap-link"
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
            title="View XML sitemap"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>XML Sitemap</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
