import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  FileText,
  Save,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import {
  CURRENCY,
  AMANSOCEAN_PRICE_LIST_PDF_URL,
  AMANSOCEAN_CONTACT_PHONE,
  AMANSOCEAN_LOCATION,
  AMANSOCEAN_FLYER_NOTES,
  AMANSOCEAN_OFFICIAL_CATALOG,
} from '../data/amansoceanProducts';
import { RetailWholesaleProduct, SeafoodCutType, SpeciesCategory, QualityGrade } from '../types';
import { resolveProductImage } from '../utils/productImageResolver';
import { getAuthHeaders } from '../data/auth';

export interface AdminCatalogProduct extends RetailWholesaleProduct {
  storefrontCategory?: string;
}

interface AmansProductsAdminManagerProps {
  organizationId?: string;
}

async function getStaffAuthHeaders(): Promise<Record<string, string>> {
  return await getAuthHeaders(true);
}

export const AmansProductsAdminManager: React.FC<AmansProductsAdminManagerProps> = ({
  organizationId,
}) => {
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [orgName, setOrgName] = useState<string>('Amans Ocean Seafoods & Coldstore');
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showFlyerModal, setShowFlyerModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Inline edits keyed by product ID
  const [draftEdits, setDraftEdits] = useState<
    Record<
      string,
      {
        retailPricePerUnit: string;
        wholesalePricePerUnit: string;
        wholesaleMinQty: string;
        stockKg: string;
        isAvailableForRetail: boolean;
        isAvailableForWholesale: boolean;
      }
    >
  >({});

  // Add Product Modal State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newCategory, setNewCategory] = useState<SpeciesCategory>('Groundfish');
  const [newCutType, setNewCutType] = useState<SeafoodCutType>('Whole Round Fish');
  const [newUnit, setNewUnit] = useState<'kg' | 'pack'>('kg');
  const [newPackSize, setNewPackSize] = useState('1kg');
  const [newRetailPrice, setNewRetailPrice] = useState('80');
  const [newWholesalePrice, setNewWholesalePrice] = useState('80');
  const [newWholesaleMinQty, setNewWholesaleMinQty] = useState('5');
  const [newStockKg, setNewStockKg] = useState('100');
  const [creating, setCreating] = useState(false);

  const fallbackLocalCatalog = useMemo<AdminCatalogProduct[]>(
    () =>
      AMANSOCEAN_OFFICIAL_CATALOG.map((item) => ({
        id: item.id,
        sku: item.sku,
        speciesId: item.species_id,
        name: item.name,
        cutType: item.cut_type as SeafoodCutType,
        category: item.db_category as SpeciesCategory,
        storefrontCategory: item.storefront_category,
        grade: item.grade as QualityGrade,
        stockKg: item.stock_kg,
        unit: item.unit,
        costPricePerUnit: item.cost_price_per_unit,
        wholesalePricePerUnit: item.wholesale_price_per_unit,
        retailPricePerUnit: item.retail_price_per_unit,
        wholesaleMinQty: item.wholesale_min_qty,
        retailPackSize: item.retail_pack_size,
        imageUrl: item.image_url,
        origin: item.origin,
        isAvailableForRetail: true,
        isAvailableForWholesale: true,
      })),
    []
  );

  const hydrateDrafts = (list: AdminCatalogProduct[]) => {
    const nextDrafts: typeof draftEdits = {};
    for (const p of list) {
      nextDrafts[p.id] = {
        retailPricePerUnit: String(p.retailPricePerUnit),
        wholesalePricePerUnit: String(p.wholesalePricePerUnit),
        wholesaleMinQty: String(p.wholesaleMinQty || 5),
        stockKg: String(p.stockKg),
        isAvailableForRetail: p.isAvailableForRetail,
        isAvailableForWholesale: p.isAvailableForWholesale,
      };
    }
    setDraftEdits(nextDrafts);
  };

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const headers = await getStaffAuthHeaders();
      const qs = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
      const res = await fetch(`/api/erp/amansocean-products${qs}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
          hydrateDrafts(data.products);
          if (data.organizationName) setOrgName(data.organizationName);
          setLoading(false);
          return;
        }
      }

      // Secondary public fallback so creator preview works even in offline/dev mode
      const pubRes = await fetch('/api/pos/customer-catalog', { headers });
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        if (Array.isArray(pubData.products) && pubData.products.length > 0) {
          const mapped: AdminCatalogProduct[] = pubData.products.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            speciesId: p.speciesId,
            name: p.name,
            cutType: p.cutType as SeafoodCutType,
            category: p.category as SpeciesCategory,
            storefrontCategory: p.storefrontCategory,
            grade: p.grade as QualityGrade,
            stockKg: Number(p.stockKg || 0),
            unit: (p.unit || 'kg') as 'kg' | 'pack',
            costPricePerUnit: Number((Number(p.wholesalePricePerUnit || 0) * 0.72).toFixed(2)),
            wholesalePricePerUnit: Number(p.wholesalePricePerUnit || 0),
            retailPricePerUnit: Number(p.retailPricePerUnit || 0),
            wholesaleMinQty: Number(p.wholesaleMinQty || 5),
            retailPackSize: p.retailPackSize || '1kg',
            imageUrl: p.imageUrl || '',
            origin: p.origin || AMANSOCEAN_LOCATION,
            isAvailableForRetail: p.isAvailableForRetail !== false,
            isAvailableForWholesale: p.isAvailableForWholesale !== false,
          }));
          setProducts(mapped);
          hydrateDrafts(mapped);
          if (pubData.organizationName) setOrgName(pubData.organizationName);
          setLoading(false);
          return;
        }
      }

      setProducts(fallbackLocalCatalog);
      hydrateDrafts(fallbackLocalCatalog);
    } catch {
      setProducts(fallbackLocalCatalog);
      hydrateDrafts(fallbackLocalCatalog);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [organizationId]);

  const handleSyncOfficialFlyer = async (forceResetPrices: boolean) => {
    setSyncing(true);
    setNotice(null);
    try {
      const headers = await getStaffAuthHeaders();
      const res = await fetch('/api/erp/amansocean-products/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organizationId,
          forceResetPrices,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not sync official price list to Supabase.');
      }
      if (Array.isArray(data.products)) {
        setProducts(data.products);
        hydrateDrafts(data.products);
      }
      setNotice({
        type: 'success',
        text: forceResetPrices
          ? `Reset all ${data.syncedCount || 32} Amans Ocean SKUs to official GH₵ flyer prices in Supabase.`
          : `Synced ${data.syncedCount || 32} active Amans Ocean SKUs with Supabase.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to sync official price list.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveRow = async (product: AdminCatalogProduct) => {
    const draft = draftEdits[product.id];
    if (!draft) return;

    const retailPricePerUnit = Number(draft.retailPricePerUnit);
    const wholesalePricePerUnit = Number(draft.wholesalePricePerUnit);
    const wholesaleMinQty = Math.max(1, Number(draft.wholesaleMinQty || 5));
    const stockKg = Math.max(0, Number(draft.stockKg || 0));

    if (Number.isNaN(retailPricePerUnit) || retailPricePerUnit < 0) {
      setNotice({ type: 'error', text: `Enter a valid GH₵ retail price for ${product.name}.` });
      return;
    }

    setSavingId(product.id);
    setNotice(null);
    try {
      const headers = await getStaffAuthHeaders();
      const res = await fetch(`/api/erp/amansocean-products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          organizationId,
          retailPricePerUnit,
          wholesalePricePerUnit: Number.isNaN(wholesalePricePerUnit)
            ? retailPricePerUnit
            : wholesalePricePerUnit,
          wholesaleMinQty,
          stockKg,
          isAvailableForRetail: draft.isAvailableForRetail,
          isAvailableForWholesale: draft.isAvailableForWholesale,
          imageUrl: product.imageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product update.');
      }

      const updated: AdminCatalogProduct = data.product || {
        ...product,
        retailPricePerUnit,
        wholesalePricePerUnit,
        wholesaleMinQty,
        stockKg,
        isAvailableForRetail: draft.isAvailableForRetail,
        isAvailableForWholesale: draft.isAvailableForWholesale,
      };

      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      setNotice({
        type: 'success',
        text: `Saved ${updated.name} (${CURRENCY} ${updated.retailPricePerUnit.toFixed(2)} retail / ${CURRENCY} ${updated.wholesalePricePerUnit.toFixed(2)} wholesale) to Supabase.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || `Could not save changes for ${product.name}.`,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeactivateProduct = async (product: AdminCatalogProduct) => {
    setSavingId(product.id);
    setNotice(null);
    try {
      const headers = await getStaffAuthHeaders();
      const res = await fetch(
        `/api/erp/amansocean-products/${encodeURIComponent(product.id)}${
          organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
        }`,
        {
          method: 'DELETE',
          headers,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not remove item from active catalog.');
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setNotice({
        type: 'success',
        text: `Removed ${product.name} from active Storefront & POS catalog.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to deactivate product.',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setNotice(null);

    try {
      const headers = await getStaffAuthHeaders();
      const res = await fetch('/api/erp/amansocean-products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          organizationId,
          name: newName.trim(),
          sku: newSku.trim() || undefined,
          category: newCategory,
          cutType: newCutType,
          unit: newUnit,
          retailPackSize: newPackSize.trim() || (newUnit === 'pack' ? 'Regular Pack' : '1kg'),
          retailPricePerUnit: Number(newRetailPrice) || 0,
          wholesalePricePerUnit: Number(newWholesalePrice) || Number(newRetailPrice) || 0,
          wholesaleMinQty: Math.max(1, Number(newWholesaleMinQty) || 5),
          stockKg: Math.max(0, Number(newStockKg) || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.product) {
        throw new Error(data.error || 'Failed to add product to Supabase.');
      }

      const created = data.product as AdminCatalogProduct;
      const nextList = [...products, created];
      setProducts(nextList);
      hydrateDrafts(nextList);
      setShowAddModal(false);
      setNewName('');
      setNewSku('');
      setNotice({
        type: 'success',
        text: `Added ${created.name} (${CURRENCY} ${created.retailPricePerUnit.toFixed(2)}) to Supabase catalog.`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to create product.',
      });
    } finally {
      setCreating(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat =
        categoryFilter === 'All' ||
        p.storefrontCategory === categoryFilter ||
        p.category === categoryFilter;
      if (!matchesCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.cutType.toLowerCase().includes(q)
      );
    });
  }, [products, categoryFilter, searchQuery]);

  const summaryStats = useMemo(() => {
    const count = products.length;
    const bulkTierCount = products.filter(
      (p) => p.wholesalePricePerUnit < p.retailPricePerUnit
    ).length;
    const totalStock = products.reduce((sum, p) => sum + Number(p.stockKg || 0), 0);
    return { count, bulkTierCount, totalStock };
  }, [products]);

  const categories = [
    'All',
    'Whole Fish',
    'Fillets & Chunks',
    'Shrimps, Prawns & Shellfish',
    'Fish & Shrimp Powders',
  ];

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span>{orgName}</span>
            <span aria-hidden="true">·</span>
            <span>{AMANSOCEAN_LOCATION}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Tel {AMANSOCEAN_CONTACT_PHONE}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Official Amans Ocean Price List &amp; Supabase Catalog ({CURRENCY})
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Live prices here sync directly to Supabase, Storefront checkout, Retail &amp; Wholesale POS, and POS Customer View.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowFlyerModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Price List Flyer (PDF)</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => handleSyncOfficialFlyer(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Supabase...' : 'Sync Official Flyer Prices'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Seafood Item</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Active Official SKUs</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {summaryStats.count}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            28 per-kilo seafood cuts · 4 powder packs
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">10kg+ Bulk Discount Tiers</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {summaryStats.bulkTierCount} SKUs
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Peeled Shrimps (GH₵ 200/kg) · Squid (GH₵ 130/kg)
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500">Coldstore Available Stock</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {summaryStats.totalStock.toLocaleString()} units
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {AMANSOCEAN_FLYER_NOTES[0]} · {AMANSOCEAN_FLYER_NOTES[2]}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fish, prawns, SKU..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 text-slate-900"
            />
          </div>
        </div>

        {/* High-Density Editable Price Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Product &amp; SKU</th>
                <th className="py-3 px-3">Category · Cut</th>
                <th className="py-3 px-3">Unit / Pack</th>
                <th className="py-3 px-3 text-right">Retail ({CURRENCY})</th>
                <th className="py-3 px-3 text-right">Wholesale ({CURRENCY})</th>
                <th className="py-3 px-3 text-right">Min Bulk Qty</th>
                <th className="py-3 px-3 text-right">Stock</th>
                <th className="py-3 px-3 text-center">Channels</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4">
                      <div className="h-4 w-36 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-4 w-28 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-4 w-14 bg-slate-100 rounded" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-8 w-20 bg-slate-100 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-8 w-20 bg-slate-100 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-8 w-16 bg-slate-100 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-8 w-16 bg-slate-100 rounded ml-auto" />
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-4 w-20 bg-slate-100 rounded mx-auto" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-8 w-20 bg-slate-200 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No Amans Ocean products matched your filter. Try clearing the search or syncing the official price list.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const draft = draftEdits[product.id] || {
                    retailPricePerUnit: String(product.retailPricePerUnit),
                    wholesalePricePerUnit: String(product.wholesalePricePerUnit),
                    wholesaleMinQty: String(product.wholesaleMinQty || 5),
                    stockKg: String(product.stockKg),
                    isAvailableForRetail: product.isAvailableForRetail,
                    isAvailableForWholesale: product.isAvailableForWholesale,
                  };

                  const isDirty =
                    Number(draft.retailPricePerUnit) !== product.retailPricePerUnit ||
                    Number(draft.wholesalePricePerUnit) !== product.wholesalePricePerUnit ||
                    Number(draft.wholesaleMinQty) !== (product.wholesaleMinQty || 5) ||
                    Number(draft.stockKg) !== product.stockKg ||
                    draft.isAvailableForRetail !== product.isAvailableForRetail ||
                    draft.isAvailableForWholesale !== product.isAvailableForWholesale;

                    const resolvedImg = resolveProductImage(product);

                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-3">
                            {resolvedImg.url ? (
                              <img
                                src={resolvedImg.url}
                                alt={resolvedImg.alt}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/logofrostly1.png';
                                }}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-5 h-5 opacity-40" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">{product.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {product.sku}
                              </div>
                            </div>
                          </div>
                        </td>

                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{product.storefrontCategory || product.category}</div>
                        <div className="text-[11px] text-slate-400">{product.cutType}</div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {product.retailPackSize || (product.unit === 'pack' ? 'Pack' : '1kg')}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          aria-label={`Retail price for ${product.name}`}
                          value={draft.retailPricePerUnit}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [product.id]: { ...draft, retailPricePerUnit: e.target.value },
                            }))
                          }
                          className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 font-mono tabular-nums font-semibold text-slate-900"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          aria-label={`Wholesale price for ${product.name}`}
                          value={draft.wholesalePricePerUnit}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [product.id]: { ...draft, wholesalePricePerUnit: e.target.value },
                            }))
                          }
                          className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 font-mono tabular-nums font-semibold text-slate-900"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          aria-label={`Wholesale minimum quantity for ${product.name}`}
                          value={draft.wholesaleMinQty}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [product.id]: { ...draft, wholesaleMinQty: e.target.value },
                            }))
                          }
                          className="w-16 text-right px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 font-mono tabular-nums text-slate-700"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Stock for ${product.name}`}
                          value={draft.stockKg}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [product.id]: { ...draft, stockKg: e.target.value },
                            }))
                          }
                          className="w-20 text-right px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 font-mono tabular-nums text-slate-700"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-2 text-[11px] text-slate-600">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draft.isAvailableForRetail}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [product.id]: {
                                    ...draft,
                                    isAvailableForRetail: e.target.checked,
                                  },
                                }))
                              }
                              className="rounded border-slate-300"
                            />
                            <span>Retail</span>
                          </label>
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draft.isAvailableForWholesale}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [product.id]: {
                                    ...draft,
                                    isAvailableForWholesale: e.target.checked,
                                  },
                                }))
                              }
                              className="rounded border-slate-300"
                            />
                            <span>B2B</span>
                          </label>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={savingId === product.id}
                            onClick={() => handleSaveRow(product)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                              isDirty
                                ? 'bg-slate-900 text-white hover:bg-slate-800'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{savingId === product.id ? 'Saving...' : 'Save'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={savingId === product.id}
                            onClick={() => handleDeactivateProduct(product)}
                            title="Deactivate item"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Price List PDF Modal */}
      {showFlyerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Official Amans Ocean Price List Flyer
                </h3>
                <p className="text-xs text-slate-500">
                  {AMANSOCEAN_LOCATION} · Tel {AMANSOCEAN_CONTACT_PHONE}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={AMANSOCEAN_PRICE_LIST_PDF_URL}
                  download="AmansOcean_Official_PriceList.pdf"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowFlyerModal(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe
                src={AMANSOCEAN_PRICE_LIST_PDF_URL}
                title="Official Amans Ocean Price List PDF"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Seafood Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateProduct}
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Add New Amans Ocean Product ({CURRENCY})
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Smoked Salmon Portions"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">SKU (Optional)</label>
                <input
                  type="text"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="AO-CUSTOM-1KG"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Species Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as SpeciesCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="Groundfish">Groundfish</option>
                  <option value="Pelagic">Pelagic</option>
                  <option value="Crustacean">Crustacean</option>
                  <option value="Mollusk">Mollusk</option>
                  <option value="Salmonid">Salmonid</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cut / Preparation</label>
                <select
                  value={newCutType}
                  onChange={(e) => setNewCutType(e.target.value as SeafoodCutType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="Whole Round Fish">Whole Round Fish</option>
                  <option value="Skin-On Loin / Fillet">Skin-On Loin / Fillet</option>
                  <option value="Headless & Gutted (H&G)">Headless &amp; Gutted (H&amp;G)</option>
                  <option value="IQF Flash Frozen Box">IQF Flash Frozen Box</option>
                  <option value="Packaged 500g Tray">Packaged 500g Tray</option>
                  <option value="Live in Oxygen Tank">Live in Oxygen Tank</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={newUnit}
                    onChange={(e) => {
                      const u = e.target.value as 'kg' | 'pack';
                      setNewUnit(u);
                      setNewPackSize(u === 'pack' ? 'Regular Pack' : '1kg');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pack Label</label>
                  <input
                    type="text"
                    value={newPackSize}
                    onChange={(e) => setNewPackSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Retail Price ({CURRENCY})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={newRetailPrice}
                  onChange={(e) => setNewRetailPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Wholesale Price ({CURRENCY})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={newWholesalePrice}
                  onChange={(e) => setNewWholesalePrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Wholesale Min Qty</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={newWholesaleMinQty}
                  onChange={(e) => setNewWholesaleMinQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={newStockKg}
                  onChange={(e) => setNewStockKg(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                {creating ? 'Adding...' : 'Save to Supabase'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
