import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Anchor, 
  Thermometer, 
  ShieldCheck, 
  MapPin, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { InventoryBatch, Species, QualityGrade, StorageZone } from '../../types';
import { SPECIES_CATALOG } from '../../data/mockData';

interface NewBatchModalProps {
  onClose: () => void;
  onAddBatch: (batch: InventoryBatch) => void;
  useImperial: boolean;
}

export const NewBatchModal: React.FC<NewBatchModalProps> = ({
  onClose,
  onAddBatch,
  useImperial
}) => {
  const defaultSpecies = SPECIES_CATALOG[0] || {
    id: 'spec-general',
    name: 'Standard Catch',
    scientificName: '',
    category: 'Pelagic' as const,
    defaultZone: 'Commercial Cold Storage (-22°C)' as StorageZone,
    standardPricePerKg: 35.0,
    availableGrades: ['Sashimi AAA', 'Grade #1', 'Grade #2'] as QualityGrade[],
    faoZones: ['FAO 61 (Northwest Pacific)', 'FAO 71 (Western Central Pacific)'],
    gearTypes: ['Pelagic Longline', 'Handline'],
    seasonalPeak: 'Year-Round',
    image: '',
    shelfLifeFreshDays: 7,
    shelfLifeFrozenMonths: 18
  };

  const [selectedSpeciesId, setSelectedSpeciesId] = useState(defaultSpecies.id);
  const selectedSpecies = SPECIES_CATALOG.find(s => s.id === selectedSpeciesId) || defaultSpecies;

  const [vesselName, setVesselName] = useState('');
  const [vesselReg, setVesselReg] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [landingPort, setLandingPort] = useState('');
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [faoArea, setFaoArea] = useState(selectedSpecies.faoZones[0] || 'FAO 61');
  const [gearType, setGearType] = useState(selectedSpecies.gearTypes[0] || 'Pelagic Longline');
  const [grade, setGrade] = useState<QualityGrade>(selectedSpecies.availableGrades[0] || 'Grade #1');
  const [weightKg, setWeightKg] = useState<number>(100);
  const [storageZone, setStorageZone] = useState<StorageZone>(selectedSpecies.defaultZone);
  const [coreTemp, setCoreTemp] = useState<number>(
    selectedSpecies.defaultZone.includes('-60') ? -59.2 : selectedSpecies.defaultZone.includes('-22') ? -22.0 : 1.2
  );
  const [histaminePpm, setHistaminePpm] = useState<number>(2.0);
  const [costPerKg, setCostPerKg] = useState<number>(Number((selectedSpecies.standardPricePerKg * 0.65).toFixed(2)));
  const [wholesalePrice, setWholesalePrice] = useState<number>(selectedSpecies.standardPricePerKg);
  const [certifications, setCertifications] = useState<string[]>(['FDA HACCP Title 21']);
  const [notes, setNotes] = useState('');

  const availableCerts = ['MSC Certified', 'ASC Certified', 'FDA HACCP Title 21', 'Friend of the Sea', 'Iki-Jime Humane Seal', 'GlobalG.A.P.'];

  const toggleCert = (cert: string) => {
    if (certifications.includes(cert)) {
      setCertifications(certifications.filter(c => c !== cert));
    } else {
      setCertifications([...certifications, cert]);
    }
  };

  const handleSpeciesChange = (speciesId: string) => {
    setSelectedSpeciesId(speciesId);
    const sp = SPECIES_CATALOG.find(s => s.id === speciesId);
    if (sp) {
      setFaoArea(sp.faoZones[0]);
      setGearType(sp.gearTypes[0]);
      setGrade(sp.availableGrades[0]);
      setStorageZone(sp.defaultZone);
      setWholesalePrice(sp.standardPricePerKg);
      setCostPerKg(Number((sp.standardPricePerKg * 0.65).toFixed(2)));
      setCoreTemp(sp.defaultZone.includes('-60') ? -59.2 : sp.defaultZone.includes('-22') ? -22.0 : 1.2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lotId = `LOT-${new Date().getFullYear()}-${selectedSpecies.category.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newBatch: InventoryBatch = {
      id: lotId,
      speciesId: selectedSpecies.id,
      speciesName: selectedSpecies.name,
      scientificName: selectedSpecies.scientificName,
      category: selectedSpecies.category,
      harvestDate,
      landingPort,
      vesselName,
      vesselRegistration: vesselReg,
      captainName,
      faoArea,
      coordinates: {
        lat: 37.8080,
        lng: -122.4177,
        description: 'Coastal Fishery Sector'
      },
      gearType,
      grade,
      initialWeightKg: Number(weightKg),
      availableWeightKg: Number(weightKg),
      allocatedWeightKg: 0,
      storageZone,
      currentTempCelsius: coreTemp,
      targetTempCelsius: storageZone.includes('-60') ? -60 : storageZone.includes('-22') ? -22 : 1.0,
      costPerKg: Number(costPerKg),
      wholesalePricePerKg: Number(wholesalePrice),
      certifications,
      inspectionStatus: 'Passed',
      histaminePpm: Number(histaminePpm),
      coreTempCelsius: Number(coreTemp),
      receivedDate: new Date().toISOString().split('T')[0],
      expiryDate: '2027-08-20',
      qrCodeSeed: `FROST-PASS-${lotId}-${Date.now()}`,
      notes
    };

    onAddBatch(newBatch);
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
            <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5" />
              Dock Intake & Inspection Log
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
            Register Landed Seafood Haul
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Generates immutable Lot ID, QR Digital Passport, and HACCP compliance manifest.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 text-xs text-slate-700">
          {/* Species Selection */}
          <div>
            <label className="block font-bold text-slate-900 mb-1.5">
              Select Marine Species & Catch Category
            </label>
            <select
              value={selectedSpeciesId}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {SPECIES_CATALOG.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.scientificName}) — {s.category}
                </option>
              ))}
            </select>
          </div>

          {/* Vessel & Catch Origin Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vessel Name</label>
              <input
                type="text"
                required
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vessel Reg & Captain</label>
              <input
                type="text"
                required
                value={`${vesselReg} (${captainName})`}
                onChange={(e) => {
                  setVesselReg(e.target.value.split(' ')[0] || 'US-CA-001');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Landing Port</label>
              <input
                type="text"
                required
                value={landingPort}
                onChange={(e) => setLandingPort(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Harvest Date</label>
              <input
                type="date"
                required
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">FAO Catch Zone</label>
              <input
                type="text"
                required
                value={faoArea}
                onChange={(e) => setFaoArea(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Harvest Gear Method</label>
              <input
                type="text"
                required
                value={gearType}
                onChange={(e) => setGearType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Weight, Grade, Storage & Quality Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Net Intake Weight ({useImperial ? 'lbs' : 'kg'})
              </label>
              <input
                type="number"
                required
                min={1}
                step={0.5}
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quality Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as QualityGrade)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              >
                {selectedSpecies.availableGrades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Core Temp (°C)</label>
              <input
                type="number"
                step={0.1}
                value={coreTemp}
                onChange={(e) => setCoreTemp(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-emerald-700 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Histamine (ppm)</label>
              <input
                type="number"
                step={0.1}
                value={histaminePpm}
                onChange={(e) => setHistaminePpm(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cost / kg ($)</label>
              <input
                type="number"
                step={0.5}
                value={costPerKg}
                onChange={(e) => setCostPerKg(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Wholesale Price / kg ($)</label>
              <input
                type="number"
                step={0.5}
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-indigo-700 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Certifications Selection */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              Attach Sustainability & Regulatory Certifications
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCerts.map((cert) => {
                const isSelected = certifications.includes(cert);
                return (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleCert(cert)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{cert}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Inspector Sensory & Handling Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer actions */}
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold shadow-md shadow-indigo-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Intake Batch into Cold Storage</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
