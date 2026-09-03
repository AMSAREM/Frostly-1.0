import React, { useState } from 'react';
import { 
  Building2, 
  ThermometerSnowflake, 
  Sliders, 
  ShoppingBag, 
  Bell, 
  Database, 
  Save, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Globe, 
  DollarSign, 
  FileText, 
  Scale, 
  Clock, 
  Volume2, 
  VolumeX, 
  HardDrive,
  Info,
  Check,
  RotateCcw
} from 'lucide-react';
import { AppSettings, InventoryBatch, ClientOrder, Customer, Supplier, RetailWholesaleProduct, RetailTransaction, PurchaseOrderLanding, FinancialLedgerEntry } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  batches: InventoryBatch[];
  orders: ClientOrder[];
  customers: Customer[];
  suppliers: Supplier[];
  products: RetailWholesaleProduct[];
  retailSales: RetailTransaction[];
  purchaseOrders: PurchaseOrderLanding[];
  financialEntries: FinancialLedgerEntry[];
  onRestoreAllData: (importedData: {
    batches?: InventoryBatch[];
    orders?: ClientOrder[];
    customers?: Customer[];
    suppliers?: Supplier[];
    products?: RetailWholesaleProduct[];
    retailSales?: RetailTransaction[];
    purchaseOrders?: PurchaseOrderLanding[];
    financialEntries?: FinancialLedgerEntry[];
    settings?: AppSettings;
  }) => void;
  onResetToDefaults: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  batches,
  orders,
  customers,
  suppliers,
  products,
  retailSales,
  purchaseOrders,
  financialEntries,
  onRestoreAllData,
  onResetToDefaults
}) => {
  const [activeCategory, setActiveCategory] = useState<'profile' | 'coldchain' | 'units' | 'fulfillment' | 'alerts' | 'data'>('profile');
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  // Sync state if external settings change
  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // Export Complete ERP Backup as JSON
  const handleExportBackup = () => {
    const backupData = {
      version: '2.4.0',
      exportedAt: new Date().toISOString(),
      appName: 'Frostly Seafood ERP',
      settings: formData,
      batches,
      orders,
      customers,
      suppliers,
      products,
      retailSales,
      purchaseOrders,
      financialEntries
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `frostly_erp_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import ERP Backup from JSON
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);
    const fileReader = new FileReader();
    const files = event.target.files;

    if (!files || files.length === 0) return;

    fileReader.readAsText(files[0], "UTF-8");
    fileReader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON format');
        }

        onRestoreAllData({
          batches: Array.isArray(parsed.batches) ? parsed.batches : undefined,
          orders: Array.isArray(parsed.orders) ? parsed.orders : undefined,
          customers: Array.isArray(parsed.customers) ? parsed.customers : undefined,
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : undefined,
          products: Array.isArray(parsed.products) ? parsed.products : undefined,
          retailSales: Array.isArray(parsed.retailSales) ? parsed.retailSales : undefined,
          purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : undefined,
          financialEntries: Array.isArray(parsed.financialEntries) ? parsed.financialEntries : undefined,
          settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : undefined,
        });

        if (parsed.settings) {
          setFormData(parsed.settings);
        }

        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 4000);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse JSON backup file.');
      }
    };
  };

  const navCategories = [
    { id: 'profile', label: 'Plant & Profile', icon: Building2, desc: 'Enterprise registration & facility specs' },
    { id: 'coldchain', label: 'Cold-Chain & HACCP', icon: ThermometerSnowflake, desc: 'Temperature alerts & critical limits' },
    { id: 'units', label: 'Units & Display', icon: Sliders, desc: 'Weight, temperatures & date formats' },
    { id: 'fulfillment', label: 'POS & Fulfillment', icon: ShoppingBag, desc: 'Terms, ice surcharges & QR presets' },
    { id: 'alerts', label: 'Alerts & Auditing', icon: Bell, desc: 'Stock thresholds & sensor alarms' },
    { id: 'data', label: 'Data & Offline Backup', icon: Database, desc: 'JSON exports, restores & demo reset' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black font-heading tracking-tight text-slate-900">
              System Settings & Configuration
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure seafood processing plant parameters, HACCP critical limits, currency, and offline backup storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Saved Successfully</span>
            </div>
          )}

          <button
            id="settings-save-top-btn"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar Tabs + Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <div className="bg-white p-3 rounded-3xl border border-slate-200 shadow-xs space-y-1">
            {navCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`settings-tab-${cat.id}`}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">{cat.label}</div>
                    <div className={`text-[11px] leading-tight ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {cat.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick System Diagnostics Widget */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                System Diagnostics
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Active Fish Lots in Cryo:</span>
                <span className="font-mono-code font-bold text-white">{batches.length} batches</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Orders in Ledger:</span>
                <span className="font-mono-code font-bold text-white">{orders.length + retailSales.length} records</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Registered Vessels:</span>
                <span className="font-mono-code font-bold text-white">{suppliers.length} harvesters</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>PWA Storage Engine:</span>
                <span className="font-mono-code font-bold text-emerald-300">Local Cache + Indexed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Body Area */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Category 1: Plant & Enterprise Profile */}
            {activeCategory === 'profile' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 font-heading">Enterprise & Facility Profile</h2>
                  <p className="text-xs text-slate-500">Official company entity names, inspection badges, and tax settings.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Company Legal Entity Name</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Facility ID Code</label>
                    <input
                      type="text"
                      value={formData.facilityCode}
                      onChange={(e) => handleChange('facilityCode', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono-code font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Primary Discharge Port</label>
                    <input
                      type="text"
                      value={formData.primaryPort}
                      onChange={(e) => handleChange('primaryPort', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">FDA Food Facility Registration #</label>
                    <input
                      type="text"
                      value={formData.fdaRegistrationNumber}
                      onChange={(e) => handleChange('fdaRegistrationNumber', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono-code text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">EU Seafood Approval Number</label>
                    <input
                      type="text"
                      value={formData.euApprovalNumber}
                      onChange={(e) => handleChange('euApprovalNumber', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono-code text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">HACCP & QA Coordinator Name</label>
                    <input
                      type="text"
                      value={formData.haccpCoordinator}
                      onChange={(e) => handleChange('haccpCoordinator', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Base Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleChange('currency', e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                      <option value="GHS">GHS (GH₵) - Ghana Cedis</option>
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="GBP">GBP (£) - British Pound</option>
                      <option value="JPY">JPY (¥) - Japanese Yen</option>
                      <option value="CAD">CAD ($) - Canadian Dollar</option>
                      <option value="AUD">AUD ($) - Australian Dollar</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Retail Sales Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.taxRate}
                      onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Category 2: Cold-Chain & HACCP Excursion Limits */}
            {activeCategory === 'coldchain' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 font-heading">Cold Storage & HACCP Telemetry Critical Limits</h2>
                  <p className="text-xs text-slate-500">Configure excursion alarms for super-cryo deep freeze and histamine sensors.</p>
                </div>

                <div className="space-y-4">
                  {/* Super Cryo */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <ThermometerSnowflake className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950">Super-Cryo Deep Freeze Zone</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">Sashimi Grade AAA</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Target Core Temp (°C)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formData.superCryoTargetC}
                          onChange={(e) => handleChange('superCryoTargetC', parseFloat(e.target.value))}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-rose-700">Trigger Alarm Above (°C)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formData.superCryoMaxAlertC}
                          onChange={(e) => handleChange('superCryoMaxAlertC', parseFloat(e.target.value))}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Commercial Cold Storage */}
                  <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <ThermometerSnowflake className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold text-sky-950">Commercial Freezer Zone (-22°C)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Target Temperature (°C)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formData.commercialFreezeTargetC}
                          onChange={(e) => handleChange('commercialFreezeTargetC', parseFloat(e.target.value))}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-rose-700">Trigger Alarm Above (°C)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={formData.commercialFreezeMaxAlertC}
                          onChange={(e) => handleChange('commercialFreezeMaxAlertC', parseFloat(e.target.value))}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fresh Slush Ice */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <ThermometerSnowflake className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-950">Fresh Slush Ice Zone (0°C to +2°C)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Target Slush Temp (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.slushIceTargetC}
                          onChange={(e) => handleChange('slushIceTargetC', parseFloat(e.target.value))}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-rose-700">Trigger Alarm Above (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formData.slushIceMaxAlertC}
                          onChange={(e) => handleChange('slushIceMaxAlertC', parseFloat(e.target.value))}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Histamine Limit & Audio */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Histamine Action Limit (FDA ppm)</label>
                      <input
                        type="number"
                        value={formData.histamineLimitPpm}
                        onChange={(e) => handleChange('histamineLimitPpm', parseInt(e.target.value) || 50)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                      />
                      <p className="text-[10px] text-slate-400">Batches exceeding this limit are auto-quarantined.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">IoT Sensor Polling Interval</label>
                      <select
                        value={formData.sensorPollingIntervalSec}
                        onChange={(e) => handleChange('sensorPollingIntervalSec', parseInt(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value={15}>Every 15 seconds (High Frequency)</option>
                        <option value={30}>Every 30 seconds (Standard)</option>
                        <option value={60}>Every 60 seconds (Eco Telemetry)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 3: Units & Display */}
            {activeCategory === 'units' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 font-heading">Units & Measurement Preferences</h2>
                  <p className="text-xs text-slate-500">Toggle imperial/metric standards and number precision globally.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Measurement System Standard</div>
                      <div className="text-[11px] text-slate-500">
                        {formData.useImperial ? 'Imperial (lbs & Fahrenheit °F)' : 'Metric (kg & Celsius °C)'}
                      </div>
                    </div>
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleChange('useImperial', false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          !formData.useImperial ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        kg / °C
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('useImperial', true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          formData.useImperial ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        lbs / °F
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Catch Weight Decimal Precision</label>
                      <select
                        value={formData.weightDecimalPlaces}
                        onChange={(e) => handleChange('weightDecimalPlaces', parseInt(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value={1}>1 Decimal (e.g. 1,450.5 kg)</option>
                        <option value={2}>2 Decimals (e.g. 1,450.55 kg)</option>
                        <option value={3}>3 Decimals (e.g. 1,450.550 kg)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Date Display Standard</label>
                      <select
                        value={formData.dateFormat}
                        onChange={(e) => handleChange('dateFormat', e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="YYYY-MM-DD">ISO Standard (YYYY-MM-DD)</option>
                        <option value="MM/DD/YYYY">US Standard (MM/DD/YYYY)</option>
                        <option value="DD/MM/YYYY">International (DD/MM/YYYY)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category 4: POS & Order Fulfillment */}
            {activeCategory === 'fulfillment' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 font-heading">Fulfillment & Point of Sale Rules</h2>
                  <p className="text-xs text-slate-500">Configure default B2B payment terms, cryo packaging fees, and QR codes.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Default B2B Wholesale Payment Terms</label>
                    <select
                      value={formData.defaultPaymentTerms}
                      onChange={(e) => handleChange('defaultPaymentTerms', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="Net 15 Days">Net 15 Days</option>
                      <option value="Net 30 Days">Net 30 Days (Standard)</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                      <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                      <option value="Letter of Credit / Escrow">Letter of Credit / Escrow</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Cryo-Ice & Box Surcharge ($/kg)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={formData.icePackagingFeePerKg}
                      onChange={(e) => handleChange('icePackagingFeePerKg', parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Minimum B2B Order Value ($)</label>
                    <input
                      type="number"
                      value={formData.minOrderValueWholesale}
                      onChange={(e) => handleChange('minOrderValueWholesale', parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 sm:col-span-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Auto-Attach Traceability QR Passports</div>
                      <div className="text-[11px] text-slate-500">Automatically attach vessel & temperature QR badges to customer invoices.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.autoGenerateQRTraceability}
                      onChange={(e) => handleChange('autoGenerateQRTraceability', e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Category 5: Alerts & Notifications */}
            {activeCategory === 'alerts' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 font-heading">Automated Alerts & Telemetry Triggers</h2>
                  <p className="text-xs text-slate-500">Configure which events generate high-priority system alerts.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-900">HACCP Cold-Chain Excursions</div>
                      <div className="text-[11px] text-slate-500">Alert immediately when freezer temperature breaches threshold.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifyHaccpExcursion}
                      onChange={(e) => handleChange('notifyHaccpExcursion', e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Low Stock Re-order Alerts</div>
                      <div className="text-[11px] text-slate-500">Notify when available batch inventory drops below threshold.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifyLowInventory}
                      onChange={(e) => handleChange('notifyLowInventory', e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Low Stock Threshold:</span>
                      <span className="font-mono-code text-indigo-600">{formData.lowStockThresholdKg} kg</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="25"
                      value={formData.lowStockThresholdKg}
                      onChange={(e) => handleChange('lowStockThresholdKg', parseInt(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Overdue AR Invoices</div>
                      <div className="text-[11px] text-slate-500">Flag client orders exceeding Net 30/60 day terms.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifyOverdueInvoices}
                      onChange={(e) => handleChange('notifyOverdueInvoices', e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Audible Alarm Chime</div>
                      <div className="text-[11px] text-slate-500">Play chime on high severity HACCP or dock arrival events.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.enableAudioAlerts}
                      onChange={(e) => handleChange('enableAudioAlerts', e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Category 6: Data & Offline Backup */}
            {activeCategory === 'data' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 animate-in fade-in">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900 font-heading">Data Management & Backup / Restore</h2>
                  <p className="text-xs text-slate-500">Export complete JSON snapshots, restore prior databases, or reset demo data.</p>
                </div>

                {importSuccess && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span><strong>Database Restored:</strong> All batches, orders, and ledger entries have been successfully loaded.</span>
                  </div>
                )}

                {importError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span><strong>Restore Failed:</strong> {importError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Export Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <Download className="w-4 h-4 text-indigo-600" />
                        <span>Export ERP Backup</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Save all batches, orders, customers, and financial records as a standalone JSON backup file.
                      </p>
                    </div>
                    <button
                      type="button"
                      id="btn-export-backup"
                      onClick={handleExportBackup}
                      className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Download JSON Backup</span>
                    </button>
                  </div>

                  {/* Import Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span>Restore from JSON File</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Load a previously exported Frostly JSON backup to restore all inventory and transaction state.
                      </p>
                    </div>
                    <label className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer text-center">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select Backup File</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportBackup}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Danger Zone: Reset to Factory Defaults */}
                <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-rose-600" />
                      <span>Reset Application Demo Records</span>
                    </div>
                    <div className="text-[11px] text-rose-700">
                      Reverts all batches, orders, POS sales, and financials back to initial sample state.
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-reset-demo-data"
                    onClick={() => setResetModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Reset Data
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Save Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                All changes take effect immediately across all POS and reporting views.
              </span>
              <button
                type="submit"
                id="settings-save-bottom-btn"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save All Settings</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 font-heading">Reset Application to Initial State?</h3>
              <p className="text-xs text-slate-500">
                This will restore all default seafood batches, vessel landings, customer profiles, and initial financial statements. Any custom added lots will be reset.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setResetModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetToDefaults();
                  setResetModalOpen(false);
                  setSaveSuccess(true);
                  setTimeout(() => setSaveSuccess(false), 3000);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
