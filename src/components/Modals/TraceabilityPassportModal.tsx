import React from 'react';
import { 
  X, 
  ShieldCheck, 
  MapPin, 
  Anchor, 
  Calendar, 
  Thermometer, 
  CheckCircle2, 
  Printer, 
  Share2, 
  FileText,
  Award,
  Layers
} from 'lucide-react';
import { InventoryBatch } from '../../types';
import { TraceabilityQRCode } from '../TraceabilityQRCode';
import { formatTemp, formatWeight } from '../../utils/formatters';

interface TraceabilityPassportModalProps {
  batch: InventoryBatch | null;
  onClose: () => void;
  useImperial: boolean;
}

export const TraceabilityPassportModal: React.FC<TraceabilityPassportModalProps> = ({
  batch,
  onClose,
  useImperial
}) => {
  if (!batch) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="traceability-passport-card"
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Seafood Digital Passport
            </span>
            <span className="text-xs text-slate-300 font-mono-code">
              ISO 12875 / GDST 1.2
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
            {batch.speciesName}
          </h2>
          <p className="text-sm italic text-indigo-200 mt-0.5">
            {batch.scientificName}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="font-mono-code font-bold bg-white/10 px-2.5 py-1 rounded-lg">
              {batch.id}
            </span>
            <span>•</span>
            <span>Grade: <strong className="text-white">{batch.grade}</strong></span>
            <span>•</span>
            <span>Storage: <strong className="text-white">{batch.storageZone}</strong></span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Top summary row with QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="sm:col-span-1 flex justify-center">
              <TraceabilityQRCode
                seed={batch.qrCodeSeed}
                lotId={batch.id}
                species={batch.speciesName}
                size={130}
              />
            </div>
            <div className="sm:col-span-2 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Available Batch Yield:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatWeight(batch.availableWeightKg, useImperial)} / {formatWeight(batch.initialWeightKg, useImperial)} total
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Landed Core Temperature:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5" />
                  {formatTemp(batch.coreTempCelsius, useImperial)} (Optimal)
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Histamine Level Test:</span>
                <span className="font-bold text-slate-900">
                  {batch.histaminePpm ? `${batch.histaminePpm} ppm (Limit < 50 ppm)` : 'Not required / Safe'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Inspection Status:</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {batch.inspectionStatus} & Certified
                </span>
              </div>
            </div>
          </div>

          {/* Catch & Harvest Origin Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Anchor className="w-4 h-4 text-indigo-600" />
              Harvest & Vessel Provenance
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-500 font-medium">Harvest Vessel</div>
                <div className="font-bold text-slate-900 mt-0.5">{batch.vesselName}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Reg: {batch.vesselRegistration} • {batch.captainName}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-500 font-medium">Landing Port & Date</div>
                <div className="font-bold text-slate-900 mt-0.5">{batch.landingPort}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Landed: {batch.landingPort ? `${batch.harvestDate}` : 'Recent'}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-500 font-medium">FAO Catch Zone</div>
                <div className="font-bold text-slate-900 mt-0.5">{batch.faoArea}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-500" />
                  {batch.coordinates.lat.toFixed(4)}°N, {batch.coordinates.lng.toFixed(4)}°W ({batch.coordinates.description})
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-500 font-medium">Harvest Gear & Method</div>
                <div className="font-bold text-slate-900 mt-0.5">{batch.gearType}</div>
                <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Target species selective (Zero-Bycatch)</div>
              </div>
            </div>
          </div>

          {/* Certifications & Sustainability Seals */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              Sustainability & Chain of Custody Credentials
            </h4>
            <div className="flex flex-wrap gap-2">
              {batch.certifications.map((cert, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  {cert}
                </div>
              ))}
            </div>
          </div>

          {/* Sensory & Handling Notes */}
          {batch.notes && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-950">
              <span className="font-bold text-amber-900">Master Inspector Assessment: </span>
              {batch.notes}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-mono-code hidden sm:block">
            UID: {batch.qrCodeSeed}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Traceability Label
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
