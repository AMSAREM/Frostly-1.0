import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Sparkles, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  Check, 
  X,
  Eye
} from 'lucide-react';
import { 
  PlatformPricingPlan, 
  fetchPublicPricingPlans, 
  savePlatformPricingPlan, 
  DEFAULT_PRICING_PLANS 
} from '../services/platformPricingService';

export const PlatformPricingPlansManager: React.FC = () => {
  const [plans, setPlans] = useState<PlatformPricingPlan[]>(DEFAULT_PRICING_PLANS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Selected plan for editing
  const [editingPlan, setEditingPlan] = useState<PlatformPricingPlan | null>(null);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [auditReason, setAuditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewCurrency, setPreviewCurrency] = useState<'USD' | 'GHS'>('USD');
  const [previewAnnual, setPreviewAnnual] = useState(true);

  const loadPlans = async () => {
    try {
      const data = await fetchPublicPricingPlans();
      if (data && data.length > 0) {
        setPlans(data);
      }
    } catch (err) {
      console.error('Failed to load pricing plans:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  const handleStartEdit = (plan: PlatformPricingPlan) => {
    setEditingPlan(JSON.parse(JSON.stringify(plan)));
    setNewFeatureText('');
    setAuditReason('');
    setNotification(null);
  };

  const handleAddFeature = () => {
    if (!editingPlan || !newFeatureText.trim()) return;
    setEditingPlan({
      ...editingPlan,
      features: [...editingPlan.features, newFeatureText.trim()]
    });
    setNewFeatureText('');
  };

  const handleRemoveFeature = (index: number) => {
    if (!editingPlan) return;
    const updated = editingPlan.features.filter((_, idx) => idx !== index);
    setEditingPlan({
      ...editingPlan,
      features: updated
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    if (!auditReason.trim()) {
      setNotification({
        type: 'error',
        message: 'A mandatory audit reason is required for platform pricing updates.'
      });
      return;
    }

    setSaving(true);
    setNotification(null);

    try {
      const result = await savePlatformPricingPlan(editingPlan, auditReason.trim());
      if (result.success) {
        setNotification({
          type: 'success',
          message: `Plan "${editingPlan.tier_name}" updated successfully! Changes are live on the Home Page.`
        });
        // Update state in plans list
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? result.plan : p));
        setTimeout(() => {
          setEditingPlan(null);
        }, 1200);
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to update pricing plan.'
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'An unexpected error occurred while saving.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <DollarSign className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Platform Pricing & Landing Page Plans
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Configure subscription tiers, monthly and annual prices in USD & GHS, staff seat limits, and public marketing feature bullet points. Changes update in real-time on the public home page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-pricing-plans"
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer shadow-2xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <a
            href="#pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Live Home Page</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Global Notification Banner */}
      {notification && !editingPlan && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-medium animate-in fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Plans Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all relative ${
              plan.is_popular 
                ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/20' 
                : 'border-slate-200 shadow-2xs hover:shadow-xs'
            }`}
          >
            {plan.is_popular && (
              <div className="absolute -top-3 left-6 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-2xs">
                {plan.badge || 'Popular Tier'}
              </div>
            )}

            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                    tier: {plan.id}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">
                    {plan.tier_name}
                  </h3>
                </div>
                <button
                  id={`btn-edit-plan-${plan.id}`}
                  type="button"
                  onClick={() => handleStartEdit(plan)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  title="Configure Tier Pricing & Details"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Plan</span>
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500 leading-relaxed min-h-[32px]">
                {plan.tagline}
              </p>

              {/* Pricing breakdown */}
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Monthly Billing:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    ${plan.monthly_price_usd} / mo <span className="text-slate-400 font-normal">| GH₵ {plan.monthly_price_ghs}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Annual Billing:</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    ${plan.annual_price_usd} / mo <span className="text-emerald-500 font-normal">| GH₵ {plan.annual_price_ghs}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Staff Seats Ceiling:</span>
                  <span className="font-semibold text-slate-800">
                    {plan.max_staff_seats >= 9999 ? 'Unlimited' : `${plan.max_staff_seats} seats`}
                  </span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="mt-5 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Home Page Features ({plan.features.length})</span>
                </div>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2 text-xs text-slate-600">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live on Home Page
              </span>
              <button
                type="button"
                onClick={() => handleStartEdit(plan)}
                className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
              >
                Modify Tier →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT PRICING PLAN MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Configure Tier: <span className="font-mono text-indigo-600">{editingPlan.id}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Updates will immediately reflect on the public landing page.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Notification inside modal */}
              {notification && (
                <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  notification.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {notification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{notification.message}</span>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Tier Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-edit-tier-name"
                    type="text"
                    required
                    value={editingPlan.tier_name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, tier_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. Starter Fishery"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Staff Seats Ceiling <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input-edit-max-seats"
                    type="number"
                    min="1"
                    required
                    value={editingPlan.max_staff_seats}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_staff_seats: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tagline / Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-edit-tagline"
                  rows={2}
                  required
                  value={editingPlan.tagline}
                  onChange={(e) => setEditingPlan({ ...editingPlan, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Short value proposition visible below tier title"
                />
              </div>

              {/* Pricing Matrix */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  <span>Pricing Configuration (USD & GHS MoMo)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Monthly USD ($)
                    </label>
                    <input
                      id="input-price-monthly-usd"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editingPlan.monthly_price_usd}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingPlan({ 
                          ...editingPlan, 
                          monthly_price_usd: val,
                          monthly_price_ghs: Math.round(val * 13) 
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Annual USD ($/mo)
                    </label>
                    <input
                      id="input-price-annual-usd"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editingPlan.annual_price_usd}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingPlan({ 
                          ...editingPlan, 
                          annual_price_usd: val,
                          annual_price_ghs: Math.round(val * 13)
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Monthly GHS (GH₵)
                    </label>
                    <input
                      id="input-price-monthly-ghs"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editingPlan.monthly_price_ghs}
                      onChange={(e) => setEditingPlan({ ...editingPlan, monthly_price_ghs: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Annual GHS (GH₵/mo)
                    </label>
                    <input
                      id="input-price-annual-ghs"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editingPlan.annual_price_ghs}
                      onChange={(e) => setEditingPlan({ ...editingPlan, annual_price_ghs: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Popular Badge & Highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <input
                    id="checkbox-is-popular"
                    type="checkbox"
                    checked={editingPlan.is_popular}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="checkbox-is-popular" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Highlight as &quot;Most Popular&quot; Tier
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Badge Label (Optional)
                  </label>
                  <input
                    id="input-badge-label"
                    type="text"
                    value={editingPlan.badge || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="e.g. Most Popular, Best Value"
                  />
                </div>
              </div>

              {/* Feature Bullet Points Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Home Page Features List ({editingPlan.features.length})
                </label>
                <div className="space-y-2 mb-2 max-h-44 overflow-y-auto pr-1">
                  {editingPlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => {
                          const updated = [...editingPlan.features];
                          updated[idx] = e.target.value;
                          setEditingPlan({ ...editingPlan, features: updated });
                        }}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                        title="Delete feature"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="input-new-feature"
                    type="text"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="Type a new feature bullet point..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Call-to-action button text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CTA Button Label
                </label>
                <input
                  id="input-button-text"
                  type="text"
                  value={editingPlan.button_text}
                  onChange={(e) => setEditingPlan({ ...editingPlan, button_text: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Start 14-Day Free Trial"
                />
              </div>

              {/* Mandatory Audit Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Audit Logging Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-pricing-audit-reason"
                  required
                  rows={2}
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. Adjusting seasonal commercial fleet pricing and adding IoT telemetry feature point"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-pricing-plan"
                  type="submit"
                  disabled={saving || !auditReason.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Plan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Publish to Home Page</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
