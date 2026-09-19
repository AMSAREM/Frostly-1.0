import React, { useState, useEffect, useRef } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { RetailWholesaleView } from './components/RetailWholesaleView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { FinancialsView } from './components/FinancialsView';
import { InventoryLedgerView } from './components/InventoryLedgerView';
import { SettingsView } from './components/SettingsView';
import { PlatformConsoleView } from './components/PlatformConsoleView';

import { TraceabilityPassportModal } from './components/Modals/TraceabilityPassportModal';
import { CatchWeightWeigherModal } from './components/Modals/CatchWeightWeigherModal';
import { InvoiceModal } from './components/Modals/InvoiceModal';
import { NewBatchModal } from './components/Modals/NewBatchModal';
import { NewOrderModal } from './components/Modals/NewOrderModal';
import { TenantOnboardingScreen } from './components/TenantOnboardingScreen';

import { PWAInstallModal } from './components/PWAInstallModal';
import { PWAStatusBanner } from './components/PWAStatusBanner';
import { MobileBottomNav } from './components/MobileBottomNav';
import { usePWAInstall, useNetworkStatus } from './utils/pwa';

import { TrialCountdownBanner } from './components/TrialCountdownBanner';
import { LegalFooter } from './components/LegalFooter';
import { LegalModal } from './components/LegalModal';

import { 
  INITIAL_BATCHES, 
  INITIAL_ORDERS, 
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PRODUCTS,
  INITIAL_RETAIL_TRANSACTIONS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_FINANCIAL_ENTRIES,
  INITIAL_NOTIFICATIONS,
  SPECIES_CATALOG
} from './data/mockData';

import { 
  InventoryBatch, 
  ClientOrder, 
  Customer,
  Supplier,
  RetailWholesaleProduct,
  RetailTransaction,
  PurchaseOrderLanding,
  FinancialLedgerEntry,
  SystemNotification,
  OrderStatus,
  AppSettings,
  DEFAULT_SETTINGS,
  StorageZone
} from './types';
import { formatCurrency } from './utils/formatters';
import { getSpeciesIdFromName, getSpeciesTaxonomy } from './utils/speciesHelper';
import { batchRepository } from './repositories/batchRepository';
import { customerRepository } from './repositories/customerRepository';
import { orderRepository } from './repositories/orderRepository';
import { supplierRepository } from './repositories/supplierRepository';
import { financialRepository } from './repositories/financialRepository';
import { purchaseOrderRepository } from './repositories/purchaseOrderRepository';
import { productRepository, retailTransactionRepository } from './repositories/retailRepository';
import { settingsRepository } from './repositories/settingsRepository';
import { notificationRepository } from './repositories/notificationRepository';
import { syncManager } from './sync/syncManager';
import { useAuth } from './components/AuthGate';
import { 
  signInAsTestUser, 
  StaffProfile,
  isSubscriptionPastDue,
  isSubscriptionLockedOut
} from './data/auth';
import { User } from '@supabase/supabase-js';

