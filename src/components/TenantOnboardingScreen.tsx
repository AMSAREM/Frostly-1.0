import React, { useState } from 'react';
import { 
  Snowflake, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  LogOut, 
  Building2, 
  Coins, 
  Anchor, 
  ShieldCheck, 
  Sparkles,
  ThermometerSnowflake,
  Fish,
  Ship,
  Truck
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { createOrganizationAndAdmin } from '../data/auth';
import { FacilityOperationType } from '../types';

interface TenantOnboardingScreenProps {
  user: User;
  onCompleted: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
}

interface FacilityTypeOption {
  id: FacilityOperationType;
  title: string;
  tagline: string;
  icon: React.ElementType;
  defaultRooms: string[];
}

const FACILITY_OPTIONS: FacilityTypeOption[] = [
  {
    id: 'cold_storage',
    title: 'Cold Storage & Freezing Facility',
    tagline: 'Multi-zone cryo storage, blast freezing, and cold-chain temperature telemetry.',
    icon: ThermometerSnowflake,
    defaultRooms: ['Cold Room A (-20°C)', 'Blast Freezer #1 (-35°C)', 'Chilled Holding (+2°C)']
  },
  {
    id: 'processing_plant',
    title: 'Seafood Processing & Packing Plant',
    tagline: 'Filleting lines, catch-weight sorting, yield tracking, and HACCP CCP checkpoints.',
    icon: Fish,
    defaultRooms: ['Processing Hall (+10°C)', 'Plate Freezer 2 (-40°C)', 'Pack-out Holding (-18°C)']
  },
  {
    id: 'vessel_operator',
    title: 'Harvester Fleet & Landed Catch Operator',
    tagline: 'Pier weigh-ins, vessel landing manifests, captain tallies, and species grading.',
    icon: Ship,
    defaultRooms: ['Dockside Staging (+1°C)', 'Slush Ice Room (0°C)', 'Deep Hold Cryo (-28°C)']
  },
  {
    id: 'wholesale_distribution',
    title: 'Marine Wholesale & Reefer Distribution',
    tagline: 'Customer credit limits, wholesale packing slips, and direct retail sales.',
    icon: Truck,
    defaultRooms: ['Distribution Hub (-18°C)', 'Pick & Pack Zone (+4°C)', 'Reefer Dock Bay (-10°C)']
  }
];

export const TenantOnboardingScreen: React.FC<TenantOnboardingScreenProps> = ({
  user,
  onCompleted,
  onSignOut
}) => {
  // Pre-fill from user metadata if user entered it during initial sign up
  const initialOrgName = 
    user.user_metadata?.organization_name || 
    user.user_metadata?.org_name || 
    '';
  const initialFullName = 
    user.user_metadata?.full_name || 
    (user.email ? user.email.split('@')[0] : '');
  const initialDept = 
    user.user_metadata?.department || 
    'Executive';
  const initialFacilityType = 
    (user.user_metadata?.facility_type as FacilityOperationType) || 
    'cold_storage';
  const initialCurrency = 
    user.user_metadata?.currency || 
    'GHS';

  const [step, setStep] = useState<1 | 2>(1);
  const [orgName, setOrgName] = useState(initialOrgName);
  const [facilityType, setFacilityType] = useState<FacilityOperationType>(initialFacilityType);
  const [adminFullName, setAdminFullName] = useState(initialFullName);
  const [adminDepartment, setAdminDepartment] = useState(initialDept);
  const [currency, setCurrency] = useState<'GHS' | 'USD' | 'EUR' | 'GBP'>(initialCurrency);
  const [primaryPort, setPrimaryPort] = useState('Port of Tema & Pier 38 Fishing Harbour');
  
  // Auto-generate facility prefix e.g. FAC-TEM-01
  const deriveFacilityCode = (name: string) => {
    const letters = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    return letters.length >= 2 ? `FAC-${letters}-01` : 'FAC-SEA-01';
  };
  const [facilityCode, setFacilityCode] = useState(() => deriveFacilityCode(initialOrgName || 'TEMA'));

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    setFacilityCode(deriveFacilityCode(val));
  };

  const handleLaunchWorkspace = async () => {
    if (!orgName.trim()) {
      setErrorMessage('Please enter an organization or company name.');
      setStep(1);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await createOrganizationAndAdmin(
        orgName.trim(),
        adminFullName.trim() || user.email?.split('@')[0] || 'Administrator',
        adminDepartment.trim() || 'Executive',
        {
          facilityCode: facilityCode.trim(),
          currency,
          facilityType,
          primaryPort: primaryPort.trim()
        }
      );

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to initialize workspace. Please try again.');
        setIsLoading(false);
        return;
      }

      await onCompleted();
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during workspace launch.');
      setIsLoading(false);
    }
  };

  const selectedFacility = FACILITY_OPTIONS.find(f => f.id === facilityType) || FACILITY_OPTIONS[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex flex-col justify-between text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Snowflake className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
              Frostly <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Workspace Setup</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Signed in as <span className="text-slate-200 font-mono">{user.email}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg hover:bg-slate-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Form Container */}
      <main className="max-w-3xl w-full mx-auto my-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs uppercase font-bold tracking-widest text-indigo-400">
              Initial Workspace Onboarding
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
              {step === 1 ? 'Configure Your Seafood Enterprise' : 'Review & Launch Workspace'}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className={`px-2.5 py-1 rounded-full ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'}`}>
              1. Facility Profile
            </span>
            <span className="text-slate-600">→</span>
            <span className={`px-2.5 py-1 rounded-full ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              2. Launch
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <span className="font-bold">Error:</span> {errorMessage}
          </div>
        )}

        {step === 1 ? (
          /* STEP 1: Facility Profile & Details */
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Organization / Company Legal Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  id="onboarding-org-name-input"
                  placeholder="e.g. Tema Marine Cold Storage Ltd"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This will be your top-level tenant namespace and appears on invoices, manifests, and passports.
              </p>
            </div>

            {/* Facility Operation Types */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Primary Facility Type &amp; Operational Focus
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FACILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = facilityType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      id={`onboarding-type-${opt.id}`}
                      onClick={() => setFacilityType(opt.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-indigo-950/60 border-indigo-500 text-white ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-950/50' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-white">
                            {opt.title}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug mt-1">
                            {opt.tagline}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid for currency, facility code, port */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Base Currency
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="onboarding-currency-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="GHS">GHS (Ghanaian Cedi ₵)</option>
                    <option value="USD">USD (US Dollar $)</option>
                    <option value="EUR">EUR (Euro €)</option>
                    <option value="GBP">GBP (British Pound £)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Plant / Facility Code
                </label>
                <input
                  type="text"
                  id="onboarding-facility-code-input"
                  value={facilityCode}
                  onChange={(e) => setFacilityCode(e.target.value.toUpperCase())}
                  placeholder="FAC-TEM-01"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Primary Port Location
                </label>
                <div className="relative">
                  <Anchor className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    id="onboarding-port-input"
                    value={primaryPort}
                    onChange={(e) => setPrimaryPort(e.target.value)}
                    placeholder="Port of Tema"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Admin identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  id="onboarding-admin-name-input"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. Kofi Mensah"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Your Department / Title
                </label>
                <input
                  type="text"
                  id="onboarding-admin-dept-input"
                  value={adminDepartment}
                  onChange={(e) => setAdminDepartment(e.target.value)}
                  placeholder="Executive / Operations"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Continue Button */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                id="onboarding-next-step-btn"
                disabled={!orgName.trim()}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30"
              >
                <span>Continue to Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: Summary & Launch Confirmation */
          <div className="space-y-6">
            {/* Trial Guarantee Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/80 to-blue-950/80 border border-indigo-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-white">
                  14-Day Full Starter Trial Included
                </div>
                <div className="text-[11px] text-indigo-200/80 mt-0.5 leading-relaxed">
                  You are provisioning a brand new seafood enterprise workspace with <strong>5 full staff seats</strong>, isolated database isolation, HACCP compliance logs, and cold-chain telemetry. No credit card required.
                </div>
              </div>
            </div>

            {/* Review Parameters Card */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs text-slate-400">Enterprise Name</span>
                <span className="text-xs font-bold text-white">{orgName}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs text-slate-400">Facility Classification</span>
                <span className="text-xs font-medium text-indigo-300">{selectedFacility.title}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs text-slate-400">Plant Code &amp; Currency</span>
                <span className="text-xs font-mono text-slate-200">{facilityCode} • {currency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Administrator</span>
                <span className="text-xs text-slate-200">{adminFullName || user.email} ({adminDepartment})</span>
              </div>
            </div>

            {/* Provisioning Checklist */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                What Frostly is Setting Up For You:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Row-Level Security Tenant Isolation</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Seafood Species Taxonomy Catalog</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pre-Configured Cold Storage Rooms</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Wholesale AR/AP &amp; Retail POS Registers</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                id="onboarding-back-btn"
                disabled={isLoading}
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Back to Edit
              </button>

              <button
                type="button"
                id="onboarding-launch-btn"
                disabled={isLoading}
                onClick={handleLaunchWorkspace}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-600/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Provisioning Tenant Workspace...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-200" />
                    <span>Launch Seafood Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl w-full mx-auto text-center text-xs text-slate-500 py-2">
        Frostly Seafood Platform • Enterprise Multi-Tenant Core • Powered by Supabase RLS &amp; Realtime
      </footer>
    </div>
  );
};
