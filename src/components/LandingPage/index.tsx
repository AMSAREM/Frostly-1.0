import React, { useState } from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';
import { LandingCopilotDemo } from './LandingCopilotDemo';
import { LandingCompliance } from './LandingCompliance';
import { LandingPricing } from './LandingPricing';
import { LandingTestimonials } from './LandingTestimonials';
import { LandingFaq } from './LandingFaq';
import { LandingFooter } from './LandingFooter';
import { FeedbackModal } from './FeedbackModal';
import { LegalModal } from '../LegalModal';
import { PWAInstallModal } from '../PWAInstallModal';
import { usePWAInstall } from '../../utils/pwa';

export interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onExploreDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onGetStarted,
  onExploreDemo
}) => {
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false);
  const [pwaModalOpen, setPwaModalOpen] = useState<boolean>(false);
  const { isInstallable, isInstalled, isIOS, isStandalone, triggerInstall } = usePWAInstall();

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await triggerInstall();
      if (!accepted) {
        setPwaModalOpen(true);
      }
    } else {
      setPwaModalOpen(true);
    }
  };

  const [legalModal, setLegalModal] = useState<{
    isOpen: boolean;
    type: 'privacy' | 'terms' | 'sitemap';
  }>({
    isOpen: false,
    type: 'privacy'
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* Header */}
      <LandingHeader
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
        onExploreDemo={onExploreDemo}
        onInstallApp={handleInstallClick}
        isInstalled={isInstalled}
      />

      {/* Hero Section (Matching Microsoft 365 Outlook Reference) */}
      <LandingHero
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
        onExploreDemo={onExploreDemo}
        onOpenFeedback={() => setFeedbackOpen(true)}
        onInstallApp={handleInstallClick}
        isInstalled={isInstalled}
      />

      {/* Core Feature Showcase */}
      <LandingFeatures />

      {/* AI Catch Intelligence / Frostly Copilot */}
      <LandingCopilotDemo />

      {/* Compliance & Regulatory (FSMA 204 & HACCP) */}
      <LandingCompliance />

      {/* Transparent Pricing Plans */}
      <LandingPricing
        onSelectPlan={(planName) => {
          onGetStarted();
        }}
      />

      {/* Customer Testimonials & Proof */}
      <LandingTestimonials />

      {/* FAQ Accordion */}
      <LandingFaq />

      {/* Microsoft-Style Footer */}
      <LandingFooter
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
        onOpenLegal={(type) => setLegalModal({ isOpen: true, type })}
      />

      {/* Floating Feedback Modal */}
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

      {/* PWA Install Modal */}
      <PWAInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        onInstall={async () => {
          await triggerInstall();
          setPwaModalOpen(false);
        }}
        isIOS={isIOS}
        isInstallable={isInstallable}
        isStandalone={isStandalone}
      />

    </div>
  );
};

export default LandingPage;
