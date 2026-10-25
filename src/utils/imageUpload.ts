/**
 * Image processing & upload helper for user-supplied images.
 * Ensures images are heavily optimized, scaled for fast rendering,
 * and uploaded to static server cache with permanent HTTP caching.
 */
import { getSession } from '../data/auth';

export async function processImageFile(
  file: File,
  maxWidth = 640,
  maxHeight = 640,
  quality = 0.78
): Promise<string> {
  const localDataUrl = await new Promise<string>((resolve, reject) => {
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

        // Try modern, lightweight WebP first (40-60% smaller than JPEG)
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            return resolve(webpData);
          }
        } catch {
          // fallback
        }

        try {
          const jpegData = canvas.toDataURL('image/jpeg', quality);
          resolve(jpegData);
        } catch {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  // Attempt server upload for permanent HTTP static caching & 0ms disk cache hits
  try {
    if (typeof window !== 'undefined' && typeof fetch === 'function' && navigator.onLine) {
      const session = await getSession();
      const token = session?.access_token;
      if (token && !token.startsWith('local-token-')) {
        const res = await fetch('/api/erp/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            image: localDataUrl,
            fileName: file.name || 'product-image.webp',
          }),
        });

        if (res.ok) {
          const payload = await res.json();
          if (payload.imageUrl && typeof payload.imageUrl === 'string') {
            return payload.imageUrl;
          }
        }
      }
    }
  } catch {
    // Gracefully fallback to lightweight optimized data URL
  }

  return localDataUrl;
}
