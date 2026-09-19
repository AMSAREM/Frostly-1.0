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
      />

      {/* Hero Section (Matching Microsoft 365 Outlook Reference) */}
      <LandingHero
        onSignIn={onSignIn}
        onGetStarted={onGetStarted}
        onExploreDemo={onExploreDemo}
        onOpenFeedback={() => setFeedbackOpen(true)}
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

    </div>
  );
};

export default LandingPage;
