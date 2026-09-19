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
  RefreshCw,
  LogOut,
  Building2
} from 'lucide-react';
import { SystemNotification } from '../types';
import { syncManager, SyncState } from '../sync/syncManager';

export type ActiveTab = 'dashboard' | 'retail_wholesale' | 'customers' | 'suppliers' | 'financials' | 'inventory' | 'settings' | 'platform';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNavigateToSettingsTab?: (category: 'profile' | 'workers' | 'subscription' | 'platform') => void;
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
  onSignOut?: () => void;
  isAuthenticated?: boolean;
  userRole?: string | null;
  userEmail?: string | null;
  showPlatformConsole?: boolean;
  companyName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onNavigateToSettingsTab,
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
  onSignOut,
  isAuthenticated = false,
  userRole = null,
  userEmail = null,
  showPlatformConsole = false,
  companyName
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showQuickAddMenu, setShowQuickAddMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState());

  useEffect(() => {
    return syncManager.subscribe(setSyncState);
  }, []);

  const notifMenuRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
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
  const searchChips = ['Tuna', 'Salmon', 'Lobster', 'LOT-', 'ORD-', 'PO-'];

  const navItems: { id: ActiveTab; label: string; shortLabel?: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Overview', shortLabel: 'Overview', icon: <Anchor className="w-4 h-4 shrink-0" /> },
    { id: 'retail_wholesale', label: 'Retail & Wholesale', shortLabel: 'Sales & POS', icon: <ShoppingBag className="w-4 h-4 shrink-0" /> },
    { id: 'customers', label: 'Customers', shortLabel: 'Customers', icon: <Users className="w-4 h-4 shrink-0" /> },
    { id: 'suppliers', label: 'Suppliers & POs', shortLabel: 'Suppliers', icon: <Ship className="w-4 h-4 shrink-0" /> },
    { id: 'financials', label: 'Financials & P&L', shortLabel: 'Financials', icon: <DollarSign className="w-4 h-4 shrink-0" /> },
    { id: 'inventory', label: 'Inventory', shortLabel: 'Inventory', icon: <Package className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8">
        {/* Main Toolbar Row */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-2.5 md:gap-3 lg:gap-4 min-w-0">
          
          {/* Left: Brand Identity & Tenant Company Workspace */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2 sm:gap-2.5 text-left group cursor-pointer focus:outline-none shrink-0"
              title="Return to Dashboard Overview"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 flex items-center justify-center text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform shrink-0">
                <ThermometerSnowflake className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-black text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors leading-none">
                    Frostly
                  </span>
                  
                  {/* Status Indicator */}
                  {isOnline ? (
                    <span className="hidden xl:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 leading-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-300 animate-pulse leading-none">
                      <WifiOff className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Offline</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase hidden sm:block mt-0.5">
                  Cold-Chain ERP
                </span>
              </div>
            </button>

            {/* Company Workspace Badge */}
            {companyName && (
              <>
                <div className="h-5 sm:h-6 w-px bg-slate-200 hidden xs:block shrink-0" />
                <div
                  id="header-company-name-badge"
                  className="hidden xs:inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-indigo-50/70 border border-indigo-200/70 text-[11px] sm:text-xs font-bold text-indigo-950 shadow-2xs max-w-[85px] xs:max-w-[110px] sm:max-w-[150px] md:max-w-[190px] lg:max-w-[240px] truncate shrink-0"
                  title={`Workspace Company: ${companyName}`}
                >
                  <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{companyName}</span>
                </div>
              </>
            )}
          </div>

          {/* Center: Global Search Input (Desktop & Tablets) */}
          <div className="flex-1 min-w-0 max-w-[180px] md:max-w-[240px] lg:max-w-xs xl:max-w-md hidden md:block mx-1 lg:mx-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="global-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lots, species, orders..."
                className="w-full h-9 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-800 placeholder-slate-400 pl-8.5 pr-10 lg:pr-12 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
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
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
            
            {/* Mobile Search Button (Phone only) */}
            <button
              id="header-mobile-search-btn"
              onClick={() => {
                setShowMobileSearch(!showMobileSearch);
                if (!showMobileSearch) {
                  setTimeout(() => mobileSearchInputRef.current?.focus(), 150);
                }
              }}
              className={`md:hidden h-9 w-9 flex items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 ${
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
            <div className="flex items-center shrink-0">
              {/* Mobile Single-Tap Unit Chip */}
              <button
                onClick={() => setUseImperial(!useImperial)}
                className="sm:hidden h-9 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
                title="Tap to switch between Metric (kg/°C) and Imperial (lbs/°F)"
              >
                {useImperial ? 'lbs' : 'kg'}
              </button>

              {/* Tablet & Desktop Segmented Toggle */}
              <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-semibold text-slate-600 border border-slate-200 h-9 shrink-0">
                <button
                  onClick={() => setUseImperial(false)}
                  className={`h-7.5 px-2 md:px-2.5 rounded-lg transition-all cursor-pointer flex items-center ${
                    !useImperial 
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold' 
                      : 'hover:text-slate-900 text-slate-500'
                  }`}
                >
                  kg / °C
                </button>
                <button
                  onClick={() => setUseImperial(true)}
                  className={`h-7.5 px-2 md:px-2.5 rounded-lg transition-all cursor-pointer flex items-center ${
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
                className="h-9 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer shrink-0"
                title="Install Frostly as Desktop or Mobile App"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* Subtle Toolbar Divider */}
            <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

            {/* System Notifications Popover */}
            <div className="relative shrink-0" ref={notifMenuRef}>
              <button
                id="notif-trigger-btn"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className={`relative h-9 w-9 flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
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
                className={`h-9 flex items-center gap-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
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
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                id="header-auth-session-btn"
                onClick={() => {
                  if (isAuthenticated) {
                    setShowUserMenu(!showUserMenu);
                  } else if (onOpenAuthModal) {
                    onOpenAuthModal();
                  }
                }}
                className={`h-9 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  isAuthenticated
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                }`}
                title={isAuthenticated ? `Signed in as ${userRole || 'Staff'}` : 'Offline / Sign in to Supabase'}
              >
                {isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="hidden md:inline font-bold">
                      {userRole ? userRole.toUpperCase() : 'STAFF'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:inline shrink-0" />
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="hidden sm:inline font-medium">Auth</span>
                  </>
                )}
              </button>

              {/* User Profile & Sign Out Popover */}
              {isAuthenticated && showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="pb-2.5 mb-2.5 border-b border-slate-100">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Current User
                    </div>
                    {userEmail && (
                      <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                        {userEmail}
                      </div>
                    )}
                    {companyName && (
                      <div className="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Company / Workspace
                        </div>
                        <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 mt-0.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{companyName}</span>
                        </div>
                      </div>
                    )}
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-1.5">
                      <ShieldCheck className="w-3 h-3 text-indigo-600" />
                      <span>{userRole ? userRole.toUpperCase() : 'STAFF'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {showPlatformConsole && (
                      <button
                        type="button"
                        id="header-menu-platform-console-btn"
                        onClick={() => {
                          setActiveTab('platform');
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Platform Creator Console</span>
                      </button>
                    )}

                    <button
                      type="button"
                      id="header-menu-workers-btn"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (onNavigateToSettingsTab) {
                          onNavigateToSettingsTab('workers');
                        } else {
                          setActiveTab('settings');
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Workers &amp; Team</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToSettingsTab) {
                          onNavigateToSettingsTab('profile');
                        } else {
                          setActiveTab('settings');
                        }
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Facility Settings</span>
                    </button>

                    {onSignOut && (
                      <button
                        type="button"
                        id="header-sign-out-btn"
                        onClick={() => {
                          setShowUserMenu(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Settings Action (Desktop & Mobile) */}
            <button
              id="header-settings-btn"
              onClick={() => setActiveTab('settings')}
              className={`hidden xs:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="System Settings & Facility Thresholds"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Platform Creator Console (Multi-Tenant Governance) - strictly hidden for tenants */}
            {showPlatformConsole && (
              <button
                id="header-platform-console-btn"
                onClick={() => setActiveTab('platform')}
                className={`h-9 flex items-center gap-1.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'platform'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                }`}
                title="Platform Creator Console (Multi-Tenant Governance & Manual MoMo Billing)"
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${activeTab === 'platform' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <span className="hidden xl:inline font-bold">Platform</span>
              </button>
            )}

            {/* Quick Actions Group */}
            {/* Desktop Action Buttons */}
            <div className="hidden xl:flex items-center gap-2 pl-1.5 border-l border-slate-200 shrink-0">
              <button
                id="btn-intake-catch-header"
                onClick={onOpenNewBatchModal}
                className="h-9 flex items-center gap-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer border border-slate-200/80"
              >
                <Ship className="w-3.5 h-3.5 text-blue-600" />
                <span>Intake Catch</span>
              </button>

              <button
                id="btn-create-order-header"
                onClick={onOpenNewOrderModal}
                className="h-9 flex items-center gap-1.5 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-xs shadow-indigo-200 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New B2B Order</span>
              </button>
            </div>

            {/* Mobile & Tablet Quick-Add Action Menu */}
            <div className="xl:hidden relative shrink-0" ref={quickAddRef}>
              <button
                id="header-quick-add-btn"
                onClick={() => setShowQuickAddMenu(!showQuickAddMenu)}
                className="h-9 flex items-center gap-1 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-xs shadow-indigo-200 cursor-pointer shrink-0"
                title="Quick Actions Menu"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Action</span>
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

        {/* Primary Navigation Bar (Optimized for Tablet & Desktop) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-2 no-scrollbar border-t border-slate-100 scroll-smooth">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 lg:px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 active:bg-slate-200'
                }`}
                title={item.label}
              >
                {item.icon}
                {/* Responsive label: on medium/tablet screens, use concise shortLabel to avoid cramped tabs or horizontal scroll */}
                <span className="inline lg:hidden">{item.shortLabel || item.label}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
