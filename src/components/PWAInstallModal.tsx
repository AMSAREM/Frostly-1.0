import React from 'react';
import { 
  Download, 
  Smartphone, 
  Laptop, 
  CheckCircle2, 
  Share, 
  PlusSquare, 
  X, 
  Zap, 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  HardDrive,
  ExternalLink
} from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  isIOS: boolean;
  isInstallable: boolean;
  isStandalone: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  isIOS,
  isInstallable,
  isStandalone
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full bg-indigo-950 rounded-[14px] flex items-center justify-center">
                <img src="/icons/icon-192.svg" alt="Frostly Icon" className="w-8 h-8 rounded-lg" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black font-heading tracking-tight">Install Frostly</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PWA Ready
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                Super-Frozen Seafood ERP & Cold-Chain Telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Key PWA Features */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <Zap className="w-5 h-5 text-amber-500 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800">Instant Launch</div>
              <div className="text-[10px] text-slate-500">Zero loading delay</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <HardDrive className="w-5 h-5 text-emerald-600 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800">Offline POS</div>
              <div className="text-[10px] text-slate-500">Cached local ledger</div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <Smartphone className="w-5 h-5 text-indigo-600 mx-auto" />
              <div className="text-[11px] font-bold text-slate-800">Native UI</div>
              <div className="text-[10px] text-slate-500">Fullscreen workspace</div>
            </div>
          </div>

          {/* Conditional Instructions based on Platform */}
          {isStandalone ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs font-bold text-emerald-900">Already Installed!</div>
                <div className="text-[11px] text-emerald-700">
                  You are currently running Frostly in standalone Progressive Web App mode.
                </div>
              </div>
            </div>
          ) : isIOS ? (
            /* iOS Safari Instructions */
            <div className="space-y-3 p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
              <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>How to Install on iPhone / iPad:</span>
              </div>
              <ol className="text-xs text-indigo-900 space-y-2 pl-1">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" /> in Safari’s navigation bar.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" />.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top-right corner to place Frostly on your home screen.
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            /* Desktop Chrome, Edge, Android Instructions */
            <div className="space-y-3">
              <div className="text-xs text-slate-600 leading-relaxed">
                Installing Frostly adds a dedicated launcher to your desktop or mobile home screen, providing a distraction-free full-screen workspace with automatic offline caching.
              </div>
              {isInstallable ? (
                <button
                  id="pwa-confirm-install-btn"
                  onClick={onInstall}
                  className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Install Progressive Web App</span>
                </button>
              ) : (
                <div className="p-3.5 bg-slate-100 rounded-2xl text-xs text-slate-600 flex items-center justify-between">
                  <span>Use browser menu to install, or launch in standalone window.</span>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-white text-slate-800 font-bold rounded-xl border border-slate-200 text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Device compatibility badge */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Universal Cross-Platform: iOS, Android, macOS & Windows</span>
            </span>
            <span className="font-mono-code font-bold">v2.4 PWA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
