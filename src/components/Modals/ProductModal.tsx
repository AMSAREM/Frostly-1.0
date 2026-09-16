import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  Image as ImageIcon, 
  DollarSign, 
  Link as LinkIcon, 
  Sparkles, 
  Check, 
  AlertCircle,
  Upload,
  Info
} from 'lucide-react';
import { 
  RetailWholesaleProduct, 
  InventoryBatch, 
  SeafoodCutType, 
  SpeciesCategory, 
  QualityGrade 
} from '../../types';
import { SPECIES_CATALOG } from '../../data/mockData';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProduct: (product: RetailWholesaleProduct) => Promise<void> | void;
  editingProduct?: RetailWholesaleProduct | null;
  productToEdit?: RetailWholesaleProduct | null;
  batches?: InventoryBatch[];
  inventoryBatches?: InventoryBatch[];
  formatCurrency?: (val: number) => string;
}

const CUT_TYPES: SeafoodCutType[] = [
  'Skinless Sashimi Saku Block',
  'Skin-On Loin / Fillet',
  'Whole Round Fish',
  'Headless & Gutted (H&G)',
  'Packaged 500g Tray',
  'Live in Oxygen Tank',
  'IQF Flash Frozen Box',
];

const QUALITY_GRADES: QualityGrade[] = [
  'Sashimi AAA',
  'Grade #1',
  'Grade #2',
  'Processing Grade',
  'Live Prime',
];

