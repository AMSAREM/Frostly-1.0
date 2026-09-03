import React from 'react';
import { WifiOff, Download, Sparkles, X, HardDrive, Smartphone, CheckCircle2 } from 'lucide-react';

interface PWAStatusBannerProps {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onOpenInstallModal: () => void;
}

export const PWAStatusBanner: React.FC<PWAStatusBannerProps> = ({
  isOnline,
  isInstallable,
  isInstalled,
  isIOS,
  onOpenInstallModal
}) => {
  return (
    <>
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-medium z-50 sticky top-0">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-700/80 rounded-lg">
                <WifiOff className="w-4 h-4 text-amber-200" />
              </span>
              <span>
                <strong>Offline Mode Active:</strong> You are currently offline. Frostly is running from local PWA cache. New transactions will be stored locally.
              </span>
            </div>
            <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider bg-amber-800/60 px-2 py-0.5 rounded-full border border-amber-500/40">
              Service Worker Active
            </span>
          </div>
        </div>
      )}
    </>
  );
};
