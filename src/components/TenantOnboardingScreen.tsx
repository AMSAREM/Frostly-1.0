import React, { useState } from 'react';
import { 
  Snowflake, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  LogOut, 
  X,
  Building2, 
  Coins, 
  Anchor, 
  ShieldCheck, 
  Sparkles,
  ThermometerSnowflake,
  Fish,
  Ship,
  Truck,
  Plus,
  Trash2,
  Boxes,
  ClipboardCheck,
  Radio
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { FrostlyLogo } from './FrostlyLogo';
import { createOrganizationAndAdmin } from '../data/auth';
import { FacilityOperationType } from '../types';
import { INITIAL_BATCHES } from '../data/mockData';
import { batchRepository } from '../repositories/batchRepository';
import { customerRepository } from '../repositories/customerRepository';
import { orderRepository } from '../repositories/orderRepository';
import { supplierRepository } from '../repositories/supplierRepository';
import { financialRepository } from '../repositories/financialRepository';
import { purchaseOrderRepository } from '../repositories/purchaseOrderRepository';
import { productRepository, retailTransactionRepository } from '../repositories/retailRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { syncQueue } from '../sync/queue';

export interface TenantOnboardingScreenProps {
  user: User;
  onCompleted: () => Promise<void> | void;
  onSignOut?: () => Promise<void> | void;
  onClose?: () => void;
  isModal?: boolean;
}

interface FacilityTypeOption {
  id: FacilityOperationType;
  title: string;
  tagline: string;
  icon: React.ElementType;
  defaultRooms: { name: string; targetTempC: number; type: string }[];
  primarySpecies: string[];
}

const FACILITY_OPTIONS: FacilityTypeOption[] = [
  {
    id: 'cold_storage',
    title: 'Cold Storage & Freezing Facility',
    tagline: 'Multi-zone cryogenic storage, blast freezing, and cold-chain temperature telemetry.',
    icon: ThermometerSnowflake,
    defaultRooms: [
      { name: 'Cold Storage Bay A', targetTempC: -20, type: 'Deep Freeze' },
      { name: 'Blast Freezer Unit #1', targetTempC: -35, type: 'Blast Freeze' },
      { name: 'Chilled Holding Room', targetTempC: 2, type: 'Chilled Staging' }
    ],
    primarySpecies: ['Yellowfin Tuna', 'Atlantic Mackerel', 'Red Snapper', 'Tiger Prawns']
  },
  {
    id: 'processing_plant',
    title: 'Seafood Processing & Packing Plant',
    tagline: 'Filleting lines, catch-weight sorting, yield tracking, and HACCP CCP checkpoints.',
    icon: Fish,
    defaultRooms: [
      { name: 'Processing Floor Bay 1', targetTempC: 10, type: 'Work Floor' },
      { name: 'Plate Freezer Unit B', targetTempC: -40, type: 'Plate Freeze' },
      { name: 'Finished Goods Cold Store', targetTempC: -18, type: 'Commercial Freeze' }
    ],
    primarySpecies: ['Cassava Croaker', 'Skipjack Tuna', 'Grouper Fillets', 'Calamari Rings']
  },
  {
    id: 'vessel_operator',
    title: 'Harvester Fleet & Landed Catch Operator',
    tagline: 'Pier weigh-ins, vessel landing manifests, captain tallies, and species grading.',
    icon: Ship,
    defaultRooms: [
      { name: 'Dockside Receiving Staging', targetTempC: 1, type: 'Slush Ice Holding' },
      { name: 'Primary Slush Ice Bunker', targetTempC: 0, type: 'Ice Storage' },
      { name: 'Vessel Discharge Holding', targetTempC: -25, type: 'Deep Cold' }
    ],
    primarySpecies: ['Yellowfin Tuna (G&G)', 'Sardinella Aurita', 'Barracuda', 'Atlantic Bonito']
  },
  {
    id: 'wholesale_distribution',
    title: 'Marine Wholesale & Reefer Distribution',
    tagline: 'Customer credit limits, wholesale packing slips, cold-van dispatch, and retail counters.',
    icon: Truck,
    defaultRooms: [
      { name: 'Central Distribution Hub', targetTempC: -18, type: 'Wholesale Depot' },
      { name: 'Retail Dispatch Ante-Room', targetTempC: 4, type: 'Pre-Delivery' },
      { name: 'Reefer Bay Loading Dock', targetTempC: -10, type: 'Cross-Dock' }
    ],
    primarySpecies: ['Tiger Prawns (Export Grade)', 'Red Snapper Whole', 'Atlantic Mackerel', 'Octopus']
  }
];

const GHANA_PORTS = [
  'Port of Tema & Pier 38 Fishing Harbour',
  'Takoradi Commercial Harbour',
  'Sekondi Albert Bosomtwi-Sam Fishing Port',
  'Elmina Historic Landing Beach'
];

export const TenantOnboardingScreen: React.FC<TenantOnboardingScreenProps> = ({
  user,
  onCompleted,
  onSignOut,
  onClose,
  isModal = false
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
    'Executive Operations';
  const initialFacilityType = 
    (user.user_metadata?.facility_type as FacilityOperationType) || 
    'cold_storage';
  const initialCurrency = 
    (user.user_metadata?.currency as 'GHS' | 'USD' | 'EUR' | 'GBP') || 
    'GHS';

  // 4-Step Onboarding Wizard
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Enterprise Profile & Identity
  const [orgName, setOrgName] = useState(initialOrgName);
  const [facilityType, setFacilityType] = useState<FacilityOperationType>(initialFacilityType);
  const [adminFullName, setAdminFullName] = useState(initialFullName);
  const [adminDepartment, setAdminDepartment] = useState(initialDept);
  
  // Auto-generate facility prefix e.g. FAC-TEM-01
  const deriveFacilityCode = (name: string) => {
    const letters = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
    return letters.length >= 2 ? `FAC-${letters}-01` : 'FAC-TEM-01';
  };
  const [facilityCode, setFacilityCode] = useState(() => deriveFacilityCode(initialOrgName || 'Tema Cold'));

  // Step 2: Cold Chain Infrastructure & Telemetry
  const selectedFacility = FACILITY_OPTIONS.find(f => f.id === facilityType) || FACILITY_OPTIONS[0];
  const [rooms, setRooms] = useState<{ id: string; name: string; targetTempC: number; type: string }[]>(() => 
    selectedFacility.defaultRooms.map((r, i) => ({ id: `r-${i}`, ...r }))
  );
  const [useImperialUnits, setUseImperialUnits] = useState(false);
  const [haccpExcursionAlertC, setHaccpExcursionAlertC] = useState(-18.0);

  // Step 3: Starter Seafood Catalog & Commercial Settings
  const [currency, setCurrency] = useState<'GHS' | 'USD' | 'EUR' | 'GBP'>(initialCurrency);
  const [primaryPort, setPrimaryPort] = useState(GHANA_PORTS[0]);
  const [seedStarterInventory, setSeedStarterInventory] = useState(false);
  const [complianceCertReady, setComplianceCertReady] = useState(true);

  // Step 4: Provisioning & Launch Pipeline
  const [isLoading, setIsLoading] = useState(false);
  const [launchProgressStage, setLaunchProgressStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // When facility type changes, refresh default rooms if user hasn't heavily customized them
  const handleFacilityTypeChange = (type: FacilityOperationType) => {
    setFacilityType(type);
    const chosen = FACILITY_OPTIONS.find(f => f.id === type);
    if (chosen) {
      setRooms(chosen.defaultRooms.map((r, i) => ({ id: `r-${Date.now()}-${i}`, ...r })));
    }
  };

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    setFacilityCode(deriveFacilityCode(val));
  };

  const handleAddRoom = () => {
    setRooms(prev => [
      ...prev,
      {
        id: `r-${Date.now()}`,
        name: `Cold Room #${prev.length + 1}`,
        targetTempC: -20,
        type: 'Commercial Freeze'
      }
    ]);
  };

  const handleRemoveRoom = (id: string) => {
    if (rooms.length <= 1) return;
    setRooms(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRoomName = (id: string, name: string) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  const handleUpdateRoomTemp = (id: string, targetTempC: number) => {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, targetTempC } : r));
  };

  // Launch workspace execution
  const handleLaunchWorkspace = async () => {
    if (!orgName.trim()) {
      setErrorMessage('Please enter an organization or company name.');
      setStep(1);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLaunchProgressStage('Initializing tenant security isolation...');

    try {
      await new Promise(r => setTimeout(r, 400));
      setLaunchProgressStage('Configuring cold room temperature telemetry...');
      
      const res = await createOrganizationAndAdmin(
        orgName.trim(),
        adminFullName.trim() || user.email?.split('@')[0] || 'Administrator',
        adminDepartment.trim() || 'Executive Operations',
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

      setLaunchProgressStage('Applying regulatory compliance & starter catalog...');
      await new Promise(r => setTimeout(r, 400));

      // Persist user preference settings
      try {
        const targetOrgId = res.data?.organization_id || res.data?.orgId || localStorage.getItem('frostly_active_org_id');
        
        // Ensure complete data isolation: purge any sync queue leftovers or rogue cache for this tenant
        if (targetOrgId) {
          syncQueue.clearForTenant(targetOrgId);
          batchRepository.clearTenantCache(targetOrgId);
          customerRepository.clearTenantCache(targetOrgId);
          orderRepository.clearTenantCache(targetOrgId);
          supplierRepository.clearTenantCache(targetOrgId);
          financialRepository.clearTenantCache(targetOrgId);
          purchaseOrderRepository.clearTenantCache(targetOrgId);
          productRepository.clearTenantCache(targetOrgId);
          retailTransactionRepository.clearTenantCache(targetOrgId);
          notificationRepository.clearTenantCache(targetOrgId);

          if (seedStarterInventory) {
            // Seed isolated starter lots exclusively if user opted in
            const starterLots = INITIAL_BATCHES.map(b => ({
              ...b,
              id: `LOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            }));
            batchRepository.setLocalCache(starterLots, targetOrgId);
          } else {
            // Workspace must be completely clean with zero data
            batchRepository.setLocalCache([], targetOrgId);
            customerRepository.setLocalCache([], targetOrgId);
            orderRepository.setLocalCache([], targetOrgId);
            supplierRepository.setLocalCache([], targetOrgId);
            financialRepository.setLocalCache([], targetOrgId);
            purchaseOrderRepository.setLocalCache([], targetOrgId);
            productRepository.setLocalCache([], targetOrgId);
            retailTransactionRepository.setLocalCache([], targetOrgId);
            notificationRepository.setLocalCache([], targetOrgId);
          }
        }

        const savedSettingsStr = localStorage.getItem('frostly_settings_v2');
        const saved = savedSettingsStr ? JSON.parse(savedSettingsStr) : {};
        localStorage.setItem('frostly_settings_v2', JSON.stringify({
          ...saved,
          companyName: orgName.trim(),
          facilityCode: facilityCode.trim(),
          currency,
          primaryPort: primaryPort.trim(),
          useImperial: useImperialUnits,
          commercialFreezeMaxAlertC: haccpExcursionAlertC,
          activeRoomsCount: rooms.length,
          facilityOperationType: facilityType
        }));
      } catch (postInitErr) {
        console.warn('[TenantOnboarding] Tenant cache init note:', postInitErr);
      }

      setLaunchProgressStage('Launching seafood operations dashboard...');
      await new Promise(r => setTimeout(r, 350));

      await onCompleted();
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during workspace launch.');
      setIsLoading(false);
    }
  };

  return (
    <div className={`${isModal ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center' : 'min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 p-4 sm:p-6 lg:p-8'}`}>
      
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1 shadow-md">
            <FrostlyLogo size={24} iconOnly variant="blue" />
          </div>
          <div>
            <div className="font-bold text-sm text-white flex items-center gap-2">
              <span>Frostly Seafood Platform</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Workspace Onboarding
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Configuring tenant for <span className="text-slate-200 font-mono">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              id="onboarding-close-btn"
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/60"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel &amp; Close</span>
            </button>
          )}

          {onSignOut && !isModal && (
            <button
              type="button"
              id="onboarding-signout-btn"
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Card Container */}
      <main className="max-w-4xl w-full mx-auto my-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        
        {/* Step Progression Bar */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[11px] uppercase tracking-widest font-bold text-indigo-400">
                Setup Wizard • Step {step} of 4
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {step === 1 && 'Facility & Enterprise Profile'}
                {step === 2 && 'Cold Storage Rooms & Telemetry'}
                {step === 3 && 'Commercial Catalog & Traceability'}
                {step === 4 && 'Review & Provision Workspace'}
              </h1>
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { num: 1, label: 'Profile' },
                { num: 2, label: 'Cold Rooms' },
                { num: 3, label: 'Catalog' },
                { num: 4, label: 'Launch' }
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < step || (orgName.trim() && s.num <= step + 1)) {
                      setStep(s.num as any);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    step === s.num
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : step > s.num
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>{s.num}.</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <span className="font-bold">Error:</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Facility Profile & Enterprise Identity */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Organization / Seafood Enterprise Legal Name *
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
                Your primary tenant namespace. This name appears on digital catch manifests, HACCP logs, and invoices.
              </p>
            </div>

            {/* Facility Operation Types Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-2">
                Operational Architecture &amp; Cold-Chain Profile
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
                      onClick={() => handleFacilityTypeChange(opt.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-indigo-950/60 border-indigo-500 text-white ring-1 ring-indigo-500/40 shadow-md' 
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-lg shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white">
                            {opt.title}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-relaxed mt-1">
                            {opt.tagline}
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {opt.primarySpecies.slice(0, 2).map((sp) => (
                              <span key={sp} className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-medium">
                                {sp}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Administrator Identity & Plant Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Plant / Facility ID Code
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
                  Administrator Full Name
                </label>
                <input
                  type="text"
                  id="onboarding-admin-name-input"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. Emmanuel Mensah"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Department / Authority
                </label>
                <input
                  type="text"
                  id="onboarding-admin-dept-input"
                  value={adminDepartment}
                  onChange={(e) => setAdminDepartment(e.target.value)}
                  placeholder="Executive Operations"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="pt-4 flex justify-end border-t border-slate-800">
              <button
                type="button"
                id="onboarding-step1-next-btn"
                disabled={!orgName.trim()}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30"
              >
                <span>Configure Cold Rooms</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Cold Storage Rooms & Temperature Telemetry */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Cold Storage Rooms &amp; Cryo-Holding Zones
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set up real-time temperature targets and sensor excursion monitoring.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddRoom}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>Add Cold Room</span>
              </button>
            </div>

            {/* List of Configured Rooms */}
            <div className="space-y-3">
              {rooms.map((room, idx) => (
                <div
                  key={room.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => handleUpdateRoomName(room.id, e.target.value)}
                        placeholder="Room name..."
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Target:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={room.targetTempC}
                          onChange={(e) => handleUpdateRoomTemp(room.id, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-center font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-400 font-mono">°C</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRoom(room.id)}
                      disabled={rooms.length <= 1}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove Room"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Temperature Telemetry & Metric Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>HACCP Excursion Critical Threshold</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Maximum allowable temperature before an automated emergency alert is sent to operations auditors.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    value={haccpExcursionAlertC}
                    onChange={(e) => setHaccpExcursionAlertC(parseFloat(e.target.value) || -18)}
                    className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-center font-mono text-emerald-300"
                  />
                  <span className="text-xs text-slate-400 font-mono">°C (Standard Frozen CCP: -18°C)</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-indigo-400" />
                  <span>Measurement Standards</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Choose default catch-weight and thermal metrics across inventory manifests and invoices.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setUseImperialUnits(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      !useImperialUnits ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Metric (kg / °C)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseImperialUnits(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      useImperialUnits ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Imperial (lbs / °F)
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="onboarding-step2-next-btn"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <span>Commercial &amp; Catalog Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Commercial Catalog & Traceability */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Currency & Port Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Operating Base Currency
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="onboarding-currency-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="GHS">GHS (Ghanaian Cedi ₵)</option>
                    <option value="USD">USD (US Dollar $)</option>
                    <option value="EUR">EUR (Euro €)</option>
                    <option value="GBP">GBP (British Pound £)</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Used for wholesale accounts receivable, POS registers, and inventory valuations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Primary Maritime Port &amp; Landing Pier
                </label>
                <div className="relative">
                  <Anchor className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="onboarding-port-select"
                    value={primaryPort}
                    onChange={(e) => setPrimaryPort(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {GHANA_PORTS.map((port) => (
                      <option key={port} value={port}>
                        {port}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default landing port recorded on harvest documentation and vessel discharge tallies.
                </p>
              </div>
            </div>

            {/* Seed Starter Inventory Option */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="onboarding-seed-inventory-check"
                  checked={seedStarterInventory}
                  onChange={(e) => setSeedStarterInventory(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-400" />
                    <span>Pre-seed Starter Seafood Inventory &amp; Batch Lots</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                    Populate your new workspace with realistic sample seafood batches ({selectedFacility.primarySpecies.join(', ')}) with barcodes, catch zones, and temperature logs so you can explore immediately.
                  </p>
                </div>
              </label>
            </div>

            {/* Regulatory Compliance Presets */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="onboarding-compliance-check"
                  checked={complianceCertReady}
                  onChange={(e) => setComplianceCertReady(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                    <span>Generate Certified Digital Export &amp; Sanitary Passports</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                    Enable pre-configured Ghana FDA registration tags, EU Sanitary Inspection numbers, and electronic catch certificates (CC) for full cross-border seafood compliance.
                  </p>
                </div>
              </label>
            </div>

            {/* Step 3 Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="onboarding-step3-next-btn"
                onClick={() => setStep(4)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <span>Review &amp; Launch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Live Workspace Launch */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Starter Guarantee Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/80 to-slate-950 border border-indigo-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs text-white">
                  Ready to Provision Seafood Enterprise Workspace
                </div>
                <div className="text-[11px] text-indigo-200/80 mt-0.5 leading-relaxed">
                  Your dedicated multi-tenant database partitions, isolated staff credentials, and cold-chain telemetry are ready for instant provisioning.
                </div>
              </div>
            </div>

            {/* Executive Review Card */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">Enterprise Legal Name</span>
                <span className="text-xs font-bold text-white">{orgName}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">Operational Category</span>
                <span className="text-xs font-medium text-indigo-300">{selectedFacility.title}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">Plant Code &amp; Port</span>
                <span className="text-xs font-mono text-slate-200">{facilityCode} • {primaryPort.split('&')[0]}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">Active Cold Rooms</span>
                <span className="text-xs text-slate-200 font-medium">
                  {rooms.length} Rooms ({rooms.map(r => r.name).join(', ')})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Operating Currency</span>
                <span className="text-xs font-bold text-emerald-400">{currency}</span>
              </div>
            </div>

            {/* Provisioning Checklist */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Automated Deployment Pipeline
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Row-Level Security Tenant Isolation</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Real-time Cold Chain Sensor Monitors</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Seafood Taxonomy &amp; Traceability QR Engine</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Wholesale Accounts Receivable &amp; POS</span>
                </div>
              </div>
            </div>

            {/* Progress Stage Indicator during launch */}
            {isLoading && (
              <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span className="text-xs font-medium text-indigo-200">{launchProgressStage}</span>
              </div>
            )}

            {/* Step 4 Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-800">
              <button
                type="button"
                id="onboarding-back-step4-btn"
                disabled={isLoading}
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
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
                    <span>Provisioning Workspace...</span>
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
      {!isModal && (
        <footer className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 py-2">
          Frostly Seafood Platform • Enterprise Cold-Chain Architecture • Ghana &amp; West Africa Operations
        </footer>
      )}
    </div>
  );
};
