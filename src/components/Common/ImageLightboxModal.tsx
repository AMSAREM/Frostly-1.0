import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, ExternalLink, Image as ImageIcon, ShieldCheck, Tag, Anchor } from 'lucide-react';

export interface ImageLightboxDetails {
  imageUrl: string;
  title: string;
  subtitle?: string;
  sourceType?: 'product' | 'batch' | 'haccp';
  sourceLabel?: string;
  sku?: string;
  lotId?: string;
  grade?: string;
  origin?: string;
  temperature?: string;
  verifiedAt?: string;
}

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: ImageLightboxDetails | null;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  details,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsZoomed(false);
      setImageError(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !details) return null;

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = details.imageUrl;
      link.download = `${(details.title || 'seafood-photo').toLowerCase().replace(/\s+/g, '-')}.jpg`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(details.imageUrl, '_blank');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 sm:p-6 transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="w-full max-w-5xl flex items-center justify-between pb-3 text-white border-b border-slate-800 mb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="p-2 bg-slate-800 rounded-lg text-cyan-400 shrink-0">
            {details.sourceType === 'batch' ? (
              <Anchor className="w-5 h-5" />
            ) : (
              <ImageIcon className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="lightbox-title" className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {details.title}
              </h2>
              {details.sourceLabel && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded-md">
                  <Tag className="w-3 h-3" />
                  {details.sourceLabel}
                </span>
              )}
            </div>
            {details.subtitle && (
              <p className="text-xs text-slate-400 truncate">{details.subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsZoomed((prev) => !prev)}
            aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
            title={isZoomed ? 'Actual size (100%)' : 'Fit to screen'}
            className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download image"
            title="Download image"
            className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <a
            href={details.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open full resolution in new tab"
            title="Open in new tab"
            className="p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image preview"
            className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className={`relative w-full max-w-5xl flex-1 flex items-center justify-center overflow-auto rounded-xl bg-slate-900/60 border border-slate-800 p-2 sm:p-4 ${
          isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed((prev) => !prev);
        }}
      >
        {imageError ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <ImageIcon className="w-12 h-12 text-slate-600 mb-2" />
            <p className="text-sm font-medium">Image preview unavailable</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs break-all">{details.imageUrl}</p>
          </div>
        ) : (
          <img
            src={details.imageUrl}
            alt={details.title}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className={`transition-all duration-200 object-contain rounded-lg shadow-2xl ${
              isZoomed
                ? 'max-w-none w-auto h-auto'
                : 'max-h-[68vh] w-auto max-w-full'
            }`}
          />
        )}
      </div>

      {/* Bottom Metadata Badges Bar */}
      {(details.lotId || details.grade || details.sku || details.origin || details.temperature) && (
        <div
          className="w-full max-w-5xl mt-3 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-300 bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {details.lotId && (
              <span className="flex items-center gap-1.5 font-mono text-cyan-300">
                <span className="text-slate-500 text-[10px] uppercase font-sans">Lot:</span>
                {details.lotId}
              </span>
            )}
            {details.sku && (
              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                <span className="text-slate-500 text-[10px] uppercase font-sans">SKU:</span>
                {details.sku}
              </span>
            )}
            {details.grade && (
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Grade {details.grade}
              </span>
            )}
            {details.origin && (
              <span className="text-slate-400">
                <span className="text-slate-500 text-[10px] uppercase">Origin:</span> {details.origin}
              </span>
            )}
            {details.temperature && (
              <span className="text-blue-300 font-mono">
                <span className="text-slate-500 text-[10px] uppercase font-sans">Storage:</span> {details.temperature}
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400">
            Click image or press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">Esc</kbd> to exit
          </span>
        </div>
      )}
    </div>
  );
};
