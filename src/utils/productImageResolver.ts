import { RetailWholesaleProduct, InventoryBatch } from '../types';
import { AMANSOCEAN_OFFICIAL_CATALOG } from '../data/amansoceanProducts';
import { SPECIES_CATALOG } from '../data/mockData';

export interface ImageResolveResult {
  url: string | null;
  source: 'product' | 'batch' | 'species_default' | 'none';
  alt: string;
}

/**
 * Validates that an image string is non-empty and a legitimate URI/URL.
 * Rejects corrupt strings like 'undefined', 'null', or empty brackets.
 */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'none' || trimmed === '[object Object]') {
    return false;
  }
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Optimizes external image URLs (e.g. Unsplash CDN) to fetch modern WebP formats
 * at exact target display widths and compressed quality (75%), significantly
 * cutting transfer sizes (from ~1.5MB to ~30KB) and speeding up rendering.
 */
export function optimizeImageUrl(url?: string | null, targetWidth = 400): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(trimmed);
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('w', String(targetWidth));
      parsed.searchParams.set('q', '75');
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

/**
 * Resolves the display image for a product, adhering to the priority:
 * 1. Product's own uploaded picture (product.imageUrl or product.image_url)
 * 2. Linked inventory batch catch photo (batch.imageUrl or batch.image_url)
 * 3. Official Catalog artwork / Species catalog photo fallback
 */
export function resolveProductImage(
  product?: Partial<RetailWholesaleProduct> | null,
  linkedBatch?: Partial<InventoryBatch> | null,
  targetWidth = 400
): ImageResolveResult {
  // 1. Direct Product Image
  const rawProductImg = product?.imageUrl || (product as any)?.image_url;
  if (isValidImageUrl(rawProductImg)) {
    return {
      url: optimizeImageUrl(rawProductImg!.trim(), targetWidth),
      source: 'product',
      alt: product?.name || 'Seafood Product',
    };
  }

  // 2. Linked Batch Intake Catch Photo
  const rawBatchImg = linkedBatch?.imageUrl || (linkedBatch as any)?.image_url;
  if (isValidImageUrl(rawBatchImg)) {
    return {
      url: optimizeImageUrl(rawBatchImg!.trim(), targetWidth),
      source: 'batch',
      alt: `${linkedBatch?.speciesName || product?.name || 'Seafood'} (Catch Lot ${linkedBatch?.id || ''})`,
    };
  }

  // 3. Fallback to Official Amans Ocean Catalog artwork by ID, SKU, or Name match
  if (product) {
    const officialMatch = AMANSOCEAN_OFFICIAL_CATALOG.find(
      (c) =>
        (product.id && c.id === product.id) ||
        (product.sku && c.sku.toLowerCase() === product.sku.toLowerCase()) ||
        (product.name && c.name.toLowerCase() === product.name.toLowerCase())
    );
    if (officialMatch && isValidImageUrl(officialMatch.image_url)) {
      return {
        url: officialMatch.image_url,
        source: 'species_default',
        alt: officialMatch.name,
      };
    }

    // 4. Fallback to Species catalog image
    if (product.speciesId || product.name) {
      const speciesMatch = SPECIES_CATALOG.find(
        (s) =>
          (product.speciesId && s.id === product.speciesId) ||
          (product.name && s.name.toLowerCase().includes(product.name.toLowerCase()))
      );
      if (speciesMatch && isValidImageUrl(speciesMatch.image)) {
        return {
          url: optimizeImageUrl(speciesMatch.image, targetWidth),
          source: 'species_default',
          alt: speciesMatch.name,
        };
      }
    }
  }

  return {
    url: null,
    source: 'none',
    alt: product?.name || 'Seafood Item',
  };
}

/**
 * Resolves the display image for an inventory batch, checking:
 * 1. Batch's own catch photo (batch.imageUrl or batch.image_url)
 * 2. Linked retail product picture if available
 * 3. Species catalog default image fallback
 */
export function resolveBatchImage(
  batch?: Partial<InventoryBatch> | null,
  linkedProduct?: Partial<RetailWholesaleProduct> | null,
  targetWidth = 400
): ImageResolveResult {
  const rawBatchImg = batch?.imageUrl || (batch as any)?.image_url;
  if (isValidImageUrl(rawBatchImg)) {
    return {
      url: optimizeImageUrl(rawBatchImg!.trim(), targetWidth),
      source: 'batch',
      alt: `${batch?.speciesName || 'Seafood Batch'} (${batch?.id || ''})`,
    };
  }

  const rawProductImg = linkedProduct?.imageUrl || (linkedProduct as any)?.image_url;
  if (isValidImageUrl(rawProductImg)) {
    return {
      url: optimizeImageUrl(rawProductImg!.trim(), targetWidth),
      source: 'product',
      alt: linkedProduct?.name || batch?.speciesName || 'Seafood Product',
    };
  }

  // Fallback to species photo
  if (batch?.speciesId || batch?.speciesName) {
    const speciesMatch = SPECIES_CATALOG.find(
      (s) =>
        (batch.speciesId && s.id === batch.speciesId) ||
        (batch.speciesName && s.name.toLowerCase().includes(batch.speciesName.toLowerCase()))
    );
    if (speciesMatch && isValidImageUrl(speciesMatch.image)) {
      return {
        url: optimizeImageUrl(speciesMatch.image, targetWidth),
        source: 'species_default',
        alt: speciesMatch.name,
      };
    }
  }

  return {
    url: null,
    source: 'none',
    alt: batch?.speciesName || 'Seafood Lot',
  };
}
