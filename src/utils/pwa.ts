import { useState, useEffect, useCallback } from 'react';

// Service Worker Registration
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
          
          // Check for service worker updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New content available; please refresh.');
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn('[PWA] ServiceWorker registration failed:', error);
        });
    });
  } else if ('serviceWorker' in navigator) {
    // In dev mode, register anyway to enable offline dev test if desired
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA-Dev] SW registered:', reg.scope))
        .catch((err) => console.log('[PWA-Dev] SW notice:', err.message));
    });
  }
}

// Hook to detect platform and manage PWA Installation
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    // Detect iOS devices (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] Application installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
      return outcome === 'accepted';
    } catch (err) {
      console.error('[PWA] Error showing install prompt:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isStandalone,
    triggerInstall
  };
}

// Hook to detect Online / Offline status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, showOfflineBanner, setShowOfflineBanner };
}
