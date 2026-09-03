import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Thermometer, 
  CheckCircle, 
  AlertOctagon, 
  FileCheck, 
  FlaskConical,
  Award
} from 'lucide-react';
import { HaccpAuditRecord, InventoryBatch } from '../../types';

interface HaccpInspectionModalProps {
  batches: InventoryBatch[];
  onClose: () => void;
  onAddAuditRecord: (record: HaccpAuditRecord) => void;
  useImperial: boolean;
}

export const HaccpInspectionModal: React.FC<HaccpInspectionModalProps> = ({
  batches,
  onClose,
  onAddAuditRecord,
  useImperial
}) => {
  const [selectedLotId, setSelectedLotId] = useState(batches[0]?.id || 'LOT-2026-BFT-0982');
  const selectedBatch = batches.find(b => b.id === selectedLotId) || batches[0];

  const [inspectorName, setInspectorName] = useState('Dr. Hiroshi Tanaka (Senior HACCP Lead)');
  const [inspectorId, setInspectorId] = useState('QC-JP-941');
  const [coreTemp, setCoreTemp] = useState<number>(selectedBatch?.coreTempCelsius ?? -58.2);
  const [histaminePpm, setHistaminePpm] = useState<number>(4.2);
  const [organolepticScore, setOrganolepticScore] = useState<number>(9.8);
  const [parasiteVisualCheck, setParasiteVisualCheck] = useState<HaccpAuditRecord['parasiteVisualCheck']>('Clean');
  const [sanitizationLogPass, setSanitizationLogPass] = useState(true);
  const [finalCompliance, setFinalCompliance] = useState<HaccpAuditRecord['finalCompliance']>('Approved - Grade AAA');
  const [certificationRef, setCertificationRef] = useState('FDA Title 21 CFR § 123.6 / NOAA Seafood Inspection');
  const [notes, setNotes] = useState('Organoleptic testing verified: firm muscle elasticity, clear ocean salinity scent, zero surface dehydration.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: HaccpAuditRecord = {
      id: `HACCP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(10 + Math.random() * 89)}`,
      lotId: selectedLotId,
      speciesName: selectedBatch?.speciesName || 'Pacific Bluefin Tuna',
      inspectionDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      inspectorName,
      inspectorId,
      coreTemperature: Number(coreTemp),
      histamineLevelPpm: Number(histaminePpm),
      organolepticScore: Number(organolepticScore),
      parasiteVisualCheck,
      sanitizationLogPass,
      finalCompliance,
      certificationRef,
      notes
    };

    onAddAuditRecord(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Critical Control Point (CCP) QA Audit
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
            Record HACCP Inspection Audit
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Compliant with FDA Title 21 CFR § 123 Seafood HACCP & EU Sanitation Directives.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 text-xs text-slate-700">
          {/* Lot Selector */}
          <div>
            <label className="block font-bold text-slate-900 mb-1.5">
              Target Seafood Inventory Lot ID
            </label>
            <select
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value);
                const b = batches.find(item => item.id === e.target.value);
                if (b) {
                  setCoreTemp(b.coreTempCelsius);
                  setHistaminePpm(b.histaminePpm ?? 3.0);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} — {b.speciesName} ({b.grade}) [{b.storageZone}]
                </option>
              ))}
            </select>
          </div>

          {/* Inspector Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lead Inspector Name</label>
              <input
                type="text"
                required
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Inspector ID / Badge #</label>
              <input
                type="text"
                required
                value={inspectorId}
                onChange={(e) => setInspectorId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Critical HACCP Measurements */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-indigo-600" />
                Internal Core Temp (°C)
              </label>
              <input
                type="number"
                step={0.1}
                required
                value={coreTemp}
                onChange={(e) => setCoreTemp(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-emerald-700 font-mono-code"
              />
              <div className="text-[10px] text-slate-400 mt-1">Fresh limit: &lt;4.4°C / Frozen &lt;-18°C</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                Histamine Level (ppm)
              </label>
              <input
                type="number"
                step={0.1}
                required
                value={histaminePpm}
                onChange={(e) => setHistaminePpm(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900 font-mono-code"
              />
              <div className="text-[10px] text-slate-400 mt-1">FDA Legal Limit: &lt;50 ppm</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                Sensory Score (1-10)
              </label>
              <input
                type="number"
                step={0.1}
                min={1}
                max={10}
                required
                value={organolepticScore}
                onChange={(e) => setOrganolepticScore(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900 font-mono-code"
              />
              <div className="text-[10px] text-slate-400 mt-1">Sashimi Grade requires &gt;9.0</div>
            </div>
          </div>

          {/* Qualitative Checks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Visual Parasite / Candling Check</label>
              <select
                value={parasiteVisualCheck}
                onChange={(e) => setParasiteVisualCheck(e.target.value as HaccpAuditRecord['parasiteVisualCheck'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900"
              >
                <option value="Clean">Clean (Zero Parasites / Foreign Matter)</option>
                <option value="Pass with Trimming">Pass with Trimming (Minor Surface Defect)</option>
                <option value="Failed">Failed (Critical Deviation)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Final Compliance Determination</label>
              <select
                value={finalCompliance}
                onChange={(e) => setFinalCompliance(e.target.value as HaccpAuditRecord['finalCompliance'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-emerald-800"
              >
                <option value="Approved - Grade AAA">Approved - Grade AAA (Sashimi Raw Consumption)</option>
                <option value="Approved - Standard">Approved - Standard (Cooked / Commercial)</option>
                <option value="Quarantine - Re-inspect">Quarantine - Re-inspect</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Audit Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Audit Findings & Corrective Actions</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md shadow-emerald-200 cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Certify & Sign HACCP Audit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