const CATEGORIES: SpeciesCategory[] = [
  'Pelagic',
  'Salmonid',
  'Crustacean',
  'Mollusk',
  'Groundfish',
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSaveProduct,
  editingProduct: editingProductProp,
  productToEdit,
  batches: batchesProp = [],
  inventoryBatches = [],
  formatCurrency = (val: number) => `$${val.toFixed(2)}`,
}) => {
  const editingProduct = editingProductProp ?? productToEdit ?? null;
  const batches = batchesProp.length > 0 ? batchesProp : inventoryBatches;
  const isEditing = Boolean(editingProduct);

  const [name, setName] = useState(editingProduct?.name || '');
  const [speciesId, setSpeciesId] = useState(editingProduct?.speciesId || 'spec-bluefin');
  const [cutType, setCutType] = useState<SeafoodCutType>(editingProduct?.cutType || 'Skinless Sashimi Saku Block');
  const [category, setCategory] = useState<SpeciesCategory>(editingProduct?.category || 'Pelagic');
  const [grade, setGrade] = useState<QualityGrade>(editingProduct?.grade || 'Sashimi AAA');
  const [unit, setUnit] = useState<'kg' | 'lb' | 'piece' | 'pack'>(editingProduct?.unit || 'kg');
  const [retailPackSize, setRetailPackSize] = useState(editingProduct?.retailPackSize || '250g Vacuum Pack');
  const [sku, setSku] = useState(editingProduct?.sku || '');
  const [origin, setOrigin] = useState(editingProduct?.origin || 'Pacific Ocean / San Francisco');
  const [imageUrl, setImageUrl] = useState(editingProduct?.imageUrl || '');
  const [stockKg, setStockKg] = useState<number>(editingProduct?.stockKg ?? 25);
  const [costPrice, setCostPrice] = useState<number>(editingProduct?.costPricePerUnit ?? 45);
  const [wholesalePrice, setWholesalePrice] = useState<number>(editingProduct?.wholesalePricePerUnit ?? 65);
  const [retailPrice, setRetailPrice] = useState<number>(editingProduct?.retailPricePerUnit ?? 89);
  const [wholesaleMinQty, setWholesaleMinQty] = useState<number>(editingProduct?.wholesaleMinQty ?? 5);
  const [isAvailableRetail, setIsAvailableRetail] = useState<boolean>(editingProduct?.isAvailableForRetail ?? true);
  const [isAvailableWholesale, setIsAvailableWholesale] = useState<boolean>(editingProduct?.isAvailableForWholesale ?? true);

  // Link to an active Inventory Batch Lot (optional helper)
  const [linkedBatchId, setLinkedBatchId] = useState<string>('');
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state if editingProduct prop updates
  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setSpeciesId(editingProduct.speciesId);
      setCutType(editingProduct.cutType);
      setCategory(editingProduct.category);
      setGrade(editingProduct.grade);
      setUnit(editingProduct.unit);
      setRetailPackSize(editingProduct.retailPackSize || '250g Vacuum Pack');
      setSku(editingProduct.sku);
      setOrigin(editingProduct.origin);
      setImageUrl(editingProduct.imageUrl);
      setStockKg(editingProduct.stockKg);
      setCostPrice(editingProduct.costPricePerUnit);
      setWholesalePrice(editingProduct.wholesalePricePerUnit);
      setRetailPrice(editingProduct.retailPricePerUnit);
      setWholesaleMinQty(editingProduct.wholesaleMinQty);
      setIsAvailableRetail(editingProduct.isAvailableForRetail);
      setIsAvailableWholesale(editingProduct.isAvailableForWholesale);
      setImagePreviewError(false);
    } else {
      setName('');
      setSpeciesId('spec-bluefin');
      setCutType('Skinless Sashimi Saku Block');
      setCategory('Pelagic');
      setGrade('Sashimi AAA');
      setUnit('kg');
      setRetailPackSize('250g Vacuum Pack');
      setSku('');
      setOrigin('Pacific Ocean / San Francisco');
      setImageUrl('');
      setStockKg(25);
      setCostPrice(45);
      setWholesalePrice(65);
      setRetailPrice(89);
      setWholesaleMinQty(5);
      setIsAvailableRetail(true);
      setIsAvailableWholesale(true);
      setImagePreviewError(false);
      setLinkedBatchId('');
    }
  }, [editingProduct, isOpen]);

  // Auto-fill template when picking species
  const handleSelectSpecies = (spId: string) => {
    setSpeciesId(spId);
    const sp = SPECIES_CATALOG.find(s => s.id === spId);
    if (sp) {
      if (!isEditing && !name) {
        setName(`${sp.name.split('(')[0].trim()} Saku Cut`);
      }
      setCategory(sp.category);
      if (!imageUrl || imageUrl === '') {
        setImageUrl(sp.image);
        setImagePreviewError(false);
      }
      if (!isEditing && sp.standardPricePerKg) {
        setWholesalePrice(sp.standardPricePerKg);
        setRetailPrice(Math.round(sp.standardPricePerKg * 1.35));
        setCostPrice(Math.round(sp.standardPricePerKg * 0.65));
      }
    }
  };

  // When picking an Inventory Batch from the ledger
  const handleSelectBatch = (batchId: string) => {
    setLinkedBatchId(batchId);
    const b = batches.find(item => item.id === batchId);
    if (b) {
      if (!isEditing) {
        setName(`${b.speciesName.split('(')[0].trim()} (${cutType})`);
        setSpeciesId(b.speciesId);
        setCategory(b.category);
        setGrade(b.grade);
        setOrigin(b.landingPort || b.locationDescription || 'Pacific Coast');
        setCostPrice(b.costPerKg || 40);
        setWholesalePrice(b.wholesalePricePerKg || Math.round(b.costPerKg * 1.4));
        setRetailPrice(Math.round((b.wholesalePricePerKg || b.costPerKg * 1.4) * 1.3));
        setStockKg(Math.min(b.availableWeightKg, 50));
        setSku(`SKU-${b.speciesId.replace('spec-', '').toUpperCase().slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`);
      }
      const matchedSpecies = SPECIES_CATALOG.find(s => s.id === b.speciesId);
      if (matchedSpecies && (!imageUrl || imageUrl === '')) {
        setImageUrl(matchedSpecies.image);
        setImagePreviewError(false);
      }
    }
  };

  // Generate suggested SKU
  useEffect(() => {
    if (!sku && !isEditing) {
      const spPrefix = speciesId.replace('spec-', '').toUpperCase().slice(0, 4);
      const cutPrefix = cutType.slice(0, 3).toUpperCase();
      setSku(`SKU-${spPrefix}-${cutPrefix}-${Math.floor(100 + Math.random() * 900)}`);
    }
  }, [speciesId, cutType, isEditing, sku]);

  // Handle local image file selection / upload as base64 or object URL
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 2MB limit. Please choose a smaller image or use an image URL.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageUrl(result);
      setImagePreviewError(false);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }
    if (!imageUrl.trim()) {
      setErrorMsg('Please provide a product image URL or upload an image file so it appears clearly on the POS counter.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const finalProduct: RetailWholesaleProduct = {
        id: editingProduct?.id || `prod-${Date.now()}`,
        speciesId,
        name: name.trim(),
        cutType,
        category,
        grade,
        stockKg: Number(stockKg) || 0,
        unit,
        costPricePerUnit: Number(costPrice) || 0,
        wholesalePricePerUnit: Number(wholesalePrice) || 0,
        retailPricePerUnit: Number(retailPrice) || 0,
        wholesaleMinQty: Number(wholesaleMinQty) || 1,
        retailPackSize: retailPackSize.trim() || undefined,
        sku: sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        imageUrl: imageUrl.trim(),
        origin: origin.trim() || 'Cold-Chain Certified Fleet',
        isAvailableForRetail: isAvailableRetail,
        isAvailableForWholesale: isAvailableWholesale,
      };

      await onSaveProduct(finalProduct);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save product to database');
    } finally {
      setIsSaving(false);
    }
  };

  const retailMarginPct = retailPrice > 0 ? ((retailPrice - costPrice) / retailPrice) * 100 : 0;
  const wholesaleMarginPct = wholesalePrice > 0 ? ((wholesalePrice - costPrice) / wholesalePrice) * 100 : 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Edit Product & Image' : 'Add Retail Product / POS Cut'}
              </h2>
              <p className="text-xs text-slate-300">
                Configure item image, pricing matrix, and link to inventory ledger
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Quick Helper: Link to an active Inventory Batch */}
          {batches.length > 0 && !isEditing && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Link from Inventory Ledger Catch (Optional Autofill)</span>
                </label>
                <span className="text-[11px] text-indigo-600 font-medium">Autofills species & costs</span>
              </div>
              <select
                value={linkedBatchId}
                onChange={(e) => handleSelectBatch(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-indigo-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose lot from Inventory Ledger --</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} • {b.speciesName} ({b.availableWeightKg} kg available @ {formatCurrency(b.costPerKg)}/kg)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section 1: Visual Image & Appearance on POS */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Product Picture (Renders on POS Grid)</span>
              </label>
              <span className="text-[11px] text-slate-500">Square 1:1 or 4:3 high-res photo</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Image Preview Box */}
              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center relative group">
                {imageUrl && !imagePreviewError ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    onError={() => setImagePreviewError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                    <span className="text-[10px] block font-medium">No Image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold pointer-events-none">
                  Live POS Preview
                </div>
              </div>

              {/* Input for URL or Upload */}
              <div className="flex-1 space-y-2.5 w-full">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Image URL (CDN, Supabase Bucket, or Web Link)
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or Supabase storage URL"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImagePreviewError(false);
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono-code focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload from Device</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">PNG, JPG, WebP up to 2MB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Cut, Name, Species & Taxonomy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Product Display Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bluefin Tuna Saku Block (AAA)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Species</label>
              <select
                value={speciesId}
                onChange={(e) => handleSelectSpecies(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {SPECIES_CATALOG.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cut Style & Format</label>
              <select
                value={cutType}
                onChange={(e) => setCutType(e.target.value as SeafoodCutType)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {CUT_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quality Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as QualityGrade)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {QUALITY_GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SKU / Item Code</label>
              <input
                type="text"
                placeholder="SKU-BF-SAKU-101"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono-code font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Harvest Origin / Region</label>
              <input
                type="text"
                placeholder="e.g. Pacific Northwest / FAO 67"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Section 3: Stock & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Current Stock</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={stockKg}
                  onChange={(e) => setStockKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs font-mono-code font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <span className="absolute right-3 top-2 text-xs font-medium text-slate-400">{unit}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Unit of Measure</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="kg">kg (Kilograms)</option>
                <option value="lb">lb (Pounds)</option>
                <option value="pack">pack (Retail Prepack)</option>
                <option value="piece">piece (Whole Unit)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Retail Pack Size</label>
              <input
                type="text"
                placeholder="e.g. 250g Vacuum Tray"
                value={retailPackSize}
                onChange={(e) => setRetailPackSize(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Section 4: Dual Price Book Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900">Dual Pricing & Profit Margins</label>
              <span className="text-[11px] text-emerald-700 font-bold">
                Retail Margin: {retailMarginPct.toFixed(1)}% | Wholesale: {wholesaleMarginPct.toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Landing Cost / Landed</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono-code font-bold bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-indigo-700 uppercase">Wholesale (B2B Price)</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-indigo-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono-code font-bold bg-white border border-indigo-300 rounded-lg p-1.5 text-indigo-950"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Retail Counter (POS Price)</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-emerald-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono-code font-bold bg-white border border-emerald-300 rounded-lg p-1.5 text-emerald-950"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Channel Availability Toggles */}
          <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isAvailableRetail}
                onChange={(e) => setIsAvailableRetail(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Available on Retail Counter POS</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={isAvailableWholesale}
                onChange={(e) => setIsAvailableWholesale(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Available for Wholesale B2B</span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{isSaving ? 'Saving to Database...' : isEditing ? 'Save Changes' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
