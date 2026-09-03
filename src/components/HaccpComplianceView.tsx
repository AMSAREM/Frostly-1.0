import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileCheck, 
  Plus, 
  Search, 
  Award, 
  FlaskConical, 
  Thermometer, 
  CheckCircle2, 
  AlertTriangle, 
  FileText,
  Lock,
  Download
} from 'lucide-react';
import { HaccpAuditRecord, InventoryBatch } from '../types';
import { formatTemp } from '../utils/formatters';

interface HaccpComplianceViewProps {
  auditRecords: HaccpAuditRecord[];
  batches: InventoryBatch[];
  onOpenNewAuditModal: () => void;
  useImperial: boolean;
}

export const HaccpComplianceView: React.FC<HaccpComplianceViewProps> = ({
  auditRecords,
  batches,
  onOpenNewAuditModal,
  useImperial
}) => {
  const [search, setSearch] = useState('');
  const [filterCompliance, setFilterCompliance] = useState('All');

  const filteredRecords = auditRecords.filter((r) => {
    const matchesSearch = 
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.lotId.toLowerCase().includes(search.toLowerCase()) ||
      r.speciesName.toLowerCase().includes(search.toLowerCase()) ||
      r.inspectorName.toLowerCase().includes(search.toLowerCase());

    const matchesCompliance = filterCompliance === 'All' || r.finalCompliance === filterCompliance;

    return matchesSearch && matchesCompliance;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider border border-emerald-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                FDA Title 21 CFR § 123 Certified Vault
              </span>
              <span className="text-xs text-slate-400 font-mono-code">
                {auditRecords.length} Audits Certified
              </span>
            </div>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1.5">
              Quality Assurance & HACCP Compliance Vault
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Critical Control Point (CCP) audits, histamine level assays, cold-dock sanitization, and sensory evaluations.
            </p>
          </div>

          <button
            onClick={onOpenNewAuditModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record HACCP Audit</span>
          </button>
        </div>

        {/* CCP Standards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-indigo-600" />
              CCP-1: Critical Internal Temp
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Fresh raw seafood must maintain core internal temperature &lt;4.4°C (40°F). Deep cryo &lt;-18°C.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4 text-indigo-600" />
              CCP-2: Histamine Scombroid Limit
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pelagic species (Tuna, Mackerel) histamine levels must remain strictly below 50 ppm threshold.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              CCP-3: Organoleptic Sensory & Hygiene
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Visual candling check for parasites, muscle elasticity testing, and ATP bioluminescence surface swab.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Table & Search */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by lot ID, inspector, or species..."
              className="w-full bg-slate-50 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterCompliance}
            onChange={(e) => setFilterCompliance(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="All">All Compliance Outcomes</option>
            <option value="Approved - Grade AAA">Approved - Grade AAA</option>
            <option value="Approved - Standard">Approved - Standard</option>
            <option value="Quarantine - Re-inspect">Quarantine - Re-inspect</option>
          </select>
        </div>

        {/* Mobile Audit Cards */}
        <div className="space-y-3 md:hidden">
          {filteredRecords.map((record) => {
            const isGradeAAA = record.finalCompliance === 'Approved - Grade AAA';
            return (
              <div key={record.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{record.speciesName}</div>
                    <div className="text-[11px] font-mono-code text-indigo-600 font-semibold">{record.lotId}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 inline-flex items-center gap-1 ${
                    isGradeAAA ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    <CheckCircle2 className="w-3 h-3" />
                    {record.finalCompliance.split(' - ')[1] || record.finalCompliance}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-white p-2.5 rounded-xl border border-slate-200/70 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Temp</div>
                    <div className="font-mono-code font-bold text-emerald-700 mt-0.5">{formatTemp(record.coreTemperature, useImperial)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Histamine</div>
                    <div className="font-mono-code font-bold text-slate-900 mt-0.5">{record.histamineLevelPpm} ppm</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Sensory</div>
                    <div className="font-mono-code font-bold text-indigo-700 mt-0.5">{record.organolepticScore.toFixed(1)}/10</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Inspector: <strong className="text-slate-700 font-semibold">{record.inspectorName}</strong></span>
                  <span className="font-mono-code text-slate-400">{record.inspectionDate}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Audit Records Table (Desktop & Tablets) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-3">Audit ID & Date</th>
                <th className="py-3 px-3">Seafood Lot Reference</th>
                <th className="py-3 px-3">Inspector Badge</th>
                <th className="py-3 px-3 text-right">Core Temp</th>
                <th className="py-3 px-3 text-right">Histamine</th>
                <th className="py-3 px-3 text-right">Sensory Score</th>
                <th className="py-3 px-3 text-center">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const isGradeAAA = record.finalCompliance === 'Approved - Grade AAA';
                return (
                  <tr key={record.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono-code font-bold text-slate-900">{record.id}</div>
                      <div className="text-[10px] text-slate-400">{record.inspectionDate}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{record.speciesName}</div>
                      <div className="font-mono-code text-[11px] text-indigo-600 font-semibold">{record.lotId}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <div>{record.inspectorName}</div>
                      <div className="text-[10px] font-mono-code text-slate-400">{record.inspectorId}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono-code font-bold text-emerald-700">
                      {formatTemp(record.coreTemperature, useImperial)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-code font-bold text-slate-900">
                      {record.histamineLevelPpm} ppm
                    </td>
                    <td className="py-3 px-3 text-right font-mono-code font-bold text-indigo-700">
                      {record.organolepticScore.toFixed(1)} / 10
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        isGradeAAA ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {record.finalCompliance}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
