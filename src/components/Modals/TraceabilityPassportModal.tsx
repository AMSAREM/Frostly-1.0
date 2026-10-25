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
  Layers,
  Camera,
  ZoomIn
} from 'lucide-react';
import { InventoryBatch, RetailWholesaleProduct } from '../../types';
import { TraceabilityQRCode } from '../TraceabilityQRCode';
import { formatTemp, formatWeight } from '../../utils/formatters';
import { resolveBatchImage } from '../../utils/productImageResolver';
import { ImageLightboxModal, ImageLightboxDetails } from '../Common/ImageLightboxModal';

interface TraceabilityPassportModalProps {
  batch: InventoryBatch | null;
  products?: RetailWholesaleProduct[];
  onClose: () => void;
  useImperial: boolean;
}

export const TraceabilityPassportModal: React.FC<TraceabilityPassportModalProps> = ({
  batch,
  products = [],
  onClose,
  useImperial
}) => {
  const [lightboxDetails, setLightboxDetails] = React.useState<ImageLightboxDetails | null>(null);

  if (!batch) return null;

  const linkedProduct = products.find(p => 
    (batch.linkedProductId && p.id === batch.linkedProductId) ||
    (p.linkedBatchId && p.linkedBatchId === batch.id) ||
    (batch.productSku && p.sku && batch.productSku.toLowerCase() === p.sku.toLowerCase()) ||
    batch.id === `LOT-RET-${p.id.replace('prod-', '')}`
  );
  const resolvedImage = resolveBatchImage(batch, linkedProduct);

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
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 overflow-hidden">
          {batch.imageUrl && (
            <img 
              src={batch.imageUrl} 
              alt={batch.speciesName}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity filter saturate-150 pointer-events-none"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10">
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
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Top summary row with QR Code & Catch Visual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="sm:col-span-1 flex flex-col items-center justify-center gap-2">
              <TraceabilityQRCode
                seed={batch.qrCodeSeed}
                lotId={batch.id}
                species={batch.speciesName}
                size={110}
              />
              {batch.imageUrl && (
                <div className="relative w-28 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <img
                    src={batch.imageUrl}
                    alt={batch.speciesName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
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

          {/* Verified Photographic Evidence Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" />
                Verified Catch Specimen & Lot Photograph
              </h4>
              {resolvedImage.url && (
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" />
                  Click to inspect full resolution
                </span>
              )}
            </div>

            {resolvedImage.url ? (
              <div
                onClick={() => setLightboxDetails({
                  imageUrl: resolvedImage.url!,
                  title: batch.speciesName,
                  subtitle: `${batch.scientificName} · Lot ${batch.id}`,
                  sourceLabel: resolvedImage.source === 'product' ? 'Catalog Cut Photo' : 'Intake Dock Photo',
                  sourceType: resolvedImage.source === 'product' ? 'product' : 'batch',
                  lotId: batch.id,
                  grade: batch.grade,
                  origin: `${batch.landingPort} (${batch.faoArea})`,
                  temperature: `${formatTemp(batch.coreTempCelsius, useImperial)}`,
                  verifiedAt: batch.harvestDate,
                })}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all flex flex-col sm:flex-row items-center gap-4 p-3"
              >
                <div className="relative w-full sm:w-44 h-36 shrink-0 rounded-lg overflow-hidden bg-slate-950">
                  <img
                    src={resolvedImage.url}
                    alt={resolvedImage.alt}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logofrostly1.png';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors flex items-center justify-center sm:hidden">
                    <span className="bg-slate-950/80 text-white text-[10px] px-2 py-1 rounded-md">Tap to view full resolution</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700 flex-1 min-w-0 w-full">
                  <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                    <span>{batch.speciesName} Specimen</span>
                    <span className="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-indigo-700 font-bold">
                      Grade {batch.grade}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Digital visual inspection record logged during pier intake. Verifies skin luster, pupil clarity, and temperature integrity at dock receiver.
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono-code pt-1">
                    <span>Lot #{batch.id}</span>
                    <span>•</span>
                    <span>Vessel: {batch.vesselName}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-white text-center text-slate-400 text-xs">
                <Camera className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <p className="font-medium text-slate-600">No physical intake photo recorded for this lot yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Photographs uploaded during intake or catalog editing will display in this passport verification report.</p>
              </div>
            )}
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

      {/* High-Resolution Specimen Preview Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxDetails)}
        onClose={() => setLightboxDetails(null)}
        details={lightboxDetails}
      />
    </div>
  );
};
