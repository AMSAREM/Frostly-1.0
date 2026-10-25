import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Image processing & upload helper for user-supplied images.
 * Ensures images are optimized, compressed, and ready for Supabase storage or URI persistence.
 * Rejects SVGs to eliminate stored XSS risks.
 */

export async function processImageFile(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    // SECURITY: Reject SVG images to prevent Stored Cross-Site Scripting (XSS)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      return reject(new Error('SVG format is not permitted for security reasons. Please upload JPG, PNG, or WebP.'));
    }

    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image file directly to Supabase Storage ('product-species-media')
 * Falls back to optimized data URL if Supabase Storage is not connected.
 */
export async function uploadImageToStorage(file: File, pathPrefix = 'catalog'): Promise<string> {
  // Always validate & optimize through processImageFile first (rejecting SVGs)
  const processedDataUrl = await processImageFile(file);

  if (isSupabaseConfigured) {
    try {
      const cleanFileName = `${pathPrefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('product-species-media')
        .upload(cleanFileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (!error && data?.path) {
        const { data: pubData } = supabase.storage
          .from('product-species-media')
          .getPublicUrl(data.path);
        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('[Storage Upload Fallback]:', storageErr);
    }
  }

  return processedDataUrl;
}
