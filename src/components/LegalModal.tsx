import React from 'react';
import { 
  X, 
  ShieldCheck, 
  FileText, 
  Lock, 
  Eye, 
  Database, 
  Server, 
  CheckCircle2, 
  Scale, 
  ExternalLink 
} from 'lucide-react';

interface LegalModalProps {
  type: 'privacy' | 'terms' | 'sitemap';
  isOpen: boolean;
  onClose: () => void;
  onSwitchType?: (type: 'privacy' | 'terms' | 'sitemap') => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  type,
  isOpen,
  onClose,
  onSwitchType
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
              {type === 'privacy' && <Lock className="w-4.5 h-4.5" />}
              {type === 'terms' && <FileText className="w-4.5 h-4.5" />}
              {type === 'sitemap' && <Scale className="w-4.5 h-4.5" />}
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-base font-bold text-slate-900 font-heading">
                {type === 'privacy' && 'Privacy Policy'}
                {type === 'terms' && 'Terms of Service & Licensing'}
                {type === 'sitemap' && 'Platform Sitemap & Architecture'}
              </h2>
              <p className="text-xs text-slate-500">
                Frostly Seafood ERP Platform • Last updated September 2026
              </p>
            </div>
          </div>

          <button
            id="btn-close-legal-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close legal modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 leading-relaxed">
          {type === 'privacy' && (
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">1. Operational Commitment & Data Ownership</h3>
                <p>
                  Frostly operates under strict multi-tenant data segregation. Your seafood inventory, vessel landing slips, HACCP critical temperature audits, supplier accounts, and sales ledger entries remain exclusively owned by your enterprise organization.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">2. Local-First Caching & Offline Processing</h3>
                <p>
                  In accordance with dockside and offshore cold-storage working conditions, operational records are cached locally in your browser’s encrypted IndexedDB and LocalStorage. Synchronized transactions are transmitted with end-to-end TLS 1.3 encryption.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">3. Payment & Billing Gateways</h3>
                <p>
                  Payment processing is facilitated directly by licensed, PCI-DSS Level 1 certified gateways (Paystack for Mobile Money/GHS and Stripe for Card/USD). Frostly does not record, store, or transmit raw credit card credentials or Mobile Money authorization PINs.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">4. HACCP Compliance & Regulatory Disclosures</h3>
                <p>
                  Regulatory export data (such as FDA food facility registration numbers and EU seafood approval identifiers) entered in system settings is strictly utilized for automated label rendering, export catch certifications, and traceability passports.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">5. Tenant Deprovisioning & Right to Erasure</h3>
                <p>
                  Organization administrators retain the continuous right to export complete business data in structured JSON format and initiate immediate, irreversible permanent deletion of all tenant data via the Tenant Danger Zone.
                </p>
              </section>
            </div>
          )}

          {type === 'terms' && (
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">1. Platform License & Acceptance of Terms</h3>
                <p>
                  By deploying and accessing the Frostly Seafood Business Platform, your enterprise agrees to these Terms of Service. Frostly grants your organization a non-exclusive, non-transferable subscription license to operate dockside inventory, cold-chain HACCP logging, and POS order fulfillment.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">2. Free Trial & Evaluation Grace Period</h3>
                <p>
                  New organizations receive a 14-day evaluation trial with unlimited feature access. Upon trial expiration, the account transitions to read-only audit mode until a recurring plan (Starter, Standard, or Enterprise) is selected. During audit grace periods, regulatory food safety records remain fully accessible for inspection.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">3. Staff Seat Allocations & Quotas</h3>
                <p>
                  Each subscription tier enforces a database-level staff seat ceiling. Administrator accounts must adjust tier selections when expanding active operations to accommodate additional dock workers or sales clerks.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">4. Food Safety & Temperature Liability</h3>
                <p>
                  Frostly provides sensor logging interfaces and automated critical limit threshold alerts (-18°C frozen storage, 0–4°C chilled wet fish). However, physical product temperature integrity, refrigeration hardware uptime, and regulatory hygiene certifications remain the sole responsibility of the facility operator.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">5. Service Availability & Offline Guarantees</h3>
                <p>
                  The platform utilizes Progressive Web App (PWA) Service Workers to guarantee uninterrupted point-of-sale and batch intake during local telecom or internet outages. Disconnected transactions queue locally and reconcile automatically upon network restoration.
                </p>
              </section>
            </div>
          )}

          {type === 'sitemap' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                A complete navigational index of public and tenant operational views across the Frostly platform.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
                  <div className="font-bold text-slate-900 text-xs">Core Operations</div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    <li>• <strong>Dashboard Overview</strong>: KPI metrics, cryo storage breakdown, recent catch</li>
                    <li>• <strong>Dual POS & Wholesale</strong>: Walk-in retail counter, wholesale invoices, catch-weight</li>
                    <li>• <strong>Cold-Chain Inventory</strong>: Batch ledger, temperature logs, traceability passports</li>
                  </ul>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
                  <div className="font-bold text-slate-900 text-xs">Ledger & Relationships</div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    <li>• <strong>Customers & Accounts</strong>: Client balance, purchase history, payment receipting</li>
                    <li>• <strong>Vessels & Harvesters</strong>: Landing tickets, species intake, settlement disbursements</li>
                    <li>• <strong>Financials (P&L)</strong>: Real-time net margin, revenue tracking, expense logs</li>
                  </ul>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
                  <div className="font-bold text-slate-900 text-xs">Administration & Compliance</div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    <li>• <strong>System Settings</strong>: Facility FDA/EU registration, unit conversions, currency</li>
                    <li>• <strong>Workers & Team</strong>: Staff profiles, roles (admin, ops, sales), seat limits</li>
                    <li>• <strong>Subscription & Billing</strong>: MoMo (Paystack) & Card (Stripe) gateways</li>
                  </ul>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
                  <div className="font-bold text-slate-900 text-xs">SEO & Regulatory Endpoints</div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    <li>• <code>/sitemap.xml</code>: Search index definition</li>
                    <li>• <code>/robots.txt</code>: Web crawler directives</li>
                    <li>• <code>/manifest.json</code>: PWA installation manifest</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {onSwitchType && (
              <>
                <button
                  type="button"
                  onClick={() => onSwitchType('privacy')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    type === 'privacy' 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchType('terms')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    type === 'terms' 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Terms &amp; Conditions
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchType('sitemap')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    type === 'sitemap' 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Sitemap
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all shadow-xs cursor-pointer ml-auto"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
