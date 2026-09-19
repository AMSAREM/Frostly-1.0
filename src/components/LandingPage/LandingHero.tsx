import React, { useState } from 'react';
import { 
  ChevronRight, 
  Sparkles, 
  Paperclip, 
  AtSign, 
  Send, 
  CheckCircle2, 
  Smartphone, 
  Laptop, 
  Anchor, 
  ThermometerSnowflake, 
  Fish, 
  Scale, 
  ShieldCheck, 
  Layers, 
  ArrowUpRight,
  Plane,
  MapPin,
  Check,
  Search,
  MessageSquare
} from 'lucide-react';

interface LandingHeroProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onExploreDemo: () => void;
  onOpenFeedback: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSignIn,
  onGetStarted,
  onExploreDemo,
  onOpenFeedback
}) => {
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [promptSubmitted, setPromptSubmitted] = useState(false);
  const [isCopilotTyping, setIsCopilotTyping] = useState(false);

  const samplePrompts = [
    "Summarize today's catch yield",
    "Audit cold-chain temp logs for Pier 38",
    "Calculate HOG-to-fillet margins for Cod #4028",
    "Check pending wholesale orders ready for dispatch"
  ];

  const handlePromptSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsCopilotTyping(true);
    setPromptSubmitted(true);
    setTimeout(() => {
      setIsCopilotTyping(false);
    }, 700);
  };

  const handleCyclePrompt = (idx: number) => {
    setActivePromptIndex(idx);
    setPromptSubmitted(false);
    setIsCopilotTyping(false);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/60 to-white pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Subtle Ambient Background Light */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-10 w-72 h-72 bg-sky-100/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Microsoft-Style Typography & Primary Calls to Action         */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-center text-left">
            
            {/* Main Headline - Exactly matching the reference's two-line visual cadence */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] xl:text-[62px] font-semibold text-slate-900 tracking-tight leading-[1.08]">
              Your catch, organized.
              <br />
              <span className="text-slate-900">Your operations, planned.</span>
            </h1>

            {/* Sub-headline Paragraph */}
            <p className="mt-6 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
              Stay on top of dockside catch inward logs, cold-storage lots, HACCP compliance, and wholesale & retail fulfillment in one place. Available on desktop, mobile, and web.
            </p>

            {/* Action Buttons Row */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                onClick={onSignIn}
                id="hero-signin-btn"
                className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-medium text-sm sm:text-base px-7 py-3 rounded-md shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98]"
              >
                Sign in
              </button>

              <button
                onClick={onExploreDemo}
                id="hero-explore-btn"
                className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-900 font-medium text-sm sm:text-base px-6 py-3 rounded-md shadow-xs transition-all duration-150 active:scale-[0.98]"
              >
                Explore Live Demo
              </button>
            </div>

            {/* Tertiary Link: Create free account (matching reference with square chevron) */}
            <div className="mt-6">
              <button
                onClick={onGetStarted}
                id="hero-create-account-link"
                className="group inline-flex items-center gap-2.5 text-sm font-medium text-slate-900 hover:text-blue-700 transition-colors"
              >
                <div className="w-5 h-5 rounded bg-slate-900 group-hover:bg-blue-700 flex items-center justify-center text-white transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
                <span className="group-hover:underline underline-offset-4">Create free account</span>
              </button>
            </div>

            {/* Key Trust Checkpoints */}
            <div className="mt-10 pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-y-3 gap-x-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>FSMA 204 Traceability Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>100% Offline PWA Sync</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Multi-Tenant Encrypted</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: 3D Multi-Device Display Stage (The centerpiece)             */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 relative flex items-center justify-center lg:justify-end">
            
            {/* The 3D Sculptural Pedestal Stage Container */}
            <div className="relative w-full max-w-[660px] aspect-[4/3] sm:aspect-[16/11] flex items-center justify-center select-none">
              
              {/* Pedestal Base Shadow & Beveled Podium (matching reference soft lighting) */}
              <div className="absolute inset-x-4 bottom-2 sm:bottom-4 h-24 sm:h-32 bg-gradient-to-t from-slate-200/80 via-slate-100/60 to-white/0 rounded-[3rem] -z-10 shadow-2xl shadow-slate-300/60" />
              
              {/* Soft 3D curved pedestal deck */}
              <div className="absolute inset-x-8 bottom-6 sm:bottom-8 h-16 sm:h-20 bg-gradient-to-b from-white via-slate-100 to-slate-200/90 rounded-[2.5rem] border-t border-white/80 shadow-inner -z-10" />

              {/* 3D Decorative Stage Accents (Matching Reference) */}
              {/* 1. Dark Blue Floating "HACCP" pill badge (reference has "RSVP") */}
              <div className="absolute -bottom-2 sm:bottom-4 right-2 sm:right-6 z-30 bg-blue-950 text-white font-bold text-[11px] sm:text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-blue-800/60 flex items-center gap-1.5 animate-bounce-subtle">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>HACCP PASS</span>
              </div>

              {/* 2. Floating Location / Cold Zone Pin Pill */}
              <div className="absolute top-10 -left-2 sm:left-4 z-30 bg-white/95 backdrop-blur-md text-slate-800 text-[11px] sm:text-xs font-semibold px-3 py-1.5 rounded-full shadow-md border border-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Pier 38 • Cold Zone A</span>
              </div>

              {/* 3. Dark Circular Accent Button with Paper Plane */}
              <div className="absolute bottom-14 left-2 sm:left-6 z-30 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg border border-slate-700">
                <Plane className="w-4 h-4 -rotate-45 text-sky-400" />
              </div>

              {/* 4. Cylindrical 3D Pedestal Step on Right */}
              <div className="hidden sm:block absolute -right-2 top-28 w-16 h-36 bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-800 rounded-2xl shadow-xl -rotate-12 opacity-85 -z-10 blur-[0.5px]" />


              {/* --------------------------------------------------------------------- */}
              {/* DESKTOP APPLICATION WINDOW (Layered in Background)                    */}
              {/* --------------------------------------------------------------------- */}
              <div className="absolute right-0 top-2 sm:top-4 w-[88%] sm:w-[86%] h-[82%] sm:h-[84%] bg-white rounded-xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col transform hover:scale-[1.01] transition-transform duration-300">
                
                {/* Desktop Window Title Bar */}
                <div className="h-8 bg-slate-100 border-b border-slate-200 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-[11px] font-semibold text-slate-600 tracking-tight hidden sm:inline">
                      Frostly ERP — Tema Cold Storage Terminal
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 px-2 bg-white rounded border border-slate-200 flex items-center text-[10px] text-slate-400 gap-1">
                      <Search className="w-2.5 h-2.5 text-slate-400" />
                      <span>Search lot, vessel, SKU...</span>
                    </div>
                  </div>
                </div>

                {/* Desktop Ribbon / Tab Navigation */}
                <div className="h-7 bg-slate-50/80 border-b border-slate-200/80 px-3 flex items-center gap-4 text-[11px] font-medium text-slate-600 overflow-hidden">
                  <span className="text-blue-700 font-semibold border-b-2 border-blue-600 pb-0.5">Catch Inward</span>
                  <span className="hover:text-slate-900 cursor-pointer hidden sm:inline">Cold Storage</span>
                  <span className="hover:text-slate-900 cursor-pointer hidden sm:inline">Wholesale & POS</span>
                  <span className="hover:text-slate-900 cursor-pointer">Traceability</span>
                  <span className="hover:text-slate-900 cursor-pointer hidden md:inline">Yields & COGS</span>
                </div>

                {/* Desktop Main Body Split View */}
                <div className="flex-1 flex overflow-hidden bg-slate-50/40">
                  
                  {/* Left Lot List Pane */}
                  <div className="w-2/5 border-r border-slate-200 p-2.5 flex flex-col gap-2 overflow-hidden bg-white">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider pb-1 border-b border-slate-100">
                      <span>Recent Harvest Batches</span>
                      <span className="text-emerald-600 font-bold">100% Synced</span>
                    </div>

                    {/* Active Lot Item Card */}
                    <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-900">Lot #4028 — Atlantic Cod</span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">Passed</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Vessel: F/V Northern Star</div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className="font-semibold text-slate-800">2,450 kg Net</span>
                        <span className="text-blue-700 font-medium">-18.6°C Core</span>
                      </div>
                    </div>

                    {/* Secondary Lot Item Card */}
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-left hidden sm:block">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-800">Lot #4029 — Wild Sockeye</span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">Holding</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Vessel: Atlantic Pride</div>
                      <div className="flex items-center justify-between mt-1 text-[10px]">
                        <span className="font-semibold text-slate-700">1,180 kg Net</span>
                        <span className="text-slate-600 font-medium">-20.1°C Core</span>
                      </div>
                    </div>

                    {/* Tertiary Lot */}
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-left hidden sm:block">
                      <div className="text-[11px] font-medium text-slate-700">Lot #4030 — Yellowfin Loins</div>
                      <div className="text-[10px] text-slate-400">Blast Freezer Bay 2 • 840 kg</div>
                    </div>
                  </div>

                  {/* Center / Right Inspection Pane with Copilot Assistant */}
                  <div className="flex-1 p-3 flex flex-col justify-between bg-white text-left">
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[12px] sm:text-[13px] font-bold text-slate-900">
                            Catch-Weight Weigher & FSMA 204
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Digital Catch Certificate • Station Scale #02
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Verified KDEs
                        </span>
                      </div>

                      {/* Weight Breakdown Metrics */}
                      <div className="grid grid-cols-3 gap-1.5 mt-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Gross</div>
                          <div className="text-[11px] sm:text-xs font-bold text-slate-800">2,485 kg</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Tare</div>
                          <div className="text-[11px] sm:text-xs font-bold text-slate-500">35 kg</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-emerald-600 font-bold">Net Catch</div>
                          <div className="text-[11px] sm:text-xs font-bold text-emerald-700">2,450 kg</div>
                        </div>
                      </div>

                      {/* Copilot Assistant Chat Preview in Desktop App */}
                      <div className="mt-2.5 p-2 rounded-lg bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 text-[10px] sm:text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-blue-900">
                          <Sparkles className="w-3 h-3 text-blue-600" />
                          <span>Frostly Copilot:</span>
                        </div>
                        <p className="text-slate-600 text-[10px] mt-0.5 leading-snug">
                          {isCopilotTyping ? (
                            <span className="animate-pulse text-blue-600 font-medium">Analyzing catch lots and cold temperatures...</span>
                          ) : promptSubmitted ? (
                            <span>Lot #4028 (Atlantic Cod) meets all FSMA 204 criteria. Estimated fillet yield: 1,372 kg (56.0%) with zero core temp breaches.</span>
                          ) : (
                            <span>Today's catch total: 4,470 kg across 3 vessels. All lots within safe cold-chain thresholds (-18.4°C average).</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Desktop Footer Quick Actions */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Offline PWA: Active</span>
                      <div className="flex gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded hover:bg-slate-200 cursor-pointer">
                          Print QR
                        </span>
                        <span className="px-2 py-0.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 cursor-pointer">
                          Dispatch
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>


              {/* --------------------------------------------------------------------- */}
              {/* TILTED MOBILE DEVICE MOCKUP (Front Left Perspective)                  */}
              {/* --------------------------------------------------------------------- */}
              <div className="absolute left-0 sm:left-4 bottom-8 sm:bottom-12 w-[180px] sm:w-[220px] aspect-[9/19] bg-slate-900 rounded-[2.2rem] p-2 sm:p-2.5 shadow-2xl border-4 border-slate-800 transform -rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 z-20">
                
                {/* Mobile Device Inner Screen */}
                <div className="w-full h-full bg-white rounded-[1.8rem] overflow-hidden flex flex-col text-left">
                  
                  {/* Phone Status Bar */}
                  <div className="h-5 bg-slate-900 px-3 flex items-center justify-between text-[9px] text-white">
                    <span>9:41</span>
                    <div className="w-12 h-2.5 bg-slate-800 rounded-full" />
                    <span>5G 100%</span>
                  </div>

                  {/* Phone App Header */}
                  <div className="p-2 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold tracking-tight">Frostly Mobile</div>
                      <div className="text-[8px] text-blue-200">Dockside Catch Inward</div>
                    </div>
                    <div className="w-4 h-4 rounded-full bg-blue-500/50 flex items-center justify-center text-[8px]">
                      ⚡
                    </div>
                  </div>

                  {/* Focused / All Lots Segmented Control */}
                  <div className="px-2 py-1 bg-slate-100 flex gap-1 text-[8px] font-semibold">
                    <span className="px-1.5 py-0.5 bg-white text-blue-700 rounded shadow-xs font-bold">Focused</span>
                    <span className="px-1.5 py-0.5 text-slate-500">All Lots</span>
                  </div>

                  {/* Phone Catch Lot Cards */}
                  <div className="flex-1 p-1.5 space-y-1.5 overflow-hidden bg-slate-50">
                    <div className="p-1.5 bg-white rounded-md border border-slate-200 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-800">F/V Northern Star</span>
                        <span className="text-[7px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded">Passed</span>
                      </div>
                      <div className="text-[8px] text-slate-500">Atlantic Cod • 2,450 kg</div>
                      <div className="text-[7px] text-blue-600 font-semibold mt-0.5">Temp: -18.4°C Core</div>
                    </div>

                    <div className="p-1.5 bg-white rounded-md border border-slate-200 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-800">Atlantic Pride</span>
                        <span className="text-[7px] bg-sky-100 text-sky-700 font-bold px-1 rounded">Docked</span>
                      </div>
                      <div className="text-[8px] text-slate-500">Wild Sockeye • 1,180 kg</div>
                      <div className="text-[7px] text-slate-500 mt-0.5">Pier 38 Berth 3</div>
                    </div>

                    <div className="p-1.5 bg-white rounded-md border border-slate-200 shadow-xs">
                      <div className="text-[9px] font-bold text-slate-800">Bluefin Loins</div>
                      <div className="text-[8px] text-slate-400">840 kg • Bay 2 Frozen</div>
                    </div>
                  </div>

                  {/* Mobile Floating Action Button */}
                  <div className="p-1.5 bg-white border-t border-slate-100 flex items-center justify-center">
                    <div className="w-full py-1 rounded bg-blue-600 text-white font-bold text-[8px] text-center shadow-xs flex items-center justify-center gap-1">
                      <span>+ New Catch Lot</span>
                    </div>
                  </div>

                  {/* Phone Bottom Navigation Bar */}
                  <div className="h-5 bg-slate-100 border-t border-slate-200 flex items-center justify-around text-[8px] text-slate-400">
                    <span className="text-blue-600 font-bold">Inward</span>
                    <span>Cold</span>
                    <span>POS</span>
                    <span>Sync</span>
                  </div>
                </div>
              </div>


              {/* --------------------------------------------------------------------- */}
              {/* FLOATING COPILOT AI PROMPT PILL (The signature centerpiece element)   */}
              {/* --------------------------------------------------------------------- */}
              <div className="absolute -bottom-5 sm:-bottom-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-1/3 z-40 w-[92%] sm:w-[380px]">
                <form 
                  onSubmit={handlePromptSubmit}
                  className="bg-white/95 backdrop-blur-md rounded-full px-3.5 py-2 sm:py-2.5 shadow-xl border border-slate-200/90 flex items-center justify-between gap-2 hover:shadow-2xl transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* Microsoft Copilot-style 4-color AI emblem */}
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                      <Sparkles className="w-3 h-3" />
                    </div>

                    {/* Interactive Animated / Cycleable Prompt Text */}
                    <input
                      type="text"
                      value={samplePrompts[activePromptIndex]}
                      onChange={() => {}}
                      onClick={() => handleCyclePrompt((activePromptIndex + 1) % samplePrompts.length)}
                      title="Click to cycle example prompts or press enter"
                      className="bg-transparent border-none p-0 text-xs sm:text-sm text-slate-800 font-medium focus:outline-none cursor-pointer truncate w-full"
                    />
                  </div>

                  {/* Prompt Quick Actions: Paperclip, At-Sign, Send Arrow */}
                  <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleCyclePrompt((activePromptIndex + 1) % samplePrompts.length)}
                      className="p-1 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
                      title="Attach file / lot manifest"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCyclePrompt((activePromptIndex + 1) % samplePrompts.length)}
                      className="p-1 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
                      title="Reference vessel or lot"
                    >
                      <AtSign className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="submit"
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-xs active:scale-90"
                      title="Send prompt to Frostly Copilot"
                    >
                      <Send className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Floating Bottom-Left Feedback Button (Matching exact reference image) */}
      <button
        onClick={onOpenFeedback}
        id="landing-feedback-btn"
        className="fixed bottom-0 left-6 z-40 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold px-4 py-2.5 rounded-t-md shadow-2xl border-t border-x border-slate-700/60 flex items-center gap-1.5 transition-all duration-150 active:translate-y-0.5"
      >
        <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
        <span>Feedback</span>
      </button>
    </section>
  );
};