export default function App() {
  // Single authoritative source of truth for session and staff profile from AuthGate
  const { session, user: currentUser, staffProfile, refreshProfile: handleRefreshProfile, signOut: handleSignOut } = useAuth();

  const isSentinelFallbackOrg = 
    staffProfile?.organization_id === '00000000-0000-0000-0000-000000000001' ||
    staffProfile?.organization_id === 'org-frostly-hq';

  const activeOrgId = (!isSentinelFallbackOrg && staffProfile?.organization_id) ? staffProfile.organization_id : null;
  const isTenantUser = Boolean(activeOrgId);

  // PWA and Network state
  const { isInstallable, isInstalled, isIOS, isStandalone, triggerInstall } = usePWAInstall();
  const { isOnline } = useNetworkStatus();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Legal & Architecture Modals
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' | 'sitemap' }>({
    isOpen: false,
    type: 'privacy'
  });

  // Settings State with LocalStorage Persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('frostly_settings_v2');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === 'object' ? { ...DEFAULT_SETTINGS, ...parsed } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Navigation & Search - Support PWA App Shortcut URLs (e.g. ?tab=settings)
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab') as ActiveTab;
      if (tabParam && ['dashboard', 'retail_wholesale', 'customers', 'suppliers', 'financials', 'inventory', 'settings', 'platform'].includes(tabParam)) {
        return tabParam;
      }
    } catch (e) {
      // fallback
    }
    return 'dashboard';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [useImperial, setUseImperial] = useState<boolean>(() => settings.useImperial ?? false);

  // Currency Formatter aware of current settings
  const formatAppCurrency = (amount: number) => {
    return formatCurrency(amount, settings.currency || 'GHS');
  };

  // Safe tenant-scoped local storage load helper
  // Newly created or active tenant workspaces are initialized completely clean without demo data
  const [batches, setBatches] = useState<InventoryBatch[]>(() => {
    try {
      if (activeOrgId) {
        return batchRepository.getLocalCache([], activeOrgId);
      }
      return batchRepository.getLocalCache(INITIAL_BATCHES);
    } catch {
      return activeOrgId ? [] : INITIAL_BATCHES;
    }
  });

  const [orders, setOrders] = useState<ClientOrder[]>(() => {
    try {
      if (activeOrgId) {
        return orderRepository.getLocalCache([], activeOrgId);
      }
      return orderRepository.getLocalCache(INITIAL_ORDERS);
    } catch {
      return activeOrgId ? [] : INITIAL_ORDERS;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      if (activeOrgId) {
        return customerRepository.getLocalCache([], activeOrgId);
      }
      return customerRepository.getLocalCache(INITIAL_CUSTOMERS);
    } catch {
      return activeOrgId ? [] : INITIAL_CUSTOMERS;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      if (activeOrgId) {
        return supplierRepository.getLocalCache([], activeOrgId);
      }
      return supplierRepository.getLocalCache(INITIAL_SUPPLIERS);
    } catch {
      return activeOrgId ? [] : INITIAL_SUPPLIERS;
    }
  });

  const [products, setProducts] = useState<RetailWholesaleProduct[]>(() => {
    try {
      if (activeOrgId) {
        return productRepository.getLocalCache([], activeOrgId);
      }
      return productRepository.getLocalCache(INITIAL_PRODUCTS);
    } catch {
      return activeOrgId ? [] : INITIAL_PRODUCTS;
    }
  });

  const [retailSales, setRetailSales] = useState<RetailTransaction[]>(() => {
    try {
      if (activeOrgId) {
        return retailTransactionRepository.getLocalCache([], activeOrgId);
      }
      return retailTransactionRepository.getLocalCache(INITIAL_RETAIL_TRANSACTIONS);
    } catch {
      return activeOrgId ? [] : INITIAL_RETAIL_TRANSACTIONS;
    }
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderLanding[]>(() => {
    try {
      if (activeOrgId) {
        return purchaseOrderRepository.getLocalCache([], activeOrgId);
      }
      return purchaseOrderRepository.getLocalCache(INITIAL_PURCHASE_ORDERS);
    } catch {
      return activeOrgId ? [] : INITIAL_PURCHASE_ORDERS;
    }
  });

  const [financialEntries, setFinancialEntries] = useState<FinancialLedgerEntry[]>(() => {
    try {
      if (activeOrgId) {
        return financialRepository.getLocalCache([], activeOrgId);
      }
      return financialRepository.getLocalCache(INITIAL_FINANCIAL_ENTRIES);
    } catch {
      return activeOrgId ? [] : INITIAL_FINANCIAL_ENTRIES;
    }
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    try {
      if (activeOrgId) {
        return notificationRepository.getLocalCache([], activeOrgId);
      }
      return notificationRepository.getLocalCache(INITIAL_NOTIFICATIONS);
    } catch {
      return activeOrgId ? [] : INITIAL_NOTIFICATIONS;
    }
  });

  // Modals state
  const [passportBatch, setPassportBatch] = useState<InventoryBatch | null>(null);
  const [weigherOrder, setWeigherOrder] = useState<ClientOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<ClientOrder | null>(null);
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);
  const [settingsCategory, setSettingsCategory] = useState<'profile' | 'workers' | 'subscription' | 'platform' | 'coldchain' | 'units' | 'fulfillment' | 'alerts' | 'data'>('profile');

  const handleNavigateToSettingsCategory = (category: any) => {
    setSettingsCategory(category);
    setActiveTab('settings');
  };

  const configuredCreatorEmail = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_DEV_CREATOR_EMAIL : undefined;
  
  // Platform creator console is ONLY for platform owners who do NOT belong to an isolated tenant organization
  const isPlatformCreator = Boolean(
    !isTenantUser &&
    ((configuredCreatorEmail && currentUser?.email?.toLowerCase() === configuredCreatorEmail.toLowerCase()) ||
    currentUser?.email?.toLowerCase() === 'amoakoimml@gmail.com' ||
    currentUser?.user_metadata?.role === 'platform_creator' ||
    currentUser?.app_metadata?.role === 'platform_creator' ||
    currentUser?.user_metadata?.platform_owner === true ||
    (staffProfile && (staffProfile.role as string) === 'platform_creator'))
  );

  const showPlatformConsole = Boolean(isPlatformCreator && !isTenantUser);

  // Active workspace company / organization name:
  // When operating in Platform Creator host mode, default workspace is Frostly Platform HQ.
  // Otherwise, resolve dynamically to the tenant company's name.
  const companyName = isPlatformCreator
    ? 'Frostly Platform HQ'
    : (staffProfile?.organization?.name ||
       staffProfile?.organization_name ||
       currentUser?.user_metadata?.organization_name ||
       currentUser?.user_metadata?.org_name ||
       settings.companyName ||
       'Sharp Operations');

  // Keep settings.companyName synchronized with active tenant organization name or creator workspace
  useEffect(() => {
    if (isPlatformCreator) {
      if (settings.companyName !== 'Frostly Platform HQ') {
        setSettings((prev) => ({
          ...prev,
          companyName: 'Frostly Platform HQ',
        }));
      }
      return;
    }
    const orgName = staffProfile?.organization?.name || staffProfile?.organization_name;
    if (orgName && settings.companyName !== orgName) {
      setSettings((prev) => ({
        ...prev,
        companyName: orgName,
      }));
    }
  }, [isPlatformCreator, staffProfile?.organization?.name, staffProfile?.organization_name, settings.companyName]);

  // CRITICAL: Tenants MUST NEVER be redirected to creator platform - enforce tenant's own workspace
  useEffect(() => {
    if (isTenantUser && activeTab === 'platform') {
      setActiveTab('dashboard');
    }
  }, [isTenantUser, activeTab]);

  // If Creator logs in without a tenant organization, default directly to the Platform Console
  useEffect(() => {
    if (isPlatformCreator && !isTenantUser && staffProfile !== null) {
      setActiveTab((prev) => (prev === 'dashboard' ? 'platform' : prev));
    }
  }, [isPlatformCreator, isTenantUser, staffProfile]);

  // Hydrate batches and workspace data from repository on mount and when authenticated session or active tenant changes
  useEffect(() => {
    let isMounted = true;
    const currentOrgId = staffProfile?.organization_id;
    const fallbackList = isTenantUser ? [] : undefined;

    batchRepository.getBatches(fallbackList).then(fresh => {
      if (isMounted) {
        setBatches(fresh || []);
      }
      // Drains offline sync queue immediately if network and session are active
      syncManager.flushAll().catch(console.warn);
    }).catch(err => {
      console.warn('[App] Batch repository load error:', err);
    });

    customerRepository.getCustomers(fallbackList).then(fresh => {
      if (isMounted) {
        setCustomers(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Customer repository load error:', err);
    });

    orderRepository.getOrders(fallbackList).then(fresh => {
      if (isMounted) {
        setOrders(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Order repository load error:', err);
    });

    supplierRepository.getSuppliers(fallbackList).then(fresh => {
      if (isMounted) {
        setSuppliers(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Supplier repository load error:', err);
    });

    financialRepository.getEntries(fallbackList).then(fresh => {
      if (isMounted) {
        setFinancialEntries(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Financial repository load error:', err);
    });

    purchaseOrderRepository.getPurchaseOrders(fallbackList).then(fresh => {
      if (isMounted) {
        setPurchaseOrders(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Purchase Order repository load error:', err);
    });

    productRepository.getProducts(fallbackList).then(fresh => {
      if (isMounted) {
        setProducts(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Product repository load error:', err);
    });

    retailTransactionRepository.getTransactions(fallbackList).then(fresh => {
      if (isMounted) {
        setRetailSales(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Retail transaction repository load error:', err);
    });

    settingsRepository.getSettings(settings).then(fresh => {
      if (isMounted && fresh) {
        setSettings(fresh);
        setUseImperial(fresh.useImperial);
      }
    }).catch(err => {
      console.warn('[App] Settings repository load error:', err);
    });

    notificationRepository.getNotifications(fallbackList).then(fresh => {
      if (isMounted) {
        setNotifications(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Notification repository load error:', err);
    });

    return () => { isMounted = false; };
  }, [session?.user?.id, staffProfile?.organization_id, isTenantUser]);

  // Scoped Tenant Cache Effects - Keep repository caches strictly scoped by tenant
  useEffect(() => {
    orderRepository.setLocalCache(orders, staffProfile?.organization_id);
  }, [orders, staffProfile?.organization_id]);

  useEffect(() => {
    supplierRepository.setLocalCache(suppliers, staffProfile?.organization_id);
  }, [suppliers, staffProfile?.organization_id]);

  useEffect(() => {
    productRepository.setLocalCache(products, staffProfile?.organization_id);
  }, [products, staffProfile?.organization_id]);

  useEffect(() => {
    retailTransactionRepository.setLocalCache(retailSales, staffProfile?.organization_id);
  }, [retailSales, staffProfile?.organization_id]);

  useEffect(() => {
    purchaseOrderRepository.setLocalCache(purchaseOrders, staffProfile?.organization_id);
  }, [purchaseOrders, staffProfile?.organization_id]);

  useEffect(() => {
    financialRepository.setLocalCache(financialEntries, staffProfile?.organization_id);
  }, [financialEntries, staffProfile?.organization_id]);

  useEffect(() => {
    settingsRepository.saveSettings(settings).catch(console.warn);
  }, [settings]);

  // Helper to reconcile Dual-Price & Retail catalog products with cold-chain inventory lots
  const reconcileCatalogWithInventory = (
    currentProducts: RetailWholesaleProduct[],
    currentBatches: InventoryBatch[]
  ): { updatedBatches: InventoryBatch[]; newLots: InventoryBatch[] } => {
    if (!currentProducts || currentProducts.length === 0) {
      return { updatedBatches: currentBatches, newLots: [] };
    }

    const newLots: InventoryBatch[] = [];
    let workingBatches = [...currentBatches];

    for (const product of currentProducts) {
      const hasLot = workingBatches.some(b => 
        (product.linkedBatchId && b.id === product.linkedBatchId) ||
        (b.linkedProductId && b.linkedProductId === product.id) ||
        (b.productSku && product.sku && b.productSku.toLowerCase() === product.sku.toLowerCase()) ||
        b.id === `LOT-RET-${product.id.replace('prod-', '')}`
      );

      if (!hasLot) {
        const matchedSpecies = SPECIES_CATALOG.find(s => s.id === product.speciesId);
        const spPrefix = (product.speciesId || 'SPEC').replace('spec-', '').toUpperCase().slice(0, 4);
        const cleanSku = (product.sku || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4);
        const cleanId = (product.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4);
        const newBatchId = `LOT-RET-${spPrefix}-${cleanSku || cleanId || Math.floor(1000 + Math.random() * 9000)}`;

        const zone: StorageZone = product.storageZone || 
          (product.grade === 'Sashimi AAA' 
            ? 'Super-Cryo Deep Freeze (-60°C)' 
            : product.cutType === 'Live in Oxygen Tank' 
              ? 'Live Seawater Tank (+8°C)' 
              : 'Commercial Cold Storage (-22°C)');

        const currentTemp = zone.includes('-60') ? -59.8 : zone.includes('-22') ? -22.1 : zone.includes('+8') ? 8.2 : 0.8;
        const targetTemp = zone.includes('-60') ? -60 : zone.includes('-22') ? -22 : zone.includes('+8') ? 8 : 1;

        const isDual = product.isAvailableForRetail && product.isAvailableForWholesale;
        const channelLabel = isDual ? 'Dual (B2B/POS)' : product.isAvailableForRetail ? 'Retail (POS)' : 'Wholesale (B2B)';

        const newLot: InventoryBatch = {
          id: newBatchId,
          speciesId: product.speciesId,
          speciesName: product.name,
          scientificName: matchedSpecies?.scientificName || 'Seafood Commercial Cut',
          category: product.category,
          harvestDate: new Date().toISOString().split('T')[0],
          landingPort: product.origin || 'San Francisco Cold Storage Hub',
          vesselName: 'Retail Packhouse & Cold Vault',
          vesselRegistration: `RET-${product.sku || 'CUT'}`,
          captainName: 'Operations Lead',
          faoArea: 'FAO 67 (Northeast Pacific)',
          coordinates: {
            lat: 37.7749,
            lng: -122.4194,
            description: product.origin || 'Certified Packhouse'
          },
          gearType: 'Certified Retail Cutting & Skin-Packing',
          grade: product.grade,
          initialWeightKg: Number(product.stockKg) || 0,
          availableWeightKg: Number(product.stockKg) || 0,
          allocatedWeightKg: 0,
          storageZone: zone,
          currentTempCelsius: currentTemp,
          targetTempCelsius: targetTemp,
          costPerKg: Number(product.costPricePerUnit) || 0,
          wholesalePricePerKg: Number(product.wholesalePricePerUnit) || 0,
          certifications: ['FDA HACCP Compliant', 'Retail Skin-Pack', 'Traceable Origin'],
          inspectionStatus: 'Passed',
          histaminePpm: 0.8,
          coreTempCelsius: currentTemp,
          receivedDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          qrCodeSeed: `QR-RET-${product.sku || product.id}`,
          notes: `Retail Inventory Lot for ${product.name} (${product.cutType}). SKU: ${product.sku}. Pack: ${product.retailPackSize || 'Standard'}. Channel: ${channelLabel}`,
          linkedProductId: product.id,
          productSku: product.sku,
          isRetailCutLot: true
        };

        newLots.push(newLot);
        workingBatches = [newLot, ...workingBatches];
      }
    }

    return { updatedBatches: workingBatches, newLots };
  };

  // Auto-reconcile catalog products to ensure every retail/dual product has a physical lot in Inventory Ledger
  const reconciledProductCountRef = useRef<number>(-1);

  useEffect(() => {
    if (products.length > 0 && reconciledProductCountRef.current !== products.length) {
      const { updatedBatches, newLots } = reconcileCatalogWithInventory(products, batches);
      if (newLots.length > 0) {
        setBatches(updatedBatches);
        newLots.forEach(lot => {
          batchRepository.save(lot, true).catch(err => {
            console.warn('[App] batchRepository auto-reconcile save error:', err);
          });
        });
      }
      reconciledProductCountRef.current = products.length;
    }
  }, [products, batches]);

  // Settings & Data Management Handlers
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    setUseImperial(newSettings.useImperial);
    settingsRepository.saveSettings(newSettings).catch(err => {
      console.warn('[App] settingsRepository save error:', err);
    });
    addNotification({
      title: 'Settings Updated',
      message: 'Enterprise configuration and telemetry thresholds saved.',
      type: 'system',
      urgency: 'low'
    });
  };

  const handleRestoreAllData = (imported: {
    batches?: InventoryBatch[];
    orders?: ClientOrder[];
    customers?: Customer[];
    suppliers?: Supplier[];
    products?: RetailWholesaleProduct[];
    retailSales?: RetailTransaction[];
    purchaseOrders?: PurchaseOrderLanding[];
    financialEntries?: FinancialLedgerEntry[];
    settings?: AppSettings;
  }) => {
    if (imported.batches) {
      setBatches(imported.batches);
      batchRepository.resetCache(imported.batches);
    }
    if (imported.orders) setOrders(imported.orders);
    if (imported.customers) {
      setCustomers(imported.customers);
      customerRepository.resetCache(imported.customers);
    }
    if (imported.suppliers) setSuppliers(imported.suppliers);
    if (imported.products) setProducts(imported.products);
    if (imported.retailSales) setRetailSales(imported.retailSales);
    if (imported.purchaseOrders) setPurchaseOrders(imported.purchaseOrders);
    if (imported.financialEntries) setFinancialEntries(imported.financialEntries);
    if (imported.settings) {
      setSettings(imported.settings);
      setUseImperial(imported.settings.useImperial);
    }
    addNotification({
      title: 'Database Restored',
      message: 'Complete ERP records restored from JSON backup archive.',
      type: 'system',
      urgency: 'low'
    });
  };

  const handleResetToDefaults = () => {
    setBatches(INITIAL_BATCHES);
    setOrders(INITIAL_ORDERS);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setProducts(INITIAL_PRODUCTS);
    setRetailSales(INITIAL_RETAIL_TRANSACTIONS);
    setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
    setFinancialEntries(INITIAL_FINANCIAL_ENTRIES);
    setSettings(DEFAULT_SETTINGS);
    setUseImperial(DEFAULT_SETTINGS.useImperial);
    localStorage.clear();
    batchRepository.resetCache(INITIAL_BATCHES);
    customerRepository.resetCache(INITIAL_CUSTOMERS);
    addNotification({
      title: 'Demo Data Restored',
      message: 'All seafood inventory and financials reset to factory sample state.',
      type: 'system',
      urgency: 'low'
    });
  };

  // Notifications handler
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    notificationRepository.markAsRead(id).catch(err => {
      console.warn('[App] notificationRepository markAsRead error:', err);
    });
  };

  const addNotification = (notif: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: SystemNotification = {
      ...notif,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'notif-' + Date.now(),
      timestamp: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    notificationRepository.save(newNotif).catch(err => {
      console.warn('[App] notificationRepository save error:', err);
    });
  };

  // Add Batch Handler
  const handleAddBatch = (newBatch: InventoryBatch) => {
    setBatches(prev => [newBatch, ...prev]);
    batchRepository.save(newBatch, true).catch(err => {
      console.warn('[App] batchRepository save error:', err);
    });
    addNotification({
      type: 'catch_landed',
      title: `Intake Complete: ${newBatch.speciesName}`,
      message: `Lot ${newBatch.id} (${newBatch.availableWeightKg} kg) placed in ${newBatch.storageZone}.`,
      urgency: 'medium'
    });
  };

  // Update Batch Handler (Stock Adjustment / Audit / Calibration)
  const handleUpdateBatch = (updatedBatch: InventoryBatch) => {
    setBatches(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b));
    batchRepository.save(updatedBatch, false).catch(err => {
      console.warn('[App] batchRepository save error on update:', err);
    });
    addNotification({
      type: 'system',
      title: `Stock Calibrated: Lot ${updatedBatch.id}`,
      message: `Available stock updated to ${updatedBatch.availableWeightKg} kg for ${updatedBatch.speciesName}.`,
      urgency: 'low'
    });
  };

  // Add Order Handler
  const handleAddOrder = (newOrder: ClientOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    orderRepository.saveOrderWithItems(newOrder).catch(err => {
      console.warn('[App] orderRepository save error:', err);
    });
    
    // Update customer spend and balance if matched
    const isCreditOrder = newOrder.paymentStatus !== 'Paid';
    const orderVal = newOrder.adjustedTotalUSD || newOrder.quotedTotalUSD;

    setCustomers(prev => prev.map(cust => {
      const isMatch = (newOrder.customerId && cust.id === newOrder.customerId) ||
        cust.name.toLowerCase() === newOrder.clientName.toLowerCase() ||
        cust.companyName.toLowerCase() === newOrder.clientName.toLowerCase();

      if (isMatch) {
        const newTotalCount = cust.totalOrdersCount + 1;
        const newTotalSpend = cust.totalSpendUSD + orderVal;
        const newBalance = isCreditOrder ? cust.outstandingBalanceUSD + orderVal : cust.outstandingBalanceUSD;

        customerRepository.updateFinancials(cust.id, newBalance, newTotalSpend, newTotalCount).catch(err => {
          console.warn('[App] customerRepository updateFinancials on order failed:', err);
        });
        return {
          ...cust,
          totalOrdersCount: newTotalCount,
          totalSpendUSD: newTotalSpend,
          outstandingBalanceUSD: newBalance
        };
      }
      return cust;
    }));

    // Add Income ledger entry
    const newFinEntry: FinancialLedgerEntry = {
      id: `FIN-${Date.now().toString().slice(-4)}`,
      date: newOrder.orderDate,
      type: 'Income',
      category: 'Revenue (Wholesale)',
      description: isCreditOrder
        ? `Wholesale Credit Order (${newOrder.paymentTerms || 'Net Terms'}) - ${newOrder.clientName} (${newOrder.id})`
        : `Wholesale Order Placed (Immediate) - ${newOrder.clientName} (${newOrder.id})`,
      referenceId: newOrder.id,
      entityName: newOrder.clientName,
      amount: orderVal,
      paymentMethod: isCreditOrder ? `Credit Sale (${newOrder.paymentTerms || 'Net-30'})` : 'Paid on Order',
      status: isCreditOrder ? 'Pending' : 'Settled'
    };
    setFinancialEntries(prev => [newFinEntry, ...prev]);
    financialRepository.addEntry(newFinEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for order:', err);
    });

    // Update inventory batches: allocate weight through batchRepository
    newOrder.items.forEach(item => {
      if (!item.lotId) return;
      const targetBatch = batches.find(b => b.id === item.lotId);
      if (targetBatch) {
        const newAllocated = targetBatch.allocatedWeightKg + item.requestedWeightKg;
        const newAvailable = Math.max(0, targetBatch.initialWeightKg - newAllocated);
        // All batch mutations MUST go through batchRepository
        batchRepository.updateWeights(targetBatch.id, newAvailable, newAllocated)
          .then(updated => {
            if (updated) {
              setBatches(prev => prev.map(b => b.id === updated.id ? updated : b));
            }
          })
          .catch(err => {
            console.warn('[App] Error updating batch weight in repository:', err);
          });
      }
    });

    addNotification({
      type: 'order_update',
      title: `New B2B Order: ${newOrder.clientName}`,
      message: `Order ${newOrder.id} placed for ${newOrder.destinationCity}. Ready for catch-weight weighing.`,
      urgency: 'low'
    });
  };

  // Dynamic Catch-Weight Weigher Save Handler
  const handleSaveWeighedItems = (
    orderId: string, 
    updatedItems: ClientOrder['items'], 
    adjustedTotal: number
  ) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;
      const updatedOrder: ClientOrder = {
        ...order,
        items: updatedItems,
        adjustedTotalUSD: adjustedTotal,
        status: order.status === 'Pending Confirmation' ? 'Weighing & Grading' : order.status
      };
      orderRepository.saveOrderWithItems(updatedOrder).catch(err => {
        console.warn('[App] orderRepository save after weighing error:', err);
      });
      return updatedOrder;
    }));

    // Calibrate batch allocations based on exact certified scale weight through batchRepository
    updatedItems.forEach(item => {
      if (!item.lotId || item.actualWeighedKg === null) return;
      const targetBatch = batches.find(b => b.id === item.lotId);
      if (targetBatch) {
        const weightDelta = item.actualWeighedKg - item.requestedWeightKg;
        const newAllocated = Math.max(0, targetBatch.allocatedWeightKg + weightDelta);
        const newAvailable = Math.max(0, targetBatch.initialWeightKg - newAllocated);
        // All batch mutations MUST go through batchRepository
        batchRepository.updateWeights(targetBatch.id, newAvailable, newAllocated)
          .then(updated => {
            if (updated) {
              setBatches(prev => prev.map(b => b.id === updated.id ? updated : b));
            }
          })
          .catch(err => {
            console.warn('[App] Error calibrating batch weight in repository:', err);
          });
      }
    });

    addNotification({
      type: 'order_update',
      title: `Catch-Weight Calibrated: Order ${orderId}`,
      message: `Yield weighed on certified scale. Adjusted total recalibrated to $${adjustedTotal.toFixed(2)}.`,
      urgency: 'low'
    });
  };

  // Order Pipeline Advancement Handler
  const handleAdvanceOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updated = { ...o, status: nextStatus };
      orderRepository.save(updated).catch(err => {
        console.warn('[App] orderRepository advance status error:', err);
      });
      return updated;
    }));

    addNotification({
      type: 'order_update',
      title: `Order ${orderId} Stage Updated`,
      message: `Fulfillment stage progressed to: ${nextStatus}.`,
      urgency: 'low'
    });
  };

  // Payment status update handler
  const handleUpdatePaymentStatus = (orderId: string, status: ClientOrder['paymentStatus']) => {
    let orderToUpdate: ClientOrder | undefined;

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      orderToUpdate = o;
      const updated = { ...o, paymentStatus: status };
      orderRepository.save(updated).catch(err => {
        console.warn('[App] orderRepository update payment status error:', err);
      });
      return updated;
    }));

    // If marked Paid and previously had a pending credit balance, adjust customer's balance
    if (status === 'Paid' && orderToUpdate && orderToUpdate.paymentStatus !== 'Paid') {
      const orderAmount = orderToUpdate.adjustedTotalUSD || orderToUpdate.quotedTotalUSD;
      const targetClientId = orderToUpdate.customerId;
      const targetClientName = orderToUpdate.clientName;

      setCustomers(prev => prev.map(cust => {
        const isMatch = (targetClientId && cust.id === targetClientId) ||
          cust.name.toLowerCase() === targetClientName.toLowerCase() ||
          cust.companyName.toLowerCase() === targetClientName.toLowerCase();

        if (isMatch) {
          const newBal = Math.max(0, cust.outstandingBalanceUSD - orderAmount);
          customerRepository.updateFinancials(cust.id, newBal, cust.totalSpendUSD, cust.totalOrdersCount).catch(err => {
            console.warn('[App] customerRepository updateFinancials on order mark-paid failed:', err);
          });
          return {
            ...cust,
            outstandingBalanceUSD: newBal
          };
        }
        return cust;
      }));

      // Update matching financial entry to Settled
      setFinancialEntries(prev => prev.map(entry => {
        if (entry.referenceId === orderId && entry.status === 'Pending') {
          return { ...entry, status: 'Settled' as const };
        }
        return entry;
      }));
    }

    addNotification({
      type: 'order_update',
      title: `Payment Updated: ${orderId}`,
      message: `Account status updated to ${status}.`,
      urgency: 'low'
    });
  };

  // Customer Management Handlers
  const handleAddCustomer = (newCust: Customer) => {
    setCustomers(prev => [newCust, ...prev]);
    customerRepository.save(newCust, true).catch(err => {
      console.warn('[App] customerRepository save error:', err);
    });
    addNotification({
      type: 'order_update',
      title: `New Customer Enrolled: ${newCust.name}`,
      message: `${newCust.companyName} registered with ${newCust.tier}. Credit Limit: $${newCust.creditLimitUSD.toLocaleString()}.`,
      urgency: 'low'
    });
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCust.id ? updatedCust : c));
    customerRepository.save(updatedCust, false).catch(err => {
      console.warn('[App] customerRepository update error:', err);
    });
  };

  const handleSelectCustomerForOrder = (customer: Customer) => {
    setPreselectedCustomerId(customer.id);
    setIsNewOrderModalOpen(true);
  };

  // Supplier Management Handlers
  const handleAddSupplier = (newSup: Supplier) => {
    setSuppliers(prev => [newSup, ...prev]);
    supplierRepository.save(newSup, true).catch(err => {
      console.warn('[App] supplierRepository save error:', err);
    });
    addNotification({
      type: 'order_update',
      title: `New Harvester Supplier Added`,
      message: `${newSup.name} (${newSup.portLocation}) registered.`,
      urgency: 'low'
    });
  };

  const handleAddPurchaseOrder = (newPO: PurchaseOrderLanding) => {
    setPurchaseOrders(prev => [newPO, ...prev]);
    purchaseOrderRepository.savePurchaseOrderWithItems(newPO).catch(err => {
      console.warn('[App] purchaseOrderRepository save error:', err);
    });

    // Update Supplier totals
    setSuppliers(prev => prev.map(sup => {
      if (sup.id === newPO.supplierId) {
        const item = newPO.speciesItems[0];
        const updatedSup: Supplier = {
          ...sup,
          totalPurchasedUSD: sup.totalPurchasedUSD + newPO.totalCostUSD,
          outstandingPayableUSD: sup.outstandingPayableUSD + newPO.totalCostUSD,
          totalWeightSuppliedKg: sup.totalWeightSuppliedKg + (item ? item.weightKg : 0)
        };
        supplierRepository.save(updatedSup, false).catch(err => {
          console.warn('[App] supplierRepository update totals error:', err);
        });
        return updatedSup;
      }
      return sup;
    }));

    // Add to Inventory Batches
    const item = newPO.speciesItems[0];
    if (item) {
      const resolvedSpeciesId = getSpeciesIdFromName(item.speciesName);
      const taxonomy = getSpeciesTaxonomy(resolvedSpeciesId);
      const newBatch: InventoryBatch = {
        id: newPO.lotAssignedId,
        speciesId: resolvedSpeciesId,
        speciesName: item.speciesName,
        scientificName: taxonomy.scientificName,
        category: taxonomy.category,
        harvestDate: newPO.orderDate,
        landingPort: newPO.portLocation,
        vesselName: newPO.vesselName,
        vesselRegistration: 'REG-LANDED-88',
        captainName: 'Direct Fleet Captain',
        faoArea: 'FAO 61/71 Pacific Marine Grounds',
        coordinates: {
          lat: 37.7749,
          lng: -122.4194,
          description: newPO.portLocation
        },
        gearType: 'Certified Sustainable Gear',
        grade: item.grade,
        initialWeightKg: item.weightKg,
        availableWeightKg: item.weightKg,
        allocatedWeightKg: 0,
        storageZone: item.storageZone,
        currentTempCelsius: item.storageZone.includes('-60') ? -59.5 : item.storageZone.includes('-22') ? -22.1 : 0.8,
        targetTempCelsius: item.storageZone.includes('-60') ? -60 : item.storageZone.includes('-22') ? -22 : 1.0,
        costPerKg: item.costPerKg,
        wholesalePricePerKg: item.costPerKg * 1.45,
        certifications: ['MSC Certified', 'FDA HACCP Certified'],
        inspectionStatus: 'Passed',
        histaminePpm: 4.2,
        coreTempCelsius: -58.0,
        receivedDate: newPO.orderDate,
        expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        qrCodeSeed: `QR-AUTH-PROV-${newPO.lotAssignedId}`,
        notes: newPO.notes
      };
      setBatches(prev => [newBatch, ...prev]);
      batchRepository.save(newBatch, true).catch(err => {
        console.warn('[App] batchRepository save error for landing:', err);
      });
    }

    // Add COGS Financial Ledger Entry
    const newFinEntry: FinancialLedgerEntry = {
      id: `FIN-${Date.now().toString().slice(-4)}`,
      date: newPO.orderDate,
      type: 'COGS',
      category: 'COGS (Catch Intake)',
      description: `Catch Intake Purchase - ${newPO.supplierName} (${newPO.id})`,
      referenceId: newPO.id,
      entityName: newPO.supplierName,
      amount: newPO.totalCostUSD,
      paymentMethod: 'Accounts Payable Net Terms',
      status: 'Pending'
    };
    setFinancialEntries(prev => [newFinEntry, ...prev]);
    financialRepository.addEntry(newFinEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for purchase order:', err);
    });

    addNotification({
      type: 'catch_landed',
      title: `Inward Catch Logged: ${newPO.id}`,
      message: `Landed biomass of ${item?.weightKg.toLocaleString()}kg received from ${newPO.supplierName}. Assigned Lot ${newPO.lotAssignedId}.`,
      urgency: 'medium'
    });
  };

  // Retail POS Handlers
  const handleCompleteRetailSale = (sale: RetailTransaction) => {
    setRetailSales(prev => [sale, ...prev]);
    retailTransactionRepository.recordSaleWithItems(sale).catch(err => {
      console.warn('[App] retailTransactionRepository recordSale error:', err);
    });

    // Deduct stock from products & persist to Supabase
    setProducts(prev => prev.map(prod => {
      const soldItem = sale.items.find(i => i.productId === prod.id);
      if (soldItem) {
        const soldWeight = prod.unit === 'pack' ? soldItem.quantity * 0.5 : soldItem.quantity;
        const updatedProd = {
          ...prod,
          stockKg: Math.max(0, parseFloat((prod.stockKg - soldWeight).toFixed(1)))
        };
        productRepository.save(updatedProd, false).catch(err => {
          console.warn('[App] productRepository update stock error:', err);
        });
        return updatedProd;
      }
      return prod;
    }));

    // Deduct sold stock from corresponding inventory batches for ledger accountability
    setBatches(prev => prev.map(batch => {
      const soldItem = sale.items.find(i => 
        (batch.linkedProductId && i.productId === batch.linkedProductId) ||
        (batch.productSku && i.productName.includes(batch.productSku))
      );
      if (soldItem) {
        const soldWeight = soldItem.unit === 'pack' ? soldItem.quantity * 0.5 : soldItem.quantity;
        const newAvailable = Math.max(0, parseFloat((batch.availableWeightKg - soldWeight).toFixed(1)));
        batchRepository.updateWeights(batch.id, newAvailable, batch.allocatedWeightKg).catch(err => {
          console.warn('[App] batchRepository updateWeights error during retail sale:', err);
        });
        return {
          ...batch,
          availableWeightKg: newAvailable
        };
      }
      return batch;
    }));

    // If billed to Customer Credit Account, update customer ledger and outstanding balance
    const isCreditAccountSale = sale.paymentMethod === 'Customer Credit Account';
    if (isCreditAccountSale) {
      setCustomers(prev => prev.map(cust => {
        const isMatch = (sale.customerId && cust.id === sale.customerId) ||
          cust.name.toLowerCase() === sale.customerName.toLowerCase() ||
          cust.companyName.toLowerCase() === sale.customerName.toLowerCase();

        if (isMatch) {
          const newBal = cust.outstandingBalanceUSD + sale.totalAmount;
          const newSpend = cust.totalSpendUSD + sale.totalAmount;
          const newCount = cust.totalOrdersCount + 1;
          customerRepository.updateFinancials(cust.id, newBal, newSpend, newCount).catch(err => {
            console.warn('[App] customerRepository updateFinancials on POS credit sale failed:', err);
          });
          return {
            ...cust,
            outstandingBalanceUSD: newBal,
            totalSpendUSD: newSpend,
            totalOrdersCount: newCount
          };
        }
        return cust;
      }));
    }

    // Add Income ledger entry
    const newFinEntry: FinancialLedgerEntry = {
      id: `FIN-${Date.now().toString().slice(-4)}`,
      date: sale.date.split(' ')[0],
      type: 'Income',
      category: 'Revenue (Retail POS)',
      description: isCreditAccountSale 
        ? `Retail Credit Sale (On Account) - ${sale.receiptNumber} (${sale.customerName})`
        : `Retail Counter Sale - ${sale.receiptNumber} (${sale.customerName})`,
      referenceId: sale.id,
      entityName: sale.customerName,
      amount: sale.totalAmount,
      paymentMethod: sale.paymentMethod,
      status: isCreditAccountSale ? 'Pending' : 'Settled'
    };
    setFinancialEntries(prev => [newFinEntry, ...prev]);
    financialRepository.addEntry(newFinEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for retail sale:', err);
    });

    addNotification({
      type: 'order_update',
      title: isCreditAccountSale ? `Credit Sale Logged: $${sale.totalAmount.toFixed(2)}` : `Retail POS Sale: $${sale.totalAmount.toFixed(2)}`,
      message: isCreditAccountSale 
        ? `Receipt ${sale.receiptNumber} billed to ${sale.customerName}'s credit facility.`
        : `Receipt ${sale.receiptNumber} processed via ${sale.paymentMethod}.`,
      urgency: 'low'
    });
  };

  const handleUpdateProductPricing = (productId: string, wholesalePrice: number, retailPrice: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updatedProd = {
          ...p,
          wholesalePricePerUnit: wholesalePrice,
          retailPricePerUnit: retailPrice
        };
        productRepository.save(updatedProd, false).catch(err => {
          console.warn('[App] productRepository update pricing error:', err);
        });
        return updatedProd;
      }
      return p;
    }));

    addNotification({
      type: 'order_update',
      title: `Price Book Updated`,
      message: `Product pricing adjusted for SKU.`,
      urgency: 'low'
    });
  };

  const handleSaveProduct = async (product: RetailWholesaleProduct) => {
    try {
      await productRepository.save(product);
      setProducts(prev => {
        const index = prev.findIndex(p => p.id === product.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = product;
          return updated;
        }
        return [product, ...prev];
      });

      // Synchronize to Inventory Ledger for total accountability
      const matchedSpecies = SPECIES_CATALOG.find(s => s.id === product.speciesId);
      const isDual = product.isAvailableForRetail && product.isAvailableForWholesale;
      const channelLabel = isDual ? 'Dual (B2B/POS)' : product.isAvailableForRetail ? 'Retail (POS)' : 'Wholesale (B2B)';

      let linkedBatch: InventoryBatch | undefined;
      let isNewBatch = false;

      // 1. Check if product was linked to an existing landed vessel lot
      if (product.linkedBatchId) {
        const existing = batches.find(b => b.id === product.linkedBatchId);
        if (existing) {
          linkedBatch = {
            ...existing,
            speciesName: existing.speciesName,
            availableWeightKg: product.stockKg > 0 ? product.stockKg : existing.availableWeightKg,
            wholesalePricePerKg: product.wholesalePricePerUnit || existing.wholesalePricePerKg,
            costPerKg: product.costPricePerUnit || existing.costPerKg,
            notes: `${existing.notes || ''} | Processed Retail Cut: ${product.name} (${product.sku})`.trim(),
            linkedProductId: product.id,
            productSku: product.sku,
            isRetailCutLot: true,
          };
        }
      }

      // 2. If not linked to a vessel lot, check if a dedicated retail lot already exists for this product ID or SKU
      if (!linkedBatch) {
        const existingLot = batches.find(b => 
          (b.linkedProductId && b.linkedProductId === product.id) || 
          (b.productSku && b.productSku === product.sku) ||
          b.id === `LOT-RET-${product.id.replace('prod-', '')}`
        );

        if (existingLot) {
          linkedBatch = {
            ...existingLot,
            speciesName: product.name,
            grade: product.grade,
            initialWeightKg: Math.max(existingLot.initialWeightKg, product.stockKg),
            availableWeightKg: product.stockKg,
            costPerKg: product.costPricePerUnit,
            wholesalePricePerKg: product.wholesalePricePerUnit,
            storageZone: product.storageZone || existingLot.storageZone,
            notes: `Retail Inventory Lot for ${product.name} (${product.cutType}). SKU: ${product.sku}. Pack: ${product.retailPackSize || 'Standard'}. Channel: ${channelLabel}`,
            linkedProductId: product.id,
            productSku: product.sku,
            isRetailCutLot: true
          };
        }
      }

      // 3. If no lot exists yet, create a brand new dedicated Retail Inventory Batch in the ledger
      if (!linkedBatch) {
        isNewBatch = true;
        const spPrefix = (product.speciesId || 'SPEC').replace('spec-', '').toUpperCase().slice(0, 4);
        const lotSuffix = product.sku ? product.sku.replace(/[^a-zA-Z0-9]/g, '').slice(-4) : Math.floor(1000 + Math.random() * 9000);
        const newBatchId = `LOT-RET-${spPrefix}-${lotSuffix}`;

        const zone: StorageZone = product.storageZone || 
          (product.grade === 'Sashimi AAA' 
            ? 'Super-Cryo Deep Freeze (-60°C)' 
            : product.cutType === 'Live in Oxygen Tank' 
              ? 'Live Seawater Tank (+8°C)' 
              : 'Commercial Cold Storage (-22°C)');

        const currentTemp = zone.includes('-60') ? -59.8 : zone.includes('-22') ? -22.1 : zone.includes('+8') ? 8.2 : 0.8;
        const targetTemp = zone.includes('-60') ? -60 : zone.includes('-22') ? -22 : zone.includes('+8') ? 8 : 1;

        linkedBatch = {
          id: newBatchId,
          speciesId: product.speciesId,
          speciesName: product.name,
          scientificName: matchedSpecies?.scientificName || 'Seafood Retail Stock',
          category: product.category,
          harvestDate: new Date().toISOString().split('T')[0],
          landingPort: product.origin || 'San Francisco Cold Storage Hub',
          vesselName: 'Retail Packhouse & Cold Vault',
          vesselRegistration: `RET-${product.sku}`,
          captainName: 'Operations Lead',
          faoArea: 'FAO 67 (Northeast Pacific)',
          coordinates: {
            lat: 37.7749,
            lng: -122.4194,
            description: product.origin || 'Certified Packhouse'
          },
          gearType: 'Certified Retail Cutting & Skin-Packing',
          grade: product.grade,
          initialWeightKg: Number(product.stockKg) || 0,
          availableWeightKg: Number(product.stockKg) || 0,
          allocatedWeightKg: 0,
          storageZone: zone,
          currentTempCelsius: currentTemp,
          targetTempCelsius: targetTemp,
          costPerKg: Number(product.costPricePerUnit) || 0,
          wholesalePricePerKg: Number(product.wholesalePricePerUnit) || 0,
          certifications: ['FDA HACCP Compliant', 'Retail Skin-Pack', 'Traceable Origin'],
          inspectionStatus: 'Passed',
          histaminePpm: 0.8,
          coreTempCelsius: currentTemp,
          receivedDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          qrCodeSeed: `QR-RET-${product.sku}`,
          notes: `Retail Inventory Lot for ${product.name} (${product.cutType}). SKU: ${product.sku}. Pack: ${product.retailPackSize || 'Standard'}. Channel: ${channelLabel}`,
          linkedProductId: product.id,
          productSku: product.sku,
          isRetailCutLot: true
        };
      }

      // Persist the inventory lot via batchRepository
      await batchRepository.save(linkedBatch, isNewBatch);

      // Update state for instant UI reflection in Inventory Ledger
      setBatches(prev => {
        const idx = prev.findIndex(b => b.id === linkedBatch!.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = linkedBatch!;
          return updated;
        }
        return [linkedBatch!, ...prev];
      });

      addNotification({
        type: 'order_update',
        title: `Product & Inventory Accounted: ${product.name}`,
        message: `${product.name} (${product.sku}) saved and reflected in the Inventory Ledger with ${product.stockKg} kg stock (Lot: ${linkedBatch.id}).`,
        urgency: 'low'
      });
    } catch (err) {
      console.error('[App] Failed to save product:', err);
      addNotification({
        type: 'system',
        title: 'Product Save Failed',
        message: 'Could not synchronize product to catalog or inventory database.',
        urgency: 'high'
      });
      throw err;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await productRepository.delete(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));

      // Also clean up linked retail inventory lot for accountability
      setBatches(prev => {
        const linked = prev.find(b => b.linkedProductId === productId);
        if (linked) {
          if (linked.isRetailCutLot) {
            batchRepository.delete(linked.id).catch(err => console.warn(err));
            return prev.filter(b => b.id !== linked.id);
          } else {
            const unlinked = { ...linked, linkedProductId: undefined, isRetailCutLot: false };
            batchRepository.save(unlinked, false).catch(err => console.warn(err));
            return prev.map(b => b.id === linked.id ? unlinked : b);
          }
        }
        return prev;
      });

      addNotification({
        type: 'order_update',
        title: 'Product Removed',
        message: 'Product removed from catalog and inventory accountability.',
        urgency: 'low'
      });
    } catch (err) {
      console.error('[App] Failed to delete product:', err);
    }
  };

  const handleReconcileCatalog = () => {
    const { updatedBatches, newLots } = reconcileCatalogWithInventory(products, batches);
    if (newLots.length > 0) {
      setBatches(updatedBatches);
      newLots.forEach(lot => {
        batchRepository.save(lot, true).catch(err => console.warn(err));
      });
      addNotification({
        type: 'order_update',
        title: 'Catalog Synchronized with Inventory',
        message: `Registered ${newLots.length} new inventory lot(s) for catalog products into cold storage.`,
        urgency: 'low'
      });
    } else {
      addNotification({
        type: 'system',
        title: 'All Products Synchronized',
        message: `All ${products.length} catalog products already have active physical lots in the Inventory Ledger.`,
        urgency: 'low'
      });
    }
  };

  // Universal Payment & Settle Ledger Handler (AR / AP)
  const handleRecordPayment = (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => {
    if (type === 'AR') {
      // Customer paid receivable
      setCustomers(prev => prev.map(cust => {
        if (cust.id === entityId) {
          const newBal = Math.max(0, cust.outstandingBalanceUSD - amount);
          customerRepository.updateFinancials(cust.id, newBal, cust.totalSpendUSD, cust.totalOrdersCount).catch(err => {
            console.warn('[App] customerRepository updateFinancials on AR settlement failed:', err);
          });
          return {
            ...cust,
            outstandingBalanceUSD: newBal
          };
        }
        return cust;
      }));

      // Update Order payment status if order ID passed
      setOrders(prev => prev.map(o => {
        if (o.id === refId || o.clientName.toLowerCase().includes(entityId.toLowerCase())) {
          const updated = { ...o, paymentStatus: 'Paid' as const };
          orderRepository.save(updated).catch(err => {
            console.warn('[App] orderRepository save on AR payment failed:', err);
          });
          return updated;
        }
        return o;
      }));

      // Log Financial Settlement Entry
      const cust = customers.find(c => c.id === entityId);
      const newEntry: FinancialLedgerEntry = {
        id: `FIN-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: `Customer AR Settlement Received - ${cust?.name || entityId}`,
        referenceId: `PMT-AR-${refId}`,
        entityName: cust?.name || 'Customer Account',
        amount: amount,
        paymentMethod: 'Bank Wire Transfer',
        status: 'Settled'
      };
      setFinancialEntries(prev => [newEntry, ...prev]);
      financialRepository.addEntry(newEntry).catch(err => {
        console.warn('[App] financialRepository addEntry error for AR settlement:', err);
      });

      addNotification({
        type: 'order_update',
        title: `AR Payment Collected: ${formatAppCurrency(amount)}`,
        message: `Receivable posted to ledger for ${cust?.name || entityId}.`,
        urgency: 'low'
      });
    } else {
      // Settle AP Supplier Bill
      setSuppliers(prev => prev.map(sup => {
        if (sup.id === entityId) {
          const updatedSup: Supplier = {
            ...sup,
            outstandingPayableUSD: Math.max(0, sup.outstandingPayableUSD - amount)
          };
          supplierRepository.save(updatedSup, false).catch(err => {
            console.warn('[App] supplierRepository save on AP settlement failed:', err);
          });
          return updatedSup;
        }
        return sup;
      }));

      // Update PO payment status
      setPurchaseOrders(prev => prev.map(po => {
        if (po.supplierId === entityId || po.id === refId) {
          return { ...po, paymentStatus: 'Paid in Full' };
        }
        return po;
      }));

      const sup = suppliers.find(s => s.id === entityId);
      const newEntry: FinancialLedgerEntry = {
        id: `FIN-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'COGS',
        category: 'COGS (Catch Intake)',
        description: `Harvester AP Bill Settled - ${sup?.name || entityId}`,
        referenceId: `PMT-AP-${refId}`,
        entityName: sup?.name || 'Harvester Co-op',
        amount: amount,
        paymentMethod: 'Direct Wire Disbursement',
        status: 'Settled'
      };
      setFinancialEntries(prev => [newEntry, ...prev]);
      financialRepository.addEntry(newEntry).catch(err => {
        console.warn('[App] financialRepository addEntry error for AP settlement:', err);
      });

      addNotification({
        type: 'order_update',
        title: `Harvester Payout Disbursed: ${formatAppCurrency(amount)}`,
        message: `Settlement wire completed for ${sup?.name || entityId}.`,
        urgency: 'low'
      });
    }
  };

  // Custom Expense Handler
  const handleAddExpense = (expense: Omit<FinancialLedgerEntry, 'id'>) => {
    const newEntry: FinancialLedgerEntry = {
      ...expense,
      id: `EXP-${Date.now().toString().slice(-4)}`
    };
    setFinancialEntries(prev => [newEntry, ...prev]);
    financialRepository.addEntry(newEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for expense:', err);
    });
    addNotification({
      type: 'order_update',
      title: `Expense Logged: ${formatAppCurrency(expense.amount)}`,
      message: `${expense.category} - ${expense.description}`,
      urgency: 'low'
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Offline Status & PWA Banner */}
      <PWAStatusBanner
        isOnline={isOnline}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />

      {/* Navigation & Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNavigateToSettingsTab={handleNavigateToSettingsCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        useImperial={useImperial}
        setUseImperial={setUseImperial}
        notifications={notifications}
        markNotificationRead={markNotificationRead}
        onOpenNewBatchModal={() => setIsNewBatchModalOpen(true)}
        onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
        activeAlertCount={0}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isOnline={isOnline}
        onSignOut={handleSignOut}
        isAuthenticated={Boolean(currentUser)}
        userRole={showPlatformConsole ? 'Platform Creator' : (staffProfile?.role ?? (currentUser ? 'Staff' : null))}
        userEmail={currentUser?.email ?? null}
        showPlatformConsole={showPlatformConsole}
        companyName={companyName}
      />

      {/* Trial and Days Count Status Banner */}
      <TrialCountdownBanner
        organization={staffProfile?.organization}
        onUpgradeClick={() => {
          setActiveTab('settings');
          setSettingsCategory('subscription');
        }}
      />

      {/* Organization Licensing & Grace Period Status Alert Bar */}
      {isSubscriptionPastDue(staffProfile?.organization) && (
        <div id="app-past-due-banner" className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between shadow-xs z-30">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider bg-amber-950/20 px-2 py-0.5 rounded text-[10px]">
                HACCP Audit Mode
              </span>
              <span>
                Organization subscription payment is past due. Full read-only compliance access is active; write operations are paused.
              </span>
            </div>
            <button
              id="banner-resolve-billing-btn"
              onClick={() => setActiveTab('settings')}
              className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 text-xs font-bold rounded-lg transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              Resolve Billing
            </button>
          </div>
        </div>
      )}

      {isSubscriptionLockedOut(staffProfile?.organization) && (
        <div id="app-suspended-banner" className="bg-rose-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shadow-xs z-30">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider bg-rose-950/30 px-2 py-0.5 rounded text-[10px]">
                Subscription Locked
              </span>
              <span>
                Organization evaluation period or subscription has expired. Please activate a plan to restore workspace access.
              </span>
            </div>
            <button
              id="banner-upgrade-plan-btn"
              onClick={() => setActiveTab('settings')}
              className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-lg transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - with mobile bottom safe area padding */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            batches={batches}
            orders={orders}
            customers={customers}
            suppliers={suppliers}
            products={products}
            retailSales={retailSales}
            purchaseOrders={purchaseOrders}
            financialEntries={financialEntries}
            onSelectTab={setActiveTab}
            onOpenPassport={(b) => setPassportBatch(b)}
            onOpenNewBatch={() => setIsNewBatchModalOpen(true)}
            onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
            useImperial={useImperial}
            companyName={companyName}
          />
        )}

        {activeTab === 'retail_wholesale' && (
          <RetailWholesaleView
            products={products}
            retailSales={retailSales}
            wholesaleOrders={orders}
            customers={customers}
            batches={batches}
            onCompleteRetailSale={handleCompleteRetailSale}
            onOpenNewWholesaleOrder={() => setIsNewOrderModalOpen(true)}
            onOpenWeigher={(o) => setWeigherOrder(o)}
            onOpenInvoice={(o) => setInvoiceOrder(o)}
            onUpdateProductPricing={handleUpdateProductPricing}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onNavigateToInventory={() => setActiveTab('inventory')}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            orders={orders}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onSelectCustomerForOrder={handleSelectCustomerForOrder}
            onRecordPayment={handleRecordPayment}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            onAddSupplier={handleAddSupplier}
            onAddPurchaseOrder={handleAddPurchaseOrder}
            onRecordPayment={handleRecordPayment}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'financials' && (
          <FinancialsView
            orders={orders}
            purchaseOrders={purchaseOrders}
            retailSales={retailSales}
            customers={customers}
            suppliers={suppliers}
            financialEntries={financialEntries}
            onRecordPayment={handleRecordPayment}
            onAddExpense={handleAddExpense}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryLedgerView
            batches={batches}
            products={products}
            onOpenPassport={(b) => setPassportBatch(b)}
            onOpenNewBatch={() => setIsNewBatchModalOpen(true)}
            onUpdateBatch={handleUpdateBatch}
            onNavigateToRetail={() => setActiveTab('retail_wholesale')}
            onReconcileCatalog={handleReconcileCatalog}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            useImperial={useImperial}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            initialCategory={settingsCategory}
            batches={batches}
            orders={orders}
            customers={customers}
            suppliers={suppliers}
            products={products}
            retailSales={retailSales}
            purchaseOrders={purchaseOrders}
            financialEntries={financialEntries}
            staffProfile={staffProfile}
            onRefreshProfile={handleRefreshProfile}
            showPlatformConsole={showPlatformConsole}
            onOpenOnboardingWizard={() => setIsOnboardingModalOpen(true)}
            onRestoreAllData={handleRestoreAllData}
            onResetToDefaults={handleResetToDefaults}
          />
        )}

        {activeTab === 'platform' && showPlatformConsole && (
          <PlatformConsoleView onClose={() => setActiveTab('dashboard')} />
        )}
      </main>

      {/* Modals */}
      {isOnboardingModalOpen && (
        <TenantOnboardingScreen
          user={currentUser || ({ id: 'local-admin', email: staffProfile?.email || 'admin@frostly.io', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } as any)}
          isModal={true}
          onClose={() => setIsOnboardingModalOpen(false)}
          onCompleted={async () => {
            setIsOnboardingModalOpen(false);
            if (handleRefreshProfile) await handleRefreshProfile();
            // Ensure newly created workspace immediately resets to clean state
            setBatches([]);
            setOrders([]);
            setCustomers([]);
            setSuppliers([]);
            setProducts([]);
            setRetailSales([]);
            setPurchaseOrders([]);
            setFinancialEntries([]);
            setNotifications([]);
            try {
              const savedStr = localStorage.getItem('frostly_settings_v2');
              if (savedStr) {
                const parsed = JSON.parse(savedStr);
                setSettings(prev => ({
                  ...prev,
                  companyName: parsed.companyName || prev.companyName,
                  currency: parsed.currency || prev.currency,
                  primaryPort: parsed.primaryPort || prev.primaryPort,
                  commercialFreezeMaxAlertC: parsed.commercialFreezeMaxAlertC ?? prev.commercialFreezeMaxAlertC
                }));
              }
            } catch {}
          }}
        />
      )}
      {passportBatch && (
        <TraceabilityPassportModal
          batch={passportBatch}
          onClose={() => setPassportBatch(null)}
          useImperial={useImperial}
        />
      )}

      {weigherOrder && (
        <CatchWeightWeigherModal
          order={weigherOrder}
          batches={batches}
          onClose={() => setWeigherOrder(null)}
          onSaveWeighedItems={handleSaveWeighedItems}
          useImperial={useImperial}
        />
      )}

      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          customers={customers}
          onClose={() => setInvoiceOrder(null)}
          useImperial={useImperial}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
          onRecordPayment={handleRecordPayment}
        />
      )}

      {isNewBatchModalOpen && (
        <NewBatchModal
          onClose={() => setIsNewBatchModalOpen(false)}
          onAddBatch={handleAddBatch}
          useImperial={useImperial}
        />
      )}

      {isNewOrderModalOpen && (
        <NewOrderModal
          batches={batches}
          customers={customers}
          preselectedCustomerId={preselectedCustomerId}
          onClose={() => {
            setIsNewOrderModalOpen(false);
            setPreselectedCustomerId(null);
          }}
          onAddOrder={handleAddOrder}
          useImperial={useImperial}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={0}
      />

      {/* PWA Cross-Platform Install Modal */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onInstall={triggerInstall}
        isIOS={isIOS}
        isInstallable={isInstallable}
        isStandalone={isStandalone}
      />

      {/* Legal Footer */}
      <LegalFooter
        onOpenPrivacy={() => setLegalModal({ isOpen: true, type: 'privacy' })}
        onOpenTerms={() => setLegalModal({ isOpen: true, type: 'terms' })}
        onOpenSitemap={() => setLegalModal({ isOpen: true, type: 'sitemap' })}
      />

      {/* Privacy Policy, Terms, and Sitemap Dialog Modal */}
      <LegalModal
        isOpen={legalModal.isOpen}
        type={legalModal.type}
        onClose={() => setLegalModal(prev => ({ ...prev, isOpen: false }))}
        onSwitchType={(type) => setLegalModal({ isOpen: true, type })}
      />
    </div>
  );
}
