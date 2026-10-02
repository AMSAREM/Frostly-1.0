import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  Check, 
  AlertCircle,
  Link as LinkIcon,
  Database,
  Loader2
} from 'lucide-react';
import { InventoryBatch } from '../../types';
import { processImageFile } from '../../utils/imageUpload';

interface BatchImageUploadModalProps {
  batch: InventoryBatch;
  onClose: () => void;
  onSaveImage: (updatedBatch: InventoryBatch) => void;
}

export const BatchImageUploadModal: React.FC<BatchImageUploadModalProps> = ({
  batch,
  onClose,
  onSaveImage
}) => {
  const [imageUrl, setImageUrl] = useState<string>(batch.imageUrl || '');
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [inputUrl, setInputUrl] = useState<string>(batch.imageUrl && !batch.imageUrl.startsWith('data:') ? batch.imageUrl : '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setIsProcessing(true);

    try {
      const optimizedDataUrl = await processImageFile(file, 1200, 1200, 0.85);
      setImageUrl(optimizedDataUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process image file. Please try another file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUrl = () => {
    if (!inputUrl.trim()) {
      setErrorMsg('Please enter a valid image URL');
      return;
    }
    setErrorMsg('');
    setImageUrl(inputUrl.trim());
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setInputUrl('');
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    const updated: InventoryBatch = {
      ...batch,
      imageUrl: imageUrl.trim() || undefined
    };
    onSaveImage(updated);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-slate-950 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Lot Photo &amp; Image</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {batch.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {batch.speciesName} ({batch.grade})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Information Notice */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 text-xs text-indigo-950">
            <Database className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Database Storage Notice:</span> Images uploaded here are stored directly with your lot in the Supabase database. The system does not generate automated or placeholder stock photos.
            </div>
          </div>

          {/* Current / Preview Image View */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Lot Photo Preview</span>
              {imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>

            <div className="relative w-full h-48 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center group">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-2 text-indigo-600">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-semibold">Processing &amp; Optimizing image...</span>
                </div>
              ) : imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt={batch.speciesName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-md hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Replace Photo</span>
                    </button>
                  </div>
                </>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-slate-200/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2 shadow-2xs group-hover:scale-105 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">Click to upload photo from your device</span>
                  <span className="text-[11px] text-slate-400 mt-1">JPEG, PNG, WEBP (stored in Supabase database)</span>
                </div>
              )}
            </div>
          </div>

          {/* Source Tabs: Upload from device or Enter URL */}
          <div className="space-y-3">
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setImageTab('upload')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                  imageTab === 'upload'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                type="button"
                onClick={() => setImageTab('url')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
                  imageTab === 'url'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Paste Image URL</span>
              </button>
            </div>

            {imageTab === 'upload' ? (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Select Image File from Device</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/catch-photo.jpg"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Apply URL
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 sm:p-5 flex items-center justify-between border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer text-white ${
              isSaved
                ? 'bg-emerald-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved to Database!</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Save to Supabase Database</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
