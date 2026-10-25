import { RetailWholesaleProduct, InventoryBatch } from '../types';

export interface ImageResolveResult {
  url: string | null;
  source: 'product' | 'batch' | 'species_default' | 'none';
  alt: string;
}

/**
 * Resolves the display image for a product, adhering to the priority:
 * 1. Product's own uploaded picture (product.imageUrl)
 * 2. Linked inventory batch catch photo (batch.imageUrl)
 * 3. Default fallback
 */
export function resolveProductImage(
  product?: Partial<RetailWholesaleProduct> | null,
  linkedBatch?: Partial<InventoryBatch> | null
): ImageResolveResult {
  // 1. Direct Product Image
  const productImg = product?.imageUrl?.trim();
  if (productImg && productImg.length > 0) {
    return {
      url: productImg,
      source: 'product',
      alt: product?.name || 'Seafood Product',
    };
  }

  // 2. Linked Batch Intake Catch Photo
  const batchImg = linkedBatch?.imageUrl?.trim();
  if (batchImg && batchImg.length > 0) {
    return {
      url: batchImg,
      source: 'batch',
      alt: `${linkedBatch?.speciesName || product?.name || 'Seafood'} (Catch Lot ${linkedBatch?.id || ''})`,
    };
  }

  return {
    url: null,
    source: 'none',
    alt: product?.name || 'Seafood Item',
  };
}

/**
 * Resolves the display image for an inventory batch, checking:
 * 1. Batch's own catch photo (batch.imageUrl)
 * 2. Linked retail product picture if available
 */
export function resolveBatchImage(
  batch?: Partial<InventoryBatch> | null,
  linkedProduct?: Partial<RetailWholesaleProduct> | null
): ImageResolveResult {
  const batchImg = batch?.imageUrl?.trim();
  if (batchImg && batchImg.length > 0) {
    return {
      url: batchImg,
      source: 'batch',
      alt: `${batch?.speciesName || 'Seafood Batch'} (${batch?.id || ''})`,
    };
  }

  const productImg = linkedProduct?.imageUrl?.trim();
  if (productImg && productImg.length > 0) {
    return {
      url: productImg,
      source: 'product',
      alt: linkedProduct?.name || batch?.speciesName || 'Seafood Product',
    };
  }

  return {
    url: null,
    source: 'none',
    alt: batch?.speciesName || 'Seafood Lot',
  };
}
