import React, { useState, useEffect, useRef } from 'react';
import { 
  Anchor, 
  Package, 
  Search, 
  Bell, 
  Plus, 
  ThermometerSnowflake, 
  CheckCircle2, 
  ChevronDown,
  ShoppingBag,
  Users,
  Ship,
  DollarSign,
  Download,
  WifiOff,
  Settings,
  X,
  Check,
  Radio,
  Sliders,
  ShieldCheck,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { SystemNotification } from '../types';
import { syncManager, SyncState } from '../sync/syncManager';

export type ActiveTab = 'dashboard' | 'retail_wholesale' | 'customers' | 'suppliers' | 'financials' | 'inventory' | 'settings';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  useImperial: boolean;
  setUseImperial: (val: boolean) => void;
  notifications: SystemNotification[];
  markNotificationRead: (id: string) => void;
  onOpenNewBatchModal: () => void;
  onOpenNewOrderModal: () => void;
  activeAlertCount: number;
  onOpenInstallModal?: () => void;
  isInstallable?: boolean;
  isInstalled?: boolean;
  isOnline?: boolean;
  onOpenAuthModal?: () => void;
  isAuthenticated?: boolean;
  userRole?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  useImperial,
  setUseImperial,
  notifications = [],
  markNotificationRead,
  onOpenNewBatchModal,
  onOpenNewOrderModal,
  activeAlertCount,
  onOpenInstallModal,
  isInstallable = false,
  isInstalled = false,
  isOnline = true,
  onOpenAuthModal,
  isAuthenticated = false,
  userRole = null
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe(setSyncState);
  }, []);

  const notifMenuRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const unreadNotifs = notifications.filter(n => !n.read);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setShowQuickAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Keyboard Shortcut: Cmd/Ctrl + K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setShowMobileSearch(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 100);
        } else {
          searchInputRef.current?.focus();
        }
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setShowMobileSearch(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 100);
        } else {
          searchInputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setShowNotifMenu(false);
        setShowQuickAddMenu(false);
        if (showMobileSearch && !searchQuery) {
          setShowMobileSearch(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMobileSearch, searchQuery]);

  // Quick suggestion chips for mobile search
  const searchChips = ['Tuna', 'Salmon', 'Lobster', 'LOT-', 'ORD-'];

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Overview', icon: <Anchor className="w-4 h-4" /> },
    { id: 'retail_wholesale', label: 'Retail & Wholesale', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Ship className="w-4 h-4" /> },
    { id: 'financials', label: 'Financials & P&L', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Toolbar Row */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          {/* Left: Brand Identity & Live Status */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 sm:gap-2.5 text-left group cursor-pointer focus:outline-none"
              title="Return to Dashboard Overview"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 flex items-center justify-center text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform shrink-0">
                <ThermometerSnowflake className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-black text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Frostly
                  </span>
                  
                  {/* Status Indicator */}
                  {isOnline ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live Facility</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                      <WifiOff className="w-3 h-3" />
                      <span>Offline</span>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium hidden lg:block leading-tight">
                  Dock Cold-Chain Logistics ERP
                </p>
              </div>
            </button>
          </div>

          {/* Center: Global Search Input (Desktop & Tablets) */}
          <div className="flex-1 max-w-xs md:max-w-sm lg:max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="global-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Lot IDs, species, vessels, clients, or orders..."
                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 placeholder-slate-400 pl-9 pr-14 py-2 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-white rounded border border-slate-200 shadow-2xs">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Right: Optimized Action Tools & Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Mobile Search Button (Phone only) */}
            <button
              id="header-mobile-search-btn"
              onClick={() => {
                setShowMobileSearch(!showMobileSearch);
                if (!showMobileSearch) {
                  setTimeout(() => mobileSearchInputRef.current?.focus(), 150);
                }
              }}
              className={`md:hidden p-2 rounded-xl border transition-colors cursor-pointer ${
                showMobileSearch || searchQuery
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Toggle Global Search"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Units Toggle: Single Compact Chip on Mobile, Segmented Pill on Tablet/Desktop */}
            <div className="flex items-center">
              {/* Mobile Single-Tap Unit Chip */}
              <button
                onClick={() => setUseImperial(!useImperial)}
                className="sm:hidden px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                title="Tap to switch between Metric (kg/°C) and Imperial (lbs/°F)"
              >
                {useImperial ? 'lbs · °F' : 'kg · °C'}
              </button>

              {/* Tablet & Desktop Segmented Toggle */}
              <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-full text-[11px] font-semibold text-slate-600 border border-slate-200">
                <button
                  onClick={() => setUseImperial(false)}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                    !useImperial 
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold' 
                      : 'hover:text-slate-900 text-slate-500'
                  }`}
                >
                  kg / °C
                </button>
                <button
                  onClick={() => setUseImperial(true)}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                    useImperial 
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold' 
                      : 'hover:text-slate-900 text-slate-500'
                  }`}
                >
                  lbs / °F
                </button>
              </div>
            </div>

            {/* PWA Install Button (Only when installable and not already installed) */}
            {onOpenInstallModal && isInstallable && !isInstalled && (
              <button
                id="pwa-header-install-btn"
                onClick={onOpenInstallModal}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer shrink-0"
                title="Install Frostly as Desktop or Mobile App"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* System Notifications Popover */}
            <div className="relative" ref={notifMenuRef}>
              <button
                id="notif-trigger-btn"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className={`relative p-2 rounded-xl border transition-colors cursor-pointer ${
                  showNotifMenu
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="System Notifications & HACCP Alerts"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {showNotifMenu && (
                <div className="absolute right-0 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-sm text-slate-900">
                        System Feed
                      </span>
                      {unreadNotifs.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {unreadNotifs.length} new
                        </span>
                      )}
                    </div>
                    {unreadNotifs.length > 0 && (
                      <button
                        onClick={() => unreadNotifs.forEach(n => markNotificationRead(n.id))}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No notifications currently
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const isUrgent = n.urgency === 'critical' || n.urgency === 'high';
                        return (
                          <div
                            key={n.id}
                            onClick={() => markNotificationRead(n.id)}
                            className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                              n.read 
                                ? 'bg-slate-50/70 border-slate-100 text-slate-600' 
                                : isUrgent
                                  ? 'bg-rose-50/70 border-rose-200 text-slate-900'
                                  : 'bg-indigo-50/50 border-indigo-100 text-slate-800'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />}
                                <span>{n.title}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono-code">{n.timestamp}</span>
                            </div>
                            <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Supabase Queue Sync Status Pill */}
            {(syncState.pendingCount > 0 || syncState.isSyncing) && (
              <button
                id="header-sync-pill"
                onClick={() => syncManager.flushAll()}
                disabled={syncState.isSyncing}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  syncState.isSyncing
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                }`}
                title={
                  syncState.isSyncing
                    ? 'Flushing sync queue to Supabase...'
                    : `${syncState.pendingCount} offline change${syncState.pendingCount === 1 ? '' : 's'} queued. Click to sync now.`
                }
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin text-indigo-600' : 'text-amber-600'}`} />
                <span className="hidden sm:inline font-bold">
                  {syncState.isSyncing ? 'Syncing...' : `${syncState.pendingCount} queued`}
                </span>
              </button>
            )}

            {/* Supabase RLS Auth / Session Status Action */}
            {onOpenAuthModal && (
              <button
                id="header-auth-session-btn"
                onClick={onOpenAuthModal}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isAuthenticated
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                }`}
                title={isAuthenticated ? `Authenticated as ${userRole || 'Staff'}` : 'Offline / Sign in to Supabase'}
              >
                {isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline font-bold">
                      {userRole ? userRole.toUpperCase() : 'AUTH'}
                    </span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span className="hidden sm:inline font-medium">Auth</span>
                  </>
                )}
              </button>
            )}

            {/* Quick Settings Action (Desktop & Mobile) */}
            <button
              id="header-settings-btn"
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="System Settings & Facility Thresholds"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Quick Actions Group */}
            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex items-center gap-2 pl-1 border-l border-slate-200">
              <button
                id="btn-intake-catch-header"
                onClick={onOpenNewBatchModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer border border-slate-200/80"
              >
                <Ship className="w-3.5 h-3.5 text-blue-600" />
                <span>Intake Catch</span>
              </button>

              <button
                id="btn-create-order-header"
                onClick={onOpenNewOrderModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-sm shadow-indigo-200 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New B2B Order</span>
              </button>
            </div>

            {/* Mobile & Tablet Quick-Add Action Menu */}
            <div className="lg:hidden relative" ref={quickAddRef}>
              <button
                id="header-quick-add-btn"
                onClick={() => setShowQuickAddMenu(!showQuickAddMenu)}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-xs shadow-indigo-200 cursor-pointer shrink-0"
                title="Quick Actions Menu"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Action</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {/* Quick Add Popover */}
              {showQuickAddMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Log Actions
                  </div>
                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenNewOrderModal();
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer text-xs font-bold text-slate-800"
                  >
                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <div>New Wholesale Order</div>
                      <div className="text-[10px] font-normal text-slate-400">B2B client contract</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickAddMenu(false);
                      onOpenNewBatchModal();
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer text-xs font-bold text-slate-800"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Ship className="w-4 h-4" />
                    </div>
                    <div>
                      <div>Log Inward Catch</div>
                      <div className="text-[10px] font-normal text-slate-400">Harvester vessel dock intake</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Expandable Mobile Search Bar (Smooth drop-down on mobile) */}
        {showMobileSearch && (
          <div className="md:hidden pb-3 pt-1 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={mobileSearchInputRef}
                id="mobile-global-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Lot IDs, species, vessels, clients..."
                className="w-full bg-slate-50 text-xs text-slate-800 placeholder-slate-400 pl-9 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Filter Tag Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
              <span className="text-[10px] text-slate-400 font-bold shrink-0">Suggestions:</span>
              {searchChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setSearchQuery(chip)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Desktop Primary Navigation Bar (HIDDEN ON MOBILE because MobileBottomNav handles mobile navigation cleanly!) */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-2 no-scrollbar border-t border-slate-100">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
