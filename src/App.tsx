import React, { useState, useEffect, useRef } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
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
import { EditOrderModal } from './components/Modals/EditOrderModal';
import { EditQuoteModal } from './components/Modals/EditQuoteModal';
import { DeleteOrderModal } from './components/Modals/DeleteOrderModal';
import { RecordExpenseModal } from './components/Modals/RecordExpenseModal';
import { TenantOnboardingScreen } from './components/TenantOnboardingScreen';
import { DeleteBatchOptions } from './components/Inventory/DeleteBatchModal';

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
  INITIAL_ADJUSTMENT_ACCOUNTS,
  INITIAL_STOCK_ADJUSTMENTS,
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
  OrderLineItem,
  PaymentStatus,
  AppSettings,
  DEFAULT_SETTINGS,
  StorageZone,
  InventoryAdjustmentAccount,
  InventoryStockAdjustment,
  CustomerStatus,
  SupplierStatus,
  SeafoodCutType
} from './types';
import { formatCurrency } from './utils/formatters';
import { getSpeciesIdFromName, getSpeciesTaxonomy } from './utils/speciesHelper';
import { isOrderActive, isOrderPaid } from './utils/financialMetrics';
import {
  applyOrderAllocationDeltas,
  applyRetailSaleStockDeductions,
  computeOrderCustomerFinancialDelta,
  doesBatchMatchProduct,
  validateOrderLotAvailability,
} from './utils/inventorySync';
import { batchRepository } from './repositories/batchRepository';
import { customerRepository } from './repositories/customerRepository';
import { orderRepository } from './repositories/orderRepository';
import { supplierRepository } from './repositories/supplierRepository';
import {
  financialRepository,
  isReversalLedgerEntry,
  isInventoryAdjustmentLedgerEntry,
} from './repositories/financialRepository';
import { purchaseOrderRepository } from './repositories/purchaseOrderRepository';
import { productRepository, retailTransactionRepository } from './repositories/retailRepository';
import { settingsRepository } from './repositories/settingsRepository';
import { notificationRepository } from './repositories/notificationRepository';
import { adjustmentAccountRepository, stockAdjustmentRepository } from './repositories/adjustmentRepository';
import { StockAdjustmentData } from './components/Inventory/StockAdjustmentModal';
import { syncManager } from './sync/syncManager';
import { useAuth } from './components/AuthGate';
import { 
  signInAsTestUser, 
  StaffProfile,
  isSubscriptionPastDue,
  isSubscriptionLockedOut
} from './data/auth';
import { User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './utils/supabase';

export default function App() {
  // Single authoritative source of truth for session and staff profile from AuthGate
  const { session, user: currentUser, staffProfile, refreshProfile: handleRefreshProfile, signOut: handleSignOut } = useAuth();

  const isSentinelFallbackOrg = 
    staffProfile?.organization_id === 'org-frostly-hq' ||
    staffProfile?.organization_id === '00000000-0000-0000-0000-000000000000';

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
      if (tabParam && ['dashboard', 'orders', 'retail_wholesale', 'customers', 'suppliers', 'financials', 'inventory', 'settings', 'platform'].includes(tabParam)) {
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

  // Track feature usage telemetry across user workspace navigations
  useEffect(() => {
    const tabFeatureMap: Record<string, string> = {
      dashboard: 'cold_room_telemetry',
      inventory: 'catch_inward',
      retail_wholesale: 'sales_orders',
      customers: 'customers_clients',
      suppliers: 'suppliers_vessels',
      financials: 'financial_ledger',
      settings: 'settings_permissions',
      platform: 'platform_console',
    };
    const featureKey = tabFeatureMap[activeTab] || activeTab;
    import('./services/activityTrackingService').then(({ trackFeatureAction }) => {
      trackFeatureAction(featureKey, 'view', { tab: activeTab }).catch(() => {});
    }).catch(() => {});
  }, [activeTab]);

  // Safe tenant-scoped inventory state: when Supabase is configured, hydrate strictly from Supabase inventory_batches
  const [batches, setBatches] = useState<InventoryBatch[]>(() => {
    try {
      if (isSupabaseConfigured) {
        return [];
      }
      if (activeOrgId) {
        return batchRepository.getLocalCache([], activeOrgId);
      }
      return batchRepository.getLocalCache(INITIAL_BATCHES);
    } catch {
      return (isSupabaseConfigured || activeOrgId) ? [] : INITIAL_BATCHES;
    }
  });

  const [isBatchesHydrated, setIsBatchesHydrated] = useState<boolean>(false);
  const [isProductsHydrated, setIsProductsHydrated] = useState<boolean>(false);

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
      if (isSupabaseConfigured) {
        return [];
      }
      if (activeOrgId) {
        return productRepository.getLocalCache([], activeOrgId);
      }
      return productRepository.getLocalCache(INITIAL_PRODUCTS);
    } catch {
      return (isSupabaseConfigured || activeOrgId) ? [] : INITIAL_PRODUCTS;
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

  const [adjustmentAccounts, setAdjustmentAccounts] = useState<InventoryAdjustmentAccount[]>(() => {
    try {
      if (activeOrgId) {
        return adjustmentAccountRepository.getLocalCache([], activeOrgId);
      }
      return adjustmentAccountRepository.getLocalCache(INITIAL_ADJUSTMENT_ACCOUNTS);
    } catch {
      return activeOrgId ? [] : INITIAL_ADJUSTMENT_ACCOUNTS;
    }
  });

  const [stockAdjustments, setStockAdjustments] = useState<InventoryStockAdjustment[]>(() => {
    try {
      if (activeOrgId) {
        return stockAdjustmentRepository.getLocalCache([], activeOrgId);
      }
      return stockAdjustmentRepository.getLocalCache(INITIAL_STOCK_ADJUSTMENTS);
    } catch {
      return activeOrgId ? [] : INITIAL_STOCK_ADJUSTMENTS;
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
  const [editingOrder, setEditingOrder] = useState<ClientOrder | null>(null);
  const [editingQuoteOrder, setEditingQuoteOrder] = useState<ClientOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<ClientOrder | null>(null);
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isRecordExpenseModalOpen, setIsRecordExpenseModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);
  const [settingsCategory, setSettingsCategory] = useState<'profile' | 'workers' | 'subscription' | 'platform' | 'coldchain' | 'units' | 'fulfillment' | 'pricing' | 'alerts' | 'data'>('profile');

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

  /**
   * Deduplicates inventory batches in-memory by primary key ID to prevent duplicate items.
   * Never issues destructive deletes against the database for real inventory lots.
   */
  const deduplicateBatches = (rawBatches: InventoryBatch[]): InventoryBatch[] => {
    const seenIds = new Set<string>();
    const deduplicated: InventoryBatch[] = [];

    for (const batch of rawBatches) {
      if (!batch || !batch.id) continue;
      if (!seenIds.has(batch.id)) {
        seenIds.add(batch.id);
        deduplicated.push(batch);
      }
    }

    return deduplicated;
  };

  // Hydrate batches and workspace data from repository on mount and when authenticated session or active tenant changes
  useEffect(() => {
    let isMounted = true;
    const currentOrgId = staffProfile?.organization_id;
    const fallbackList = (isSupabaseConfigured || isTenantUser) ? [] : undefined;

    batchRepository.getBatches(fallbackList).then(fresh => {
      if (isMounted) {
        const deduplicated = deduplicateBatches(fresh || []);
        setBatches(deduplicated);
        setIsBatchesHydrated(true);
      }
      // Drains offline sync queue immediately if network and session are active, then re-verify live inventory against Supabase
      syncManager.flushAll()
        .then(async () => {
          if (!isMounted || !isSupabaseConfigured) return;
          const liveBatches = await batchRepository.getBatches([]);
          if (isMounted) {
            setBatches(deduplicateBatches(liveBatches || []));
          }
        })
        .catch(console.warn);
    }).catch(err => {
      console.warn('[App] Batch repository load error:', err);
      if (isMounted) {
        setIsBatchesHydrated(true);
      }
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

    adjustmentAccountRepository.getAccounts(INITIAL_ADJUSTMENT_ACCOUNTS).then(fresh => {
      if (isMounted) {
        setAdjustmentAccounts(fresh && fresh.length > 0 ? fresh : INITIAL_ADJUSTMENT_ACCOUNTS);
      }
    }).catch(err => {
      console.warn('[App] Adjustment account repository load error:', err);
    });

    stockAdjustmentRepository.getAdjustments(INITIAL_STOCK_ADJUSTMENTS).then(fresh => {
      if (isMounted) {
        setStockAdjustments(fresh || []);
      }
    }).catch(err => {
      console.warn('[App] Stock adjustment repository load error:', err);
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
        setIsProductsHydrated(true);
      }
    }).catch(err => {
      console.warn('[App] Product repository load error:', err);
      if (isMounted) {
        setIsProductsHydrated(true);
      }
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
    if (isBatchesHydrated) {
      batchRepository.setLocalCache(batches, staffProfile?.organization_id);
    }
  }, [batches, isBatchesHydrated, staffProfile?.organization_id]);

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
    adjustmentAccountRepository.setLocalCache(adjustmentAccounts, staffProfile?.organization_id);
  }, [adjustmentAccounts, staffProfile?.organization_id]);

  useEffect(() => {
    stockAdjustmentRepository.setLocalCache(stockAdjustments, staffProfile?.organization_id);
  }, [stockAdjustments, staffProfile?.organization_id]);

  useEffect(() => {
    settingsRepository.setLocalCache(settings, staffProfile?.organization_id);
  }, [settings, staffProfile?.organization_id]);

  // Helper to reconcile Dual-Price & Retail catalog products with cold-chain inventory lots bidirectionally with strict 1:1 parity
  const reconcileCatalogWithInventory = (
    currentProducts: RetailWholesaleProduct[],
    currentBatches: InventoryBatch[]
  ): { 
    updatedBatches: InventoryBatch[]; 
    updatedProducts: RetailWholesaleProduct[];
    newLots: InventoryBatch[]; 
    newProducts: RetailWholesaleProduct[];
  } => {
    let workingBatches = [...(currentBatches || [])];
    let workingProducts = [...(currentProducts || [])];
    const newLots: InventoryBatch[] = [];
    const newProducts: RetailWholesaleProduct[] = [];

    const matchedProductIds = new Set<string>();
    const matchedBatchIds = new Set<string>();

    // 1. Direct authoritative matching (by explicit links, deterministic IDs, or identical SKU)
    for (const batch of workingBatches) {
      const batchSkuClean = (batch.productSku || '').toLowerCase().trim();
      const detBatchId = `LOT-RET-${(batch.productSku || batch.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

      const matchedProduct = workingProducts.find(p => {
        if (matchedProductIds.has(p.id)) return false;
        const prodSkuClean = (p.sku || '').toLowerCase().trim();
        const detProdBatchId = `LOT-RET-${(p.sku || p.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

        return (
          (p.linkedBatchId && p.linkedBatchId === batch.id) ||
          (batch.linkedProductId && batch.linkedProductId === p.id) ||
          (batchSkuClean && prodSkuClean && batchSkuClean === prodSkuClean) ||
          batch.id === detProdBatchId ||
          batch.id === `LOT-RET-${p.id.replace('prod-', '')}` ||
          batch.id === `LOT-RET-${p.id}` ||
          p.id === `prod-${batch.id}`
        );
      });

      if (matchedProduct) {
        matchedProductIds.add(matchedProduct.id);
        matchedBatchIds.add(batch.id);

        matchedProduct.linkedBatchId = batch.id;
        batch.linkedProductId = matchedProduct.id;
        batch.productSku = matchedProduct.sku;

        if (Math.abs((matchedProduct.stockKg || 0) - (batch.availableWeightKg || 0)) > 0.05) {
          matchedProduct.stockKg = Number(batch.availableWeightKg) || 0;
        }
        if (batch.wholesalePricePerKg > 0 && Math.abs((matchedProduct.wholesalePricePerUnit || 0) - (batch.wholesalePricePerKg || 0)) > 0.05) {
          matchedProduct.wholesalePricePerUnit = batch.wholesalePricePerKg;
        }
        if (batch.costPerKg > 0 && Math.abs((matchedProduct.costPricePerUnit || 0) - (batch.costPerKg || 0)) > 0.05) {
          matchedProduct.costPricePerUnit = batch.costPerKg;
        }
      }
    }

    // 2. Secondary 1-to-1 matching for unlinked items with same species and grade
    for (const batch of workingBatches) {
      if (matchedBatchIds.has(batch.id)) continue;

      const matchedProduct = workingProducts.find(p => {
        if (matchedProductIds.has(p.id)) return false;
        return p.speciesId === batch.speciesId && p.grade === batch.grade;
      });

      if (matchedProduct) {
        matchedProductIds.add(matchedProduct.id);
        matchedBatchIds.add(batch.id);

        matchedProduct.linkedBatchId = batch.id;
        batch.linkedProductId = matchedProduct.id;
        batch.productSku = matchedProduct.sku;

        if (Math.abs((matchedProduct.stockKg || 0) - (batch.availableWeightKg || 0)) > 0.05) {
          matchedProduct.stockKg = Number(batch.availableWeightKg) || 0;
        }
        if (batch.wholesalePricePerKg > 0 && Math.abs((matchedProduct.wholesalePricePerUnit || 0) - (batch.wholesalePricePerKg || 0)) > 0.05) {
          matchedProduct.wholesalePricePerUnit = batch.wholesalePricePerKg;
        }
        if (batch.costPerKg > 0 && Math.abs((matchedProduct.costPricePerUnit || 0) - (batch.costPerKg || 0)) > 0.05) {
          matchedProduct.costPricePerUnit = batch.costPerKg;
        }
      }
    }

    // 3. For every remaining unlinked batch, create a dedicated 1-to-1 Dual Price Product
    for (const batch of workingBatches) {
      if (matchedBatchIds.has(batch.id)) continue;

      const matchedSpecies = SPECIES_CATALOG.find(s => s.id === batch.speciesId || s.name === batch.speciesName);
      const resolvedSpeciesId = batch.speciesId || matchedSpecies?.id || getSpeciesIdFromName(batch.speciesName);

      let cutType: SeafoodCutType = 'Whole Round Fish';
      if (batch.storageZone?.includes('Live')) {
        cutType = 'Live in Oxygen Tank';
      } else if (batch.grade === 'Sashimi AAA' || batch.storageZone?.includes('-60')) {
        cutType = 'Skinless Sashimi Saku Block';
      } else if (batch.category === 'Crustacean') {
        cutType = 'Packaged 500g Tray';
      } else {
        cutType = 'Skin-On Loin / Fillet';
      }

      const sku = batch.productSku || (batch.id.startsWith('LOT-RET-') ? batch.id.replace('LOT-RET-', '') : `SKU-${batch.id}`);
      const costPrice = Number(batch.costPerKg) || 0;
      const wholesalePrice = Number(batch.wholesalePricePerKg) || (costPrice > 0 ? Number((costPrice * 1.35).toFixed(2)) : 35.0);
      const retailPrice = Number((wholesalePrice * 1.30).toFixed(2));

      const newProd: RetailWholesaleProduct = {
        id: `prod-${batch.id}`,
        speciesId: resolvedSpeciesId,
        name: batch.speciesName,
        cutType: cutType,
        category: batch.category,
        grade: batch.grade,
        stockKg: Number(batch.availableWeightKg) || 0,
        unit: 'kg',
        costPricePerUnit: costPrice,
        wholesalePricePerUnit: wholesalePrice,
        retailPricePerUnit: retailPrice,
        wholesaleMinQty: 10,
        retailPackSize: '1.0 kg fresh pack',
        sku: sku,
        imageUrl: matchedSpecies?.image || 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80',
        origin: batch.landingPort || batch.coordinates?.description || 'Certified Cold Storage Vault',
        isAvailableForRetail: true,
        isAvailableForWholesale: true,
        linkedBatchId: batch.id,
        storageZone: batch.storageZone,
        minSafetyStockKg: 20
      };

      newProducts.push(newProd);
      workingProducts.push(newProd);
      matchedProductIds.add(newProd.id);
      matchedBatchIds.add(batch.id);

      batch.linkedProductId = newProd.id;
      batch.productSku = newProd.sku;
    }

    // 4. For every remaining unlinked product, create a dedicated 1-to-1 Cold Storage Lot
    for (const product of workingProducts) {
      if (matchedProductIds.has(product.id)) continue;

      const matchedSpecies = SPECIES_CATALOG.find(s => s.id === product.speciesId);
      const deterministicBatchId = `LOT-RET-${(product.sku || product.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

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
        id: deterministicBatchId,
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
        initialWeightKg: Math.max(1.0, Number(product.stockKg) || 1.0),
        availableWeightKg: Math.max(0, Number(product.stockKg) || 0),
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
      workingBatches.push(newLot);
      matchedBatchIds.add(newLot.id);
      matchedProductIds.add(product.id);
      product.linkedBatchId = newLot.id;
    }

    return { 
      updatedBatches: workingBatches, 
      updatedProducts: workingProducts, 
      newLots, 
      newProducts 
    };
  };

  // Sync metadata/weights/prices only between ALREADY-EXISTING Supabase batches and products without inventing phantom items
  const syncExistingLinkedInventoryAndProducts = (
    currentProducts: RetailWholesaleProduct[],
    currentBatches: InventoryBatch[]
  ): {
    updatedProducts: RetailWholesaleProduct[];
    updatedBatches: InventoryBatch[];
    changedProducts: RetailWholesaleProduct[];
    changedBatches: InventoryBatch[];
  } => {
    const workingBatches = currentBatches.map(b => ({ ...b }));
    const workingProducts = currentProducts.map(p => ({ ...p }));
    const matchedProductIds = new Set<string>();
    const matchedBatchIds = new Set<string>();
    const changedProducts: RetailWholesaleProduct[] = [];
    const changedBatches: InventoryBatch[] = [];

    const tryPair = (batch: InventoryBatch, matchedProduct: RetailWholesaleProduct) => {
      matchedProductIds.add(matchedProduct.id);
      matchedBatchIds.add(batch.id);

      let prodChanged = false;
      let batchChanged = false;

      if (matchedProduct.linkedBatchId !== batch.id) {
        matchedProduct.linkedBatchId = batch.id;
        prodChanged = true;
      }
      if (batch.linkedProductId !== matchedProduct.id) {
        batch.linkedProductId = matchedProduct.id;
        batchChanged = true;
      }
      if (matchedProduct.sku && batch.productSku !== matchedProduct.sku) {
        batch.productSku = matchedProduct.sku;
        batchChanged = true;
      }
      if (Math.abs((matchedProduct.stockKg || 0) - (batch.availableWeightKg || 0)) > 0.05) {
        matchedProduct.stockKg = Number(batch.availableWeightKg) || 0;
        prodChanged = true;
      }
      if (batch.wholesalePricePerKg > 0 && Math.abs((matchedProduct.wholesalePricePerUnit || 0) - (batch.wholesalePricePerKg || 0)) > 0.05) {
        matchedProduct.wholesalePricePerUnit = batch.wholesalePricePerKg;
        prodChanged = true;
      }
      if (batch.costPerKg > 0 && Math.abs((matchedProduct.costPricePerUnit || 0) - (batch.costPerKg || 0)) > 0.05) {
        matchedProduct.costPricePerUnit = batch.costPerKg;
        prodChanged = true;
      }

      if (prodChanged) changedProducts.push(matchedProduct);
      if (batchChanged) changedBatches.push(batch);
    };

    for (const batch of workingBatches) {
      const batchSkuClean = (batch.productSku || '').toLowerCase().trim();
      const matchedProduct = workingProducts.find(p => {
        if (matchedProductIds.has(p.id)) return false;
        const prodSkuClean = (p.sku || '').toLowerCase().trim();
        const detProdBatchId = `LOT-RET-${(p.sku || p.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;
        return (
          (p.linkedBatchId && p.linkedBatchId === batch.id) ||
          (batch.linkedProductId && batch.linkedProductId === p.id) ||
          (batchSkuClean && prodSkuClean && batchSkuClean === prodSkuClean) ||
          batch.id === detProdBatchId ||
          batch.id === `LOT-RET-${p.id.replace('prod-', '')}` ||
          batch.id === `LOT-RET-${p.id}` ||
          p.id === `prod-${batch.id}`
        );
      });
      if (matchedProduct) tryPair(batch, matchedProduct);
    }

    for (const batch of workingBatches) {
      if (matchedBatchIds.has(batch.id)) continue;
      const matchedProduct = workingProducts.find(
        p => !matchedProductIds.has(p.id) && p.speciesId === batch.speciesId && p.grade === batch.grade
      );
      if (matchedProduct) tryPair(batch, matchedProduct);
    }

    return { updatedProducts: workingProducts, updatedBatches: workingBatches, changedProducts, changedBatches };
  };

  const lastLinkSyncKeyRef = useRef<string>('');

  useEffect(() => {
    if (!isBatchesHydrated || !isProductsHydrated) return;

    const currentKey = `${batches.length}_${products.length}`;
    if (lastLinkSyncKeyRef.current !== currentKey) {
      lastLinkSyncKeyRef.current = currentKey;
      const { updatedProducts, updatedBatches, changedProducts, changedBatches } =
        syncExistingLinkedInventoryAndProducts(products, batches);

      if (changedProducts.length > 0) {
        setProducts(updatedProducts);
        changedProducts.forEach(prod => {
          productRepository.save(prod, false).catch(err => {
            console.warn('[App] productRepository link sync save error:', err);
          });
        });
      }
      if (changedBatches.length > 0) {
        setBatches(updatedBatches);
        changedBatches.forEach(batch => {
          batchRepository.save(batch, false).catch(err => {
            console.warn('[App] batchRepository link sync save error:', err);
          });
        });
      }
    }
  }, [products, isBatchesHydrated, isProductsHydrated, batches]);

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
    const matchedSpecies = SPECIES_CATALOG.find(s => s.id === newBatch.speciesId || s.name === newBatch.speciesName);
    const resolvedSpeciesId = newBatch.speciesId || matchedSpecies?.id || getSpeciesIdFromName(newBatch.speciesName);

    let cutType: SeafoodCutType = 'Whole Round Fish';
    if (newBatch.storageZone?.includes('Live')) {
      cutType = 'Live in Oxygen Tank';
    } else if (newBatch.grade === 'Sashimi AAA' || newBatch.storageZone?.includes('-60')) {
      cutType = 'Skinless Sashimi Saku Block';
    } else if (newBatch.category === 'Crustacean') {
      cutType = 'Packaged 500g Tray';
    } else {
      cutType = 'Skin-On Loin / Fillet';
    }

    const sku = newBatch.productSku || (newBatch.id.startsWith('LOT-RET-') ? newBatch.id.replace('LOT-RET-', '') : `SKU-${newBatch.id}`);
    const costPrice = Number(newBatch.costPerKg) || 0;
    const wholesalePrice = Number(newBatch.wholesalePricePerKg) || (costPrice > 0 ? Number((costPrice * 1.35).toFixed(2)) : 35.0);
    const retailPrice = Number((wholesalePrice * 1.30).toFixed(2));

    const newProd: RetailWholesaleProduct = {
      id: `prod-${newBatch.id}`,
      speciesId: resolvedSpeciesId,
      name: newBatch.speciesName,
      cutType: cutType,
      category: newBatch.category,
      grade: newBatch.grade,
      stockKg: Number(newBatch.availableWeightKg) || 0,
      unit: 'kg',
      costPricePerUnit: costPrice,
      wholesalePricePerUnit: wholesalePrice,
      retailPricePerUnit: retailPrice,
      wholesaleMinQty: 10,
      retailPackSize: '1.0 kg fresh pack',
      sku: sku,
      imageUrl: matchedSpecies?.image || 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80',
      origin: newBatch.landingPort || newBatch.coordinates?.description || 'Certified Cold Storage Vault',
      isAvailableForRetail: true,
      isAvailableForWholesale: true,
      linkedBatchId: newBatch.id,
      storageZone: newBatch.storageZone,
      minSafetyStockKg: 20
    };

    const batchToSave: InventoryBatch = {
      ...newBatch,
      linkedProductId: newProd.id,
      productSku: newProd.sku,
      wholesalePricePerKg: wholesalePrice
    };

    setBatches(prev => [batchToSave, ...prev]);
    setProducts(prev => [newProd, ...prev]);

    batchRepository.save(batchToSave, true).catch(err => {
      console.warn('[App] batchRepository save error:', err);
    });
    productRepository.save(newProd, true).catch(err => {
      console.warn('[App] productRepository save error:', err);
    });

    addNotification({
      type: 'catch_landed',
      title: `Intake Complete: ${newBatch.speciesName}`,
      message: `Lot ${newBatch.id} (${newBatch.availableWeightKg} kg) placed in ${newBatch.storageZone} and registered in Dual Price Book.`,
      urgency: 'medium'
    });
  };

  // Update Batch Handler (Stock Adjustment / Audit / Calibration)
  const handleUpdateBatch = (updatedBatch: InventoryBatch, adjustmentData?: StockAdjustmentData) => {
    setBatches(prev => prev.map(b => b.id === updatedBatch.id ? updatedBatch : b));
    batchRepository.save(updatedBatch, false).catch(err => {
      console.warn('[App] batchRepository save error on update:', err);
    });

    // Synchronize matching product in Dual Price Book in lockstep
    const productSkuClean = (updatedBatch.productSku || '').toLowerCase().trim();
    setProducts(prev => prev.map(p => {
      const prodSkuClean = (p.sku || '').toLowerCase().trim();
      const detBatchId = `LOT-RET-${(p.sku || p.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;
      const isMatch = (
        (p.linkedBatchId && p.linkedBatchId === updatedBatch.id) ||
        (updatedBatch.linkedProductId && updatedBatch.linkedProductId === p.id) ||
        (productSkuClean && prodSkuClean && productSkuClean === prodSkuClean) ||
        updatedBatch.id === detBatchId ||
        updatedBatch.id === `LOT-RET-${p.id.replace('prod-', '')}` ||
        updatedBatch.id === `LOT-RET-${p.id}` ||
        p.id === `prod-${updatedBatch.id}`
      );

      if (isMatch) {
        const syncedProduct: RetailWholesaleProduct = {
          ...p,
          stockKg: updatedBatch.availableWeightKg,
          costPricePerUnit: updatedBatch.costPerKg || p.costPricePerUnit,
          wholesalePricePerUnit: updatedBatch.wholesalePricePerKg || p.wholesalePricePerUnit,
          linkedBatchId: updatedBatch.id
        };
        productRepository.save(syncedProduct, false).catch(err => {
          console.warn('[App] productRepository sync on batch update error:', err);
        });
        return syncedProduct;
      }
      return p;
    }));

    if (adjustmentData) {
      const newAdjustment: InventoryStockAdjustment = {
        id: `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        batchId: updatedBatch.id,
        speciesName: updatedBatch.speciesName,
        previousWeightKg: adjustmentData.previousWeightKg,
        newWeightKg: adjustmentData.newWeightKg,
        deltaWeightKg: adjustmentData.deltaWeightKg,
        unitCostUSD: adjustmentData.unitCostUSD,
        valuationVarianceUSD: adjustmentData.valuationVarianceUSD,
        reason: adjustmentData.reason,
        adjustmentAccountId: adjustmentData.adjustmentAccountId,
        adjustmentAccountCode: adjustmentData.adjustmentAccountCode,
        adjustmentAccountName: adjustmentData.adjustmentAccountName,
        notes: adjustmentData.notes,
        createdBy: staffProfile?.email || staffProfile?.full_name || 'Staff User',
        createdAt: new Date().toISOString()
      };

      setStockAdjustments(prev => [newAdjustment, ...prev]);

      // Record adjustment into Supabase + update adjustment account balance + post to financial ledger
      stockAdjustmentRepository.recordAdjustment(newAdjustment, adjustmentData.autoPostLedger).then(result => {
        if (result.financialEntry) {
          setFinancialEntries(prev => [result.financialEntry!, ...prev]);
        }
        // Update account balance in local state (negative variance/loss increases expense balance; positive recovery offsets it)
        setAdjustmentAccounts(prev => prev.map(acc => {
          if (acc.accountCode === adjustmentData.adjustmentAccountCode) {
            return {
              ...acc,
              balanceUSD: Number(((acc.balanceUSD || 0) - adjustmentData.valuationVarianceUSD).toFixed(2))
            };
          }
          return acc;
        }));
      }).catch(err => {
        console.warn('[App] stockAdjustmentRepository record error:', err);
      });
    }

    const deltaWeight = adjustmentData 
      ? adjustmentData.deltaWeightKg 
      : (updatedBatch.availableWeightKg - (batches.find(b => b.id === updatedBatch.id)?.availableWeightKg || 0));

    addNotification({
      type: 'system',
      title: `Stock Calibrated: Lot ${updatedBatch.id}`,
      message: `Stock updated to ${updatedBatch.availableWeightKg} kg (${deltaWeight >= 0 ? '+' : ''}${deltaWeight.toFixed(1)} kg) [Acc ${adjustmentData?.adjustmentAccountCode || '5150'}].`,
      urgency: 'low'
    });
  };

  // Financially Compliant Inventory Batch Disposal / Deletion Handler
  const handleDeleteBatch = async (batchId: string, options: DeleteBatchOptions) => {
    const targetBatch = batches.find(b => b.id === batchId);
    if (!targetBatch) return;

    const allocatedKg = Math.max(0, Number(targetBatch.allocatedWeightKg) || 0);
    if (allocatedKg > 0.001) {
      throw new Error(`Lot ${batchId} has ${allocatedKg.toFixed(1)} kg reserved for active orders. Fulfill or void those orders first.`);
    }

    const availableKg = Math.max(0, Number(targetBatch.availableWeightKg) || 0);
    const unitCost = Math.max(0, Number(targetBatch.costPerKg) || 0);
    const costBasisValue = Number((availableKg * unitCost).toFixed(2));
    const today = new Date().toISOString().split('T')[0];

    const skuClean = (targetBatch.productSku || '').toLowerCase().trim();
    const linkedProduct = products.find(p => {
      const prodSkuClean = (p.sku || '').toLowerCase().trim();
      const detBatchId = `LOT-RET-${(p.sku || p.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;
      return (
        (p.linkedBatchId && p.linkedBatchId === targetBatch.id) ||
        (targetBatch.linkedProductId && targetBatch.linkedProductId === p.id) ||
        (skuClean && prodSkuClean && skuClean === prodSkuClean) ||
        targetBatch.id === detBatchId ||
        targetBatch.id === `LOT-RET-${p.id.replace('prod-', '')}` ||
        targetBatch.id === `LOT-RET-${p.id}` ||
        p.id === `prod-${targetBatch.id}`
      );
    });

    if (options.mode === 'write_off_and_decommission') {
      const decommissionTag = `[DECOMMISSIONED ${today} | ${options.reason}${options.notes ? `: ${options.notes}` : ''} | Acc ${options.adjustmentAccountCode}]`;
      const updatedNotes = targetBatch.notes
        ? (targetBatch.notes.includes('[DECOMMISSIONED') ? targetBatch.notes : `${targetBatch.notes} | ${decommissionTag}`)
        : decommissionTag;

      const decommissionedBatch: InventoryBatch = {
        ...targetBatch,
        availableWeightKg: 0,
        notes: updatedNotes
      };

      setBatches(prev => prev.map(b => b.id === targetBatch.id ? decommissionedBatch : b));
      await batchRepository.save(decommissionedBatch, false);

      if (availableKg > 0.001) {
        const newAdjustment: InventoryStockAdjustment = {
          id: `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          batchId: targetBatch.id,
          speciesName: targetBatch.speciesName,
          previousWeightKg: Number(availableKg.toFixed(2)),
          newWeightKg: 0,
          deltaWeightKg: Number((-availableKg).toFixed(2)),
          unitCostUSD: unitCost,
          valuationVarianceUSD: Number((-costBasisValue).toFixed(2)),
          reason: options.reason,
          adjustmentAccountId: options.adjustmentAccountId,
          adjustmentAccountCode: options.adjustmentAccountCode,
          adjustmentAccountName: options.adjustmentAccountName,
          notes: options.notes || 'Lot written off and decommissioned',
          createdBy: staffProfile?.email || staffProfile?.full_name || 'Staff User',
          createdAt: new Date().toISOString()
        };

        setStockAdjustments(prev => [newAdjustment, ...prev]);

        const result = await stockAdjustmentRepository.recordAdjustment(newAdjustment, costBasisValue > 0);
        if (result.financialEntry) {
          setFinancialEntries(prev => [result.financialEntry!, ...prev]);
        }
        if (costBasisValue > 0) {
          setAdjustmentAccounts(prev => prev.map(acc => {
            if (acc.accountCode === options.adjustmentAccountCode) {
              return {
                ...acc,
                balanceUSD: Number(((acc.balanceUSD || 0) + costBasisValue).toFixed(2))
              };
            }
            return acc;
          }));
        }
      }

      if (linkedProduct) {
        const archivedProduct: RetailWholesaleProduct = {
          ...linkedProduct,
          stockKg: 0,
          isAvailableForRetail: false,
          isAvailableForWholesale: false,
          linkedBatchId: targetBatch.id
        };
        setProducts(prev => prev.map(p => p.id === linkedProduct.id ? archivedProduct : p));
        await productRepository.save(archivedProduct, false);
      }

      addNotification({
        type: 'system',
        title: `Lot Decommissioned: ${targetBatch.id}`,
        message: availableKg > 0
          ? `${availableKg.toFixed(1)} kg written off (${formatAppCurrency(costBasisValue)} posted to [${options.adjustmentAccountCode}]). Lot archived for traceability.`
          : `Zero-stock lot ${targetBatch.id} archived as Decommissioned.`,
        urgency: 'low'
      });
      return;
    }

    // Permanent deletion path: 'write_off_and_delete' or 'void_erroneous_entry'
    if (options.mode === 'write_off_and_delete' && availableKg > 0.001 && costBasisValue > 0) {
      const writeOffAdjustment: InventoryStockAdjustment = {
        id: `ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        batchId: targetBatch.id,
        speciesName: targetBatch.speciesName,
        previousWeightKg: Number(availableKg.toFixed(2)),
        newWeightKg: 0,
        deltaWeightKg: Number((-availableKg).toFixed(2)),
        unitCostUSD: unitCost,
        valuationVarianceUSD: Number((-costBasisValue).toFixed(2)),
        reason: options.reason,
        adjustmentAccountId: options.adjustmentAccountId,
        adjustmentAccountCode: options.adjustmentAccountCode,
        adjustmentAccountName: options.adjustmentAccountName,
        notes: options.notes || `Inventory Write-Off & Removal: Lot ${targetBatch.id}`,
        createdBy: staffProfile?.email || staffProfile?.full_name || 'Staff User',
        createdAt: new Date().toISOString()
      };

      setStockAdjustments(prev => [writeOffAdjustment, ...prev]);
      const adjResult = await stockAdjustmentRepository.recordAdjustment(writeOffAdjustment, true);
      if (adjResult.financialEntry) {
        setFinancialEntries(prev => [adjResult.financialEntry!, ...prev]);
      }

      setAdjustmentAccounts(prev => prev.map(acc => {
        if (acc.accountCode === options.adjustmentAccountCode) {
          return {
            ...acc,
            balanceUSD: Number(((acc.balanceUSD || 0) + costBasisValue).toFixed(2))
          };
        }
        return acc;
      }));
    }

    await batchRepository.delete(targetBatch.id);
    setBatches(prev => prev.filter(b => b.id !== targetBatch.id));

    if (linkedProduct) {
      if (options.removeLinkedProduct) {
        await productRepository.delete(linkedProduct.id);
        setProducts(prev => prev.filter(p => p.id !== linkedProduct.id));
      } else {
        const unlinkedProduct: RetailWholesaleProduct = {
          ...linkedProduct,
          stockKg: 0,
          linkedBatchId: undefined
        };
        setProducts(prev => prev.map(p => p.id === linkedProduct.id ? unlinkedProduct : p));
        await productRepository.save(unlinkedProduct, false);
      }
    }

    addNotification({
      type: 'system',
      title: options.mode === 'write_off_and_delete'
        ? `Inventory Written Off & Removed: ${targetBatch.id}`
        : `Erroneous Inventory Lot Purged: ${targetBatch.id}`,
      message: options.mode === 'write_off_and_delete' && costBasisValue > 0
        ? `${availableKg.toFixed(1)} kg (${formatAppCurrency(costBasisValue)}) expensed to [${options.adjustmentAccountCode}] in Financial Ledger.`
        : `Lot ${targetBatch.id} (${targetBatch.speciesName}) permanently removed from Cold Storage Inventory.`,
      urgency: 'low'
    });
  };

  // Add / Update Adjustment Account Handler
  const handleSaveAdjustmentAccount = (account: InventoryAdjustmentAccount) => {
    setAdjustmentAccounts(prev => {
      const idx = prev.findIndex(a => a.accountCode === account.accountCode);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = account;
        return copy;
      }
      return [...prev, account];
    });

    adjustmentAccountRepository.saveAccount(account).catch(err => {
      console.warn('[App] adjustmentAccountRepository save error:', err);
    });

    addNotification({
      type: 'system',
      title: `Account Saved: [${account.accountCode}]`,
      message: `${account.accountName} (${account.accountType}) configured in Supabase Chart of Accounts.`,
      urgency: 'low'
    });
  };

  // Helper: sync linked catalog product stockKg when inventory batches change
  const syncLinkedProductsWithBatches = (changedBatches: InventoryBatch[]) => {
    if (!changedBatches.length) return;
    setProducts(prev =>
      prev.map(prod => {
        const matchedBatch = changedBatches.find(b => doesBatchMatchProduct(b, prod));
        if (!matchedBatch || Math.abs(prod.stockKg - matchedBatch.availableWeightKg) < 0.01) {
          return prod;
        }
        const updatedProd: RetailWholesaleProduct = {
          ...prod,
          stockKg: Number(matchedBatch.availableWeightKg.toFixed(2)),
          linkedBatchId: matchedBatch.id,
        };
        productRepository.save(updatedProd, false).catch(err => {
          console.warn('[App] productRepository sync on batch delta error:', err);
        });
        return updatedProd;
      })
    );
  };

  // Helper: apply delta to matching customer's financials and persist to Supabase
  const applyCustomerOrderDelta = (
    orderRef: Pick<ClientOrder, 'customerId' | 'clientName'>,
    ordersCountDelta: number,
    totalSpendDelta: number,
    outstandingBalanceDelta: number
  ) => {
    if (ordersCountDelta === 0 && Math.abs(totalSpendDelta) < 0.001 && Math.abs(outstandingBalanceDelta) < 0.001) {
      return;
    }
    const targetNameLower = (orderRef.clientName || '').toLowerCase().trim();
    setCustomers(prev =>
      prev.map(cust => {
        const isMatch =
          (orderRef.customerId && cust.id === orderRef.customerId) ||
          cust.name.toLowerCase().trim() === targetNameLower ||
          cust.companyName.toLowerCase().trim() === targetNameLower;

        if (!isMatch) return cust;

        const newTotalCount = Math.max(0, cust.totalOrdersCount + ordersCountDelta);
        const newTotalSpend = Math.max(0, Number((cust.totalSpendUSD + totalSpendDelta).toFixed(2)));
        const newBalance = Math.max(0, Number((cust.outstandingBalanceUSD + outstandingBalanceDelta).toFixed(2)));

        customerRepository.updateFinancials(cust.id, newBalance, newTotalSpend, newTotalCount).catch(err => {
          console.warn('[App] customerRepository updateFinancials failed:', err);
        });
        return {
          ...cust,
          totalOrdersCount: newTotalCount,
          totalSpendUSD: newTotalSpend,
          outstandingBalanceUSD: newBalance,
        };
      })
    );
  };

  // Add Order Handler
  const handleAddOrder = (newOrder: ClientOrder) => {
    const availability = validateOrderLotAvailability(newOrder.items, batches);
    if (!availability.valid) {
      addNotification({
        type: 'system',
        title: 'Insufficient Lot Stock',
        message: availability.error || 'Requested weight exceeds available cold storage inventory.',
        urgency: 'high'
      });
      throw new Error(availability.error);
    }

    setOrders(prev => [newOrder, ...prev]);
    orderRepository.saveOrderWithItems(newOrder).catch(err => {
      console.warn('[App] orderRepository save error:', err);
    });

    const isCreditOrder = !isOrderPaid(newOrder);
    const orderVal = newOrder.adjustedTotalUSD || newOrder.quotedTotalUSD;
    const custDelta = computeOrderCustomerFinancialDelta(undefined, newOrder);
    applyCustomerOrderDelta(
      newOrder,
      custDelta.ordersCountDelta,
      custDelta.totalSpendDelta,
      custDelta.outstandingBalanceDelta
    );

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
      status: isCreditOrder ? 'Pending' : 'Settled',
      customerId: newOrder.customerId,
    };
    setFinancialEntries(prev => [newFinEntry, ...prev]);
    financialRepository.addEntry(newFinEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for order:', err);
    });

    // Allocate weight using delta on availableWeightKg so prior POS sales & adjustments are preserved
    const { updatedBatches, changedBatches } = applyOrderAllocationDeltas(
      batches,
      [],
      false,
      newOrder.items,
      isOrderActive(newOrder)
    );
    if (changedBatches.length > 0) {
      setBatches(updatedBatches);
      changedBatches.forEach(b => {
        batchRepository.updateWeights(b.id, b.availableWeightKg, b.allocatedWeightKg).catch(err => {
          console.warn('[App] Error updating batch weight in repository:', err);
        });
      });
      syncLinkedProductsWithBatches(changedBatches);
    }

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
    const existingOrder = orders.find(o => o.id === orderId);
    if (!existingOrder) return;

    const updatedOrder: ClientOrder = {
      ...existingOrder,
      items: updatedItems,
      adjustedTotalUSD: adjustedTotal,
      status: existingOrder.status === 'Pending Confirmation' ? 'Weighing & Grading' : existingOrder.status
    };

    const availability = validateOrderLotAvailability(updatedItems, batches, existingOrder);
    if (!availability.valid) {
      addNotification({
        type: 'system',
        title: 'Catch-Weight Exceeds Lot Stock',
        message: availability.error || 'Weighed quantity exceeds available batch inventory.',
        urgency: 'high'
      });
      return;
    }

    setOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    orderRepository.saveOrderWithItems(updatedOrder).catch(err => {
      console.warn('[App] orderRepository save after weighing error:', err);
    });

    // Apply weight delta relative to previously allocated weight for this order
    const { updatedBatches, changedBatches } = applyOrderAllocationDeltas(
      batches,
      existingOrder.items,
      isOrderActive(existingOrder),
      updatedItems,
      isOrderActive(updatedOrder)
    );
    if (changedBatches.length > 0) {
      setBatches(updatedBatches);
      changedBatches.forEach(b => {
        batchRepository.updateWeights(b.id, b.availableWeightKg, b.allocatedWeightKg).catch(err => {
          console.warn('[App] Error calibrating batch weight in repository:', err);
        });
      });
      syncLinkedProductsWithBatches(changedBatches);
    }

    // Reconcile customer AR & lifetime spend with calibrated catch-weight invoice total
    const custDelta = computeOrderCustomerFinancialDelta(existingOrder, updatedOrder);
    applyCustomerOrderDelta(
      updatedOrder,
      custDelta.ordersCountDelta,
      custDelta.totalSpendDelta,
      custDelta.outstandingBalanceDelta
    );

    addNotification({
      type: 'order_update',
      title: `Catch-Weight Calibrated: Order ${orderId}`,
      message: `Yield weighed on certified scale. Adjusted total recalibrated to ${formatAppCurrency(adjustedTotal)}.`,
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
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const updatedOrder: ClientOrder = { ...orderToUpdate, paymentStatus: status };
    setOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    orderRepository.save(updatedOrder).catch(err => {
      console.warn('[App] orderRepository update payment status error:', err);
    });

    const isNowPaid = isOrderPaid({ paymentStatus: status });
    const wasPaid = isOrderPaid(orderToUpdate);

    if (isNowPaid !== wasPaid && isOrderActive(orderToUpdate)) {
      const custDelta = computeOrderCustomerFinancialDelta(orderToUpdate, updatedOrder);
      applyCustomerOrderDelta(
        orderToUpdate,
        custDelta.ordersCountDelta,
        custDelta.totalSpendDelta,
        custDelta.outstandingBalanceDelta
      );

      setFinancialEntries(prev =>
        prev.map(entry => {
          if (entry.referenceId === orderId && entry.type === 'Income') {
            return { ...entry, status: isNowPaid ? ('Settled' as const) : ('Pending' as const) };
          }
          return entry;
        })
      );
    }

    addNotification({
      type: 'order_update',
      title: `Payment Updated: ${orderId}`,
      message: `Account status updated to ${status}.`,
      urgency: 'low'
    });
  };

  // Order Modification / Edit Handler
  const handleSaveOrder = async (updatedOrder: ClientOrder) => {
    const existingOrder = orders.find(o => o.id === updatedOrder.id);

    if (isOrderActive(updatedOrder)) {
      const availability = validateOrderLotAvailability(updatedOrder.items, batches, existingOrder);
      if (!availability.valid) {
        throw new Error(availability.error);
      }
    }

    setOrders(prev => prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o)));

    if (existingOrder) {
      const { updatedBatches, changedBatches } = applyOrderAllocationDeltas(
        batches,
        existingOrder.items,
        isOrderActive(existingOrder),
        updatedOrder.items,
        isOrderActive(updatedOrder)
      );
      if (changedBatches.length > 0) {
        setBatches(updatedBatches);
        changedBatches.forEach(b => {
          batchRepository.updateWeights(b.id, b.availableWeightKg, b.allocatedWeightKg).catch(err => {
            console.warn('[App] batchRepository sync on order edit error:', err);
          });
        });
        syncLinkedProductsWithBatches(changedBatches);
      }

      const custDelta = computeOrderCustomerFinancialDelta(existingOrder, updatedOrder);
      applyCustomerOrderDelta(
        updatedOrder,
        custDelta.ordersCountDelta,
        custDelta.totalSpendDelta,
        custDelta.outstandingBalanceDelta
      );
    }

    try {
      await orderRepository.saveOrderWithItems(updatedOrder);
      addNotification({
        type: 'order_update',
        title: `Order ${updatedOrder.id} Updated`,
        message: `Order specifications, inventory allocations, and quote updated for ${updatedOrder.clientName}.`,
        urgency: 'low'
      });
    } catch (err: any) {
      console.warn('[App] orderRepository saveOrder error:', err);
    }
  };

  // Estimated Quote Editing Handler (with real-time recalculation & inventory/AR sync)
  const handleSaveQuote = async (orderId: string, updatedItems: OrderLineItem[], newQuotedTotal: number) => {
    const existingOrder = orders.find(o => o.id === orderId);
    if (!existingOrder) return;

    if (isOrderActive(existingOrder)) {
      const availability = validateOrderLotAvailability(updatedItems, batches, existingOrder);
      if (!availability.valid) {
        throw new Error(availability.error);
      }
    }

    const isWeighed = updatedItems.some(i => i.actualWeighedKg !== null && i.actualWeighedKg !== undefined);
    const updatedOrder: ClientOrder = {
      ...existingOrder,
      items: updatedItems,
      quotedTotalUSD: newQuotedTotal,
      adjustedTotalUSD: isWeighed
        ? updatedItems.reduce((s, i) => s + (i.actualWeighedKg ?? i.requestedWeightKg) * i.pricePerKg, 0)
        : newQuotedTotal
    };

    setOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));

    const { updatedBatches, changedBatches } = applyOrderAllocationDeltas(
      batches,
      existingOrder.items,
      isOrderActive(existingOrder),
      updatedItems,
      isOrderActive(updatedOrder)
    );
    if (changedBatches.length > 0) {
      setBatches(updatedBatches);
      changedBatches.forEach(b => {
        batchRepository.updateWeights(b.id, b.availableWeightKg, b.allocatedWeightKg).catch(err => {
          console.warn('[App] batchRepository sync on quote edit error:', err);
        });
      });
      syncLinkedProductsWithBatches(changedBatches);
    }

    const custDelta = computeOrderCustomerFinancialDelta(existingOrder, updatedOrder);
    applyCustomerOrderDelta(
      updatedOrder,
      custDelta.ordersCountDelta,
      custDelta.totalSpendDelta,
      custDelta.outstandingBalanceDelta
    );

    try {
      await orderRepository.saveOrderWithItems(updatedOrder);
      addNotification({
        type: 'order_update',
        title: `Estimated Quote Updated: ${orderId}`,
        message: `Quoted total recalculated to ${formatAppCurrency(newQuotedTotal)}.`,
        urgency: 'low'
      });
    } catch (err) {
      console.warn('[App] Error saving updated quote:', err);
    }
  };

  // Order Deletion Handler (releases lot allocations and reverses customer AR/spend)
  const handleDeleteOrder = async (orderId: string) => {
    const existingOrder = orders.find(o => o.id === orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));

    if (existingOrder) {
      const { updatedBatches, changedBatches } = applyOrderAllocationDeltas(
        batches,
        existingOrder.items || [],
        isOrderActive(existingOrder),
        [],
        false
      );
      if (changedBatches.length > 0) {
        setBatches(updatedBatches);
        changedBatches.forEach(b => {
          batchRepository.updateWeights(b.id, b.availableWeightKg, b.allocatedWeightKg).catch(err => {
            console.warn('[App] batchRepository release on order delete error:', err);
          });
        });
        syncLinkedProductsWithBatches(changedBatches);
      }

      const custDelta = computeOrderCustomerFinancialDelta(existingOrder, undefined);
      applyCustomerOrderDelta(
        existingOrder,
        custDelta.ordersCountDelta,
        custDelta.totalSpendDelta,
        custDelta.outstandingBalanceDelta
      );
    }

    try {
      await orderRepository.delete(orderId);
      addNotification({
        type: 'order_update',
        title: `Order Deleted`,
        message: `Order ${orderId} deleted, stock allocations released, and customer totals reconciled.`,
        urgency: 'low'
      });
    } catch (err) {
      console.warn('[App] Error deleting order:', err);
    }
  };

  // Order Void / Cancellation Handler (Customer Section)
  const handleVoidOrder = async (orderId: string, reason: string, voidedBy: string) => {
    const existingOrder = orders.find(o => o.id === orderId);
    if (!existingOrder || !isOrderActive(existingOrder)) return;

    const orderAmount = existingOrder.adjustedTotalUSD || existingOrder.quotedTotalUSD || 0;
    const isPaid = isOrderPaid(existingOrder);
    const nowIso = new Date().toISOString();

    // 1. Update Order State
    const updatedOrder: ClientOrder = {
      ...existingOrder,
      status: 'Voided',
      paymentStatus: 'Cancelled',
      voidReason: reason,
      voidedAt: nowIso,
      voidedBy: voidedBy
    };

    setOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    try {
      await orderRepository.saveOrderWithItems(updatedOrder);
    } catch (err) {
      console.warn('[App] Error saving voided order:', err);
    }

    // 2. Restore Allocated Inventory Lot Weights back to batch storage & sync linked products
    if (existingOrder.items && existingOrder.items.length > 0) {
      const { updatedBatches, changedBatches } = applyOrderAllocationDeltas(
        batches,
        existingOrder.items,
        true,
        [],
        false
      );
      if (changedBatches.length > 0) {
        setBatches(updatedBatches);
        changedBatches.forEach(b => {
          batchRepository.save(b, false).catch(err => console.warn('[App] batchRepository restore error:', err));
        });
        syncLinkedProductsWithBatches(changedBatches);
      }
    }

    // 3. Reconcile Customer Spend & Outstanding Balance
    const custDelta = computeOrderCustomerFinancialDelta(existingOrder, updatedOrder);
    applyCustomerOrderDelta(
      existingOrder,
      custDelta.ordersCountDelta,
      custDelta.totalSpendDelta,
      custDelta.outstandingBalanceDelta
    );

    // 4. Record Positive-Amount Counter Ledger Entry (DB requires CHECK (amount >= 0); FIN-REV-* prefix marks reversal)
    if (orderAmount > 0) {
      const financialEntry: FinancialLedgerEntry = {
        id: `FIN-REV-VOID-${Date.now()}`,
        date: nowIso.split('T')[0],
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: `Void Order #${existingOrder.id}${isPaid ? ' (Paid Refund/Credit)' : ''}: ${reason} (Authorized by ${voidedBy})`,
        entityName: existingOrder.clientName,
        amount: Math.abs(orderAmount),
        paymentMethod: isPaid ? 'Refund / Credit Reversal' : (existingOrder.paymentTerms ? `Credit Reversal (${existingOrder.paymentTerms})` : 'Order Void'),
        status: 'Settled',
        referenceId: `REV-${existingOrder.id}`,
        customerId: existingOrder.customerId,
        notes: `Void authorized by ${voidedBy}: ${reason}`
      };
      setFinancialEntries(prev => [financialEntry, ...prev]);
      try {
        await financialRepository.addEntry(financialEntry);
      } catch (err) {
        console.warn('[App] financialRepository void entry error:', err);
      }
    }

    // 5. Notify Operations
    addNotification({
      type: 'order_update',
      title: `Order #${orderId} Voided`,
      message: `Order marked as voided by ${voidedBy}. Reason: ${reason}. Lot allocations restored & customer financials reconciled.`,
      urgency: 'medium'
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

  const handleDeleteCustomer = async (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    try {
      await customerRepository.delete(customerId);
      addNotification({
        type: 'system',
        title: `Customer Account Deleted`,
        message: `${cust?.companyName || cust?.name || customerId} has been permanently deleted.`,
        urgency: 'low'
      });
    } catch (err) {
      console.warn('[App] customerRepository delete error:', err);
    }
  };

  const handleUpdateCustomerStatus = async (customerId: string, newStatus: CustomerStatus, reason?: string) => {
    let updatedCustomer: Customer | undefined;
    const nowIso = new Date().toISOString();
    setCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      const updated: Customer = {
        ...c,
        status: newStatus,
        statusReason: reason || c.statusReason,
        statusUpdatedAt: nowIso,
        notes: reason 
          ? `${c.notes ? c.notes + ' | ' : ''}[${nowIso.split('T')[0]}] Status set to ${newStatus}: ${reason}`
          : c.notes
      };
      updatedCustomer = updated;
      return updated;
    }));

    if (updatedCustomer) {
      try {
        await customerRepository.save(updatedCustomer, false);
        addNotification({
          type: 'order_update',
          title: `Customer Status: ${newStatus}`,
          message: `${updatedCustomer.companyName || updatedCustomer.name} marked as ${newStatus}${reason ? `: ${reason}` : '.'}`,
          urgency: newStatus === 'Blacklisted' ? 'high' : 'low'
        });
      } catch (err) {
        console.warn('[App] Error updating customer status in repository:', err);
      }
    }
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

  const handleUpdateSupplier = async (updatedSupplier: Supplier) => {
    const previous = suppliers.find(s => s.id === updatedSupplier.id);
    await supplierRepository.save(updatedSupplier, false);

    setSuppliers(prev => prev.map(s => (s.id === updatedSupplier.id ? updatedSupplier : s)));

    // Keep supplierName consistent across purchase orders if renamed
    if (previous && previous.name !== updatedSupplier.name) {
      const affectedPOs = purchaseOrders.filter(po => po.supplierId === updatedSupplier.id);
      if (affectedPOs.length > 0) {
        setPurchaseOrders(prev =>
          prev.map(po =>
            po.supplierId === updatedSupplier.id ? { ...po, supplierName: updatedSupplier.name } : po
          )
        );
        affectedPOs.forEach(po => {
          purchaseOrderRepository
            .save({ ...po, supplierName: updatedSupplier.name }, false)
            .catch(err => console.warn('[App] PO supplierName sync error:', err));
        });
      }
    }

    addNotification({
      type: 'order_update',
      title: `Supplier Updated`,
      message: `${updatedSupplier.name} profile and remittance settings saved.`,
      urgency: 'low'
    });
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    const sup = suppliers.find(s => s.id === supplierId);
    setSuppliers(prev => prev.filter(s => s.id !== supplierId));
    try {
      await supplierRepository.delete(supplierId);
      addNotification({
        type: 'system',
        title: `Supplier Account Deleted`,
        message: `${sup?.name || supplierId} has been permanently deleted.`,
        urgency: 'low'
      });
    } catch (err) {
      console.warn('[App] supplierRepository delete error:', err);
    }
  };

  const handleUpdateSupplierStatus = async (supplierId: string, newStatus: SupplierStatus, reason?: string) => {
    let updatedSupplier: Supplier | undefined;
    const nowIso = new Date().toISOString();
    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplierId) return s;
      const updated: Supplier = {
        ...s,
        status: newStatus,
        statusReason: reason || s.statusReason,
        statusUpdatedAt: nowIso,
        notes: reason 
          ? `${s.notes ? s.notes + ' | ' : ''}[${nowIso.split('T')[0]}] Status set to ${newStatus}: ${reason}`
          : s.notes
      };
      updatedSupplier = updated;
      return updated;
    }));

    if (updatedSupplier) {
      try {
        await supplierRepository.save(updatedSupplier, false);
        addNotification({
          type: 'order_update',
          title: `Supplier Status: ${newStatus}`,
          message: `${updatedSupplier.name} status updated to ${newStatus}${reason ? `: ${reason}` : '.'}`,
          urgency: newStatus === 'Blacklisted' ? 'high' : 'low'
        });
      } catch (err) {
        console.warn('[App] Error updating supplier status in repository:', err);
      }
    }
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

    // Add to Inventory Batches & Dual Pricing Products
    const item = newPO.speciesItems[0];
    if (item) {
      const resolvedSpeciesId = getSpeciesIdFromName(item.speciesName);
      const taxonomy = getSpeciesTaxonomy(resolvedSpeciesId);
      const matchedSpecies = SPECIES_CATALOG.find(s => s.id === resolvedSpeciesId || s.name === item.speciesName);

      const wholesalePrice = Number((item.costPerKg * 1.45).toFixed(2));
      const retailPrice = Number((wholesalePrice * 1.30).toFixed(2));

      let cutType: SeafoodCutType = 'Whole Round Fish';
      if (item.storageZone?.includes('Live')) {
        cutType = 'Live in Oxygen Tank';
      } else if (item.grade === 'Sashimi AAA' || item.storageZone?.includes('-60')) {
        cutType = 'Skinless Sashimi Saku Block';
      } else if (taxonomy.category === 'Crustacean') {
        cutType = 'Packaged 500g Tray';
      } else {
        cutType = 'Skin-On Loin / Fillet';
      }

      const newProd: RetailWholesaleProduct = {
        id: `prod-${newPO.lotAssignedId}`,
        speciesId: resolvedSpeciesId,
        name: item.speciesName,
        cutType: cutType,
        category: taxonomy.category,
        grade: item.grade,
        stockKg: item.weightKg,
        unit: 'kg',
        costPricePerUnit: item.costPerKg,
        wholesalePricePerUnit: wholesalePrice,
        retailPricePerUnit: retailPrice,
        wholesaleMinQty: 10,
        retailPackSize: '1.0 kg fresh pack',
        sku: `SKU-${newPO.lotAssignedId}`,
        imageUrl: matchedSpecies?.image || 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80',
        origin: newPO.portLocation || 'Dockside Inward Hub',
        isAvailableForRetail: true,
        isAvailableForWholesale: true,
        linkedBatchId: newPO.lotAssignedId,
        storageZone: item.storageZone,
        minSafetyStockKg: 20
      };

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
        wholesalePricePerKg: wholesalePrice,
        certifications: ['MSC Certified', 'FDA HACCP Certified'],
        inspectionStatus: 'Passed',
        histaminePpm: 4.2,
        coreTempCelsius: -58.0,
        receivedDate: newPO.orderDate,
        expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        qrCodeSeed: `QR-AUTH-PROV-${newPO.lotAssignedId}`,
        notes: newPO.notes,
        linkedProductId: newProd.id,
        productSku: newProd.sku,
        isRetailCutLot: false
      };
      setBatches(prev => [newBatch, ...prev]);
      setProducts(prev => [newProd, ...prev]);
      batchRepository.save(newBatch, true).catch(err => {
        console.warn('[App] batchRepository save error for landing:', err);
      });
      productRepository.save(newProd, true).catch(err => {
        console.warn('[App] productRepository save error for PO product:', err);
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

  const handleUpdatePurchaseOrder = async (updatedPO: PurchaseOrderLanding) => {
    const existingPO = purchaseOrders.find(p => p.id === updatedPO.id);
    if (!existingPO) return;

    const oldWeight = (existingPO.speciesItems || []).reduce((s, item) => s + (Number(item.weightKg) || 0), 0);
    const newWeight = (updatedPO.speciesItems || []).reduce((s, item) => s + (Number(item.weightKg) || 0), 0);
    const newItem = updatedPO.speciesItems[0];
    const deltaWeight = Number((newWeight - oldWeight).toFixed(2));

    const oldCost = Number(existingPO.totalCostUSD) || 0;
    const newCost = Number(updatedPO.totalCostUSD) || 0;
    const deltaCost = Number((newCost - oldCost).toFixed(2));

    // Validate weight change against linked inventory batch allocations/sales
    const linkedBatch = updatedPO.lotAssignedId
      ? batches.find(b => b.id === updatedPO.lotAssignedId)
      : undefined;
    if (linkedBatch && deltaWeight < 0) {
      const nextAvailable = Number((linkedBatch.availableWeightKg + deltaWeight).toFixed(2));
      if (nextAvailable < -0.001) {
        const committedKg = Math.max(0, Number((linkedBatch.initialWeightKg - linkedBatch.availableWeightKg).toFixed(1)));
        throw new Error(
          `Cannot reduce PO weight by ${Math.abs(deltaWeight).toFixed(1)} kg because ${committedKg.toFixed(1)} kg from linked Lot ${linkedBatch.id} has already been allocated or depleted.`
        );
      }
    }

    await purchaseOrderRepository.savePurchaseOrderWithItems(updatedPO, false);
    setPurchaseOrders(prev => prev.map(p => (p.id === updatedPO.id ? updatedPO : p)));

    // Reconcile supplier AP & sourcing totals
    const isUnpaid = existingPO.paymentStatus !== 'Paid in Full';
    if (existingPO.supplierId === updatedPO.supplierId) {
      if (Math.abs(deltaCost) > 0.001 || Math.abs(deltaWeight) > 0.001) {
        setSuppliers(prev =>
          prev.map(sup => {
            if (sup.id !== updatedPO.supplierId) return sup;
            const updatedSup: Supplier = {
              ...sup,
              totalPurchasedUSD: Math.max(0, Number((sup.totalPurchasedUSD + deltaCost).toFixed(2))),
              outstandingPayableUSD: isUnpaid
                ? Math.max(0, Number((sup.outstandingPayableUSD + deltaCost).toFixed(2)))
                : sup.outstandingPayableUSD,
              totalWeightSuppliedKg: Math.max(0, Number((sup.totalWeightSuppliedKg + deltaWeight).toFixed(2))),
            };
            supplierRepository.save(updatedSup, false).catch(err => {
              console.warn('[App] supplierRepository update totals on PO edit error:', err);
            });
            return updatedSup;
          })
        );
      }
    } else {
      setSuppliers(prev =>
        prev.map(sup => {
          if (sup.id === existingPO.supplierId) {
            const updatedOldSup: Supplier = {
              ...sup,
              totalPurchasedUSD: Math.max(0, Number((sup.totalPurchasedUSD - oldCost).toFixed(2))),
              outstandingPayableUSD: isUnpaid
                ? Math.max(0, Number((sup.outstandingPayableUSD - oldCost).toFixed(2)))
                : sup.outstandingPayableUSD,
              totalWeightSuppliedKg: Math.max(0, Number((sup.totalWeightSuppliedKg - oldWeight).toFixed(2))),
            };
            supplierRepository.save(updatedOldSup, false).catch(err => {
              console.warn('[App] supplierRepository deduct old supplier on PO reassign error:', err);
            });
            return updatedOldSup;
          }
          if (sup.id === updatedPO.supplierId) {
            const updatedNewSup: Supplier = {
              ...sup,
              totalPurchasedUSD: Number((sup.totalPurchasedUSD + newCost).toFixed(2)),
              outstandingPayableUSD: isUnpaid
                ? Number((sup.outstandingPayableUSD + newCost).toFixed(2))
                : sup.outstandingPayableUSD,
              totalWeightSuppliedKg: Number((sup.totalWeightSuppliedKg + newWeight).toFixed(2)),
            };
            supplierRepository.save(updatedNewSup, false).catch(err => {
              console.warn('[App] supplierRepository add new supplier on PO reassign error:', err);
            });
            return updatedNewSup;
          }
          return sup;
        })
      );
    }

    // Synchronize linked InventoryBatch & RetailWholesaleProduct
    if (linkedBatch && newItem) {
      const resolvedSpeciesId = getSpeciesIdFromName(newItem.speciesName);
      const taxonomy = getSpeciesTaxonomy(resolvedSpeciesId);
      const nextInitial = Math.max(0.1, Number((linkedBatch.initialWeightKg + deltaWeight).toFixed(2)));
      const nextAvailable = Math.max(0, Number((linkedBatch.availableWeightKg + deltaWeight).toFixed(2)));
      const updatedBatch: InventoryBatch = {
        ...linkedBatch,
        speciesId: resolvedSpeciesId,
        speciesName: newItem.speciesName,
        scientificName: taxonomy.scientificName,
        category: taxonomy.category,
        harvestDate: updatedPO.orderDate,
        landingPort: updatedPO.portLocation,
        vesselName: updatedPO.vesselName,
        grade: newItem.grade,
        storageZone: newItem.storageZone,
        costPerKg: newItem.costPerKg,
        initialWeightKg: Math.max(nextInitial, nextAvailable + (linkedBatch.allocatedWeightKg || 0)),
        availableWeightKg: nextAvailable,
        notes: updatedPO.notes ?? linkedBatch.notes,
      };

      setBatches(prev => prev.map(b => (b.id === updatedBatch.id ? updatedBatch : b)));
      batchRepository.save(updatedBatch, false).catch(err => {
        console.warn('[App] batchRepository sync on PO edit error:', err);
      });

      const linkedProd = products.find(
        p =>
          p.linkedBatchId === updatedBatch.id ||
          (updatedBatch.linkedProductId && p.id === updatedBatch.linkedProductId) ||
          p.id === `prod-${updatedBatch.id}`
      );
      if (linkedProd) {
        const updatedProd: RetailWholesaleProduct = {
          ...linkedProd,
          speciesId: resolvedSpeciesId,
          name: newItem.speciesName,
          category: taxonomy.category,
          grade: newItem.grade,
          stockKg: nextAvailable,
          costPricePerUnit: newItem.costPerKg,
          storageZone: newItem.storageZone,
          origin: updatedPO.portLocation || linkedProd.origin,
        };
        setProducts(prev => prev.map(p => (p.id === updatedProd.id ? updatedProd : p)));
        productRepository.save(updatedProd, false).catch(err => {
          console.warn('[App] productRepository sync on PO edit error:', err);
        });
      }
    }

    addNotification({
      type: 'order_update',
      title: `Purchase Order Updated: ${updatedPO.id}`,
      message: `${updatedPO.supplierName} (${newItem?.speciesName || 'Catch'}, ${newWeight.toLocaleString()} kg) synchronized to Supabase.`,
      urgency: 'low'
    });
  };

  // Retail POS Handlers
  const handleCompleteRetailSale = (sale: RetailTransaction) => {
    setRetailSales(prev => [sale, ...prev]);
    retailTransactionRepository.recordSaleWithItems(sale).catch(err => {
      console.warn('[App] retailTransactionRepository recordSale error:', err);
    });

    // Deduct stock consistently from both Dual Price Book products and linked Inventory Batches
    const {
      updatedProducts,
      changedProducts,
      updatedBatches,
      changedBatches,
    } = applyRetailSaleStockDeductions(products, batches, sale.items);

    if (changedProducts.length > 0) {
      setProducts(updatedProducts);
      changedProducts.forEach(updatedProd => {
        productRepository.save(updatedProd, false).catch(err => {
          console.warn('[App] productRepository update stock error:', err);
        });
      });
    }

    if (changedBatches.length > 0) {
      setBatches(updatedBatches);
      changedBatches.forEach(updatedBatch => {
        batchRepository.updateWeights(
          updatedBatch.id,
          updatedBatch.availableWeightKg,
          updatedBatch.allocatedWeightKg
        ).catch(err => {
          console.warn('[App] batchRepository updateWeights error during retail sale:', err);
        });
      });
    }

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
    let targetProduct: RetailWholesaleProduct | undefined;
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updatedProd = {
          ...p,
          wholesalePricePerUnit: wholesalePrice,
          retailPricePerUnit: retailPrice
        };
        targetProduct = updatedProd;
        productRepository.save(updatedProd, false).catch(err => {
          console.warn('[App] productRepository update pricing error:', err);
        });
        return updatedProd;
      }
      return p;
    }));

    // Update matching lot in cold storage inventory in lockstep
    if (targetProduct) {
      const prod = targetProduct as RetailWholesaleProduct;
      const productSkuClean = (prod.sku || '').toLowerCase().trim();
      setBatches(prev => prev.map(b => {
        const batchSkuClean = (b.productSku || '').toLowerCase().trim();
        const detBatchId = `LOT-RET-${(prod.sku || prod.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;
        const isMatch = (
          (prod.linkedBatchId && b.id === prod.linkedBatchId) ||
          (b.linkedProductId && b.linkedProductId === prod.id) ||
          (batchSkuClean && productSkuClean && batchSkuClean === productSkuClean) ||
          b.id === detBatchId ||
          b.id === `LOT-RET-${prod.id.replace('prod-', '')}` ||
          b.id === `LOT-RET-${prod.id}` ||
          prod.id === `prod-${b.id}` ||
          (b.speciesId === prod.speciesId && b.grade === prod.grade)
        );

        if (isMatch) {
          const updatedBatch = {
            ...b,
            wholesalePricePerKg: wholesalePrice
          };
          batchRepository.save(updatedBatch, false).catch(err => {
            console.warn('[App] batchRepository update pricing error:', err);
          });
          return updatedBatch;
        }
        return b;
      }));
    }

    addNotification({
      type: 'order_update',
      title: `Price Book & Inventory Synchronized`,
      message: `Product and vault lot wholesale price updated to ${formatAppCurrency(wholesalePrice)}/kg.`,
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
      const productSkuClean = (product.sku || '').toLowerCase().trim();
      const deterministicBatchId = `LOT-RET-${(product.sku || product.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

      if (!linkedBatch) {
        const existingLot = batches.find(b => 
          (b.linkedProductId && b.linkedProductId === product.id) || 
          (b.productSku && productSkuClean && b.productSku.toLowerCase().trim() === productSkuClean) ||
          b.id === deterministicBatchId ||
          b.id === `LOT-RET-${product.id.replace('prod-', '')}` ||
          b.id === `LOT-RET-${product.id}`
        );

        if (existingLot) {
          linkedBatch = {
            ...existingLot,
            speciesName: product.name,
            grade: product.grade,
            initialWeightKg: Math.max(1.0, Math.max(Number(existingLot.initialWeightKg) || 1.0, Number(product.stockKg) || 0)),
            availableWeightKg: Math.max(0, Number(product.stockKg) || 0),
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
        const newBatchId = deterministicBatchId;

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
          initialWeightKg: Math.max(1.0, Number(product.stockKg) || 1.0),
          availableWeightKg: Math.max(0, Number(product.stockKg) || 0),
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

      if (product.linkedBatchId !== linkedBatch.id) {
        product.linkedBatchId = linkedBatch.id;
        await productRepository.save(product, false);
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, linkedBatchId: linkedBatch!.id } : p));
      }

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
      const targetProd = products.find(p => p.id === productId);
      await productRepository.delete(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));

      // Check linked inventory lot for safe 1:1 parity accountability
      const linked = batches.find(b => 
        b.linkedProductId === productId || 
        (targetProd?.linkedBatchId && b.id === targetProd.linkedBatchId) ||
        (targetProd?.sku && b.productSku && b.productSku.toLowerCase().trim() === targetProd.sku.toLowerCase().trim())
      );

      if (linked) {
        const hasOrderRefs = orders.some(o => o.items?.some(i => i.lotId === linked.id));
        const hasAllocations = (linked.allocatedWeightKg || 0) > 0.001;

        if (hasOrderRefs || hasAllocations) {
          // Preserve lot in inventory_batches so fk_order_items_lot and active allocations remain intact; simply unlink catalog ref
          const unlinkedBatch: InventoryBatch = {
            ...linked,
            linkedProductId: undefined
          };
          setBatches(prev => prev.map(b => b.id === linked.id ? unlinkedBatch : b));
          batchRepository.save(unlinkedBatch, false).catch(err => console.warn(err));
        } else {
          // Safe to remove unreferenced linked batch; post write-off if stock remains
          const remainingKg = Math.max(0, Number(linked.availableWeightKg) || 0);
          const remainingValue = Number((remainingKg * (Number(linked.costPerKg) || 0)).toFixed(2));
          if (remainingKg > 0.001 && remainingValue > 0) {
            const finEntry: FinancialLedgerEntry = {
              id: `FIN-WO-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
              date: new Date().toISOString().split('T')[0],
              type: 'COGS',
              category: 'Inventory Adjustment',
              description: `Catalog Removal Inventory Write-Off: Lot ${linked.id} (${linked.speciesName}, ${remainingKg.toFixed(1)} kg) [Acc 5150]`,
              referenceId: linked.id,
              entityName: 'Internal Cold Vault [Acc 5150]',
              amount: remainingValue,
              paymentMethod: 'Adjustment Account 5150',
              status: 'Settled'
            };
            financialRepository.addEntry(finEntry).then(saved => {
              setFinancialEntries(prev => [saved, ...prev]);
            }).catch(err => console.warn(err));
            adjustmentAccountRepository.updateBalance('5150', remainingValue).catch(() => {});
          }
          setBatches(prev => prev.filter(b => b.id !== linked.id));
          batchRepository.delete(linked.id).catch(err => console.warn(err));
        }
      }

      addNotification({
        type: 'order_update',
        title: 'Product & Inventory Synced',
        message: `${targetProd?.name || 'Product'} removed from Dual Pricing${linked ? ' and synchronized with Cold Storage Inventory' : ''}.`,
        urgency: 'low'
      });
    } catch (err) {
      console.error('[App] Failed to delete product:', err);
    }
  };

  const handleRefreshInventoryFromSupabase = async () => {
    const fresh = await batchRepository.getBatches([]);
    const deduplicated = deduplicateBatches(fresh || []);
    setBatches(deduplicated);
    setIsBatchesHydrated(true);
    addNotification({
      type: 'system',
      title: 'Inventory Synced with Supabase',
      message: `Loaded ${deduplicated.length} verified lot(s) directly from Supabase inventory_batches.`,
      urgency: 'low'
    });
  };

  const handleReconcileCatalog = async () => {
    const { updatedBatches, updatedProducts, newLots, newProducts } = reconcileCatalogWithInventory(products, batches);
    let changed = false;

    if (newLots.length > 0 || updatedBatches.length !== batches.length) {
      const savedLots: InventoryBatch[] = [];
      for (const lot of newLots) {
        try {
          const persisted = await batchRepository.save(lot, true);
          savedLots.push(persisted);
        } catch (err) {
          console.warn('[App] handleReconcileCatalog batch save error:', err);
        }
      }
      if (savedLots.length > 0) {
        const refreshed = await batchRepository.getBatches([]);
        setBatches(deduplicateBatches(refreshed));
        changed = true;
      }
    }

    if (newProducts.length > 0 || updatedProducts.length !== products.length) {
      setProducts(updatedProducts);
      for (const prod of newProducts) {
        try {
          await productRepository.save(prod, true);
        } catch (err) {
          console.warn('[App] handleReconcileCatalog product save error:', err);
        }
      }
      changed = true;
    }

    if (changed || newLots.length > 0 || newProducts.length > 0) {
      addNotification({
        type: 'order_update',
        title: 'Catalog & Inventory Synchronized',
        message: `Parity update synced directly to Supabase.`,
        urgency: 'low'
      });
    } else {
      addNotification({
        type: 'system',
        title: '1:1 Parity Verified',
        message: `All ${products.length} products and vault lots are strictly equal and synchronized.`,
        urgency: 'low'
      });
    }
  };

  // Universal Payment & Settle Ledger Handler (AR / AP)
  const handleRecordPayment = (
    type: 'AR' | 'AP',
    entityId: string,
    amount: number,
    refId: string,
    paymentMethod: string = 'Bank Wire Transfer',
    notes: string = '',
    specificOrderId?: string
  ) => {
    if (type === 'AR') {
      const cust = customers.find(c => c.id === entityId);

      // Update customer receivable balance
      setCustomers(prev => prev.map(c => {
        if (c.id === entityId) {
          const newBal = Math.max(0, Number((c.outstandingBalanceUSD - amount).toFixed(2)));
          customerRepository.updateFinancials(c.id, newBal, c.totalSpendUSD, c.totalOrdersCount).catch(err => {
            console.warn('[App] customerRepository updateFinancials on AR settlement failed:', err);
          });
          return {
            ...c,
            outstandingBalanceUSD: newBal
          };
        }
        return c;
      }));

      // Settle matching open order(s) accurately without loose substring matches or premature partial settlement
      const targetOrderId = specificOrderId || (refId !== entityId ? refId : '');
      let remainingToAllocate = amount;
      const settledOrderIds = new Set<string>();

      setOrders(prev => prev.map(o => {
        if (!isOrderActive(o) || isOrderPaid(o)) return o;
        const orderVal = Number(o.adjustedTotalUSD || o.quotedTotalUSD || 0);

        if (targetOrderId && o.id === targetOrderId) {
          if (amount + 0.01 >= orderVal) {
            settledOrderIds.add(o.id);
            const updated = { ...o, paymentStatus: 'Paid' as const };
            orderRepository.save(updated).catch(err => {
              console.warn('[App] orderRepository save on AR payment failed:', err);
            });
            return updated;
          }
          return o;
        }

        if (!targetOrderId && cust) {
          const belongsToCustomer =
            o.customerId === entityId ||
            o.clientName.toLowerCase().trim() === cust.name.toLowerCase().trim() ||
            o.clientName.toLowerCase().trim() === cust.companyName.toLowerCase().trim();
          if (belongsToCustomer && remainingToAllocate + 0.01 >= orderVal) {
            remainingToAllocate = Number((remainingToAllocate - orderVal).toFixed(2));
            settledOrderIds.add(o.id);
            const updated = { ...o, paymentStatus: 'Paid' as const };
            orderRepository.save(updated).catch(err => {
              console.warn('[App] orderRepository save on AR FIFO settlement failed:', err);
            });
            return updated;
          }
        }
        return o;
      }));

      // Retire matching Pending accrual entries in state so cash isn't double-counted
      if (settledOrderIds.size > 0) {
        setFinancialEntries(prev =>
          prev.map(entry =>
            settledOrderIds.has(entry.referenceId) && entry.status === 'Pending'
              ? { ...entry, status: 'Settled' as const }
              : entry
          )
        );
      }

      // Log Financial Settlement Entry
      const receiptNum = `REC-${Date.now().toString().slice(-6)}`;
      const newEntry: FinancialLedgerEntry = {
        id: `FIN-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: notes
          ? `Customer AR Settlement Received - ${cust?.name || entityId} (${notes})`
          : specificOrderId
          ? `Customer AR Settlement Received - ${cust?.name || entityId} (Order #${specificOrderId})`
          : `Customer AR Settlement Received - ${cust?.name || entityId}`,
        referenceId: refId.startsWith('PMT') ? refId : `PMT-AR-${refId}`,
        entityName: cust?.name || 'Customer Account',
        amount: amount,
        paymentMethod: paymentMethod || 'Bank Wire Transfer',
        status: 'Settled',
        customerId: entityId,
        notes: notes,
        receiptNumber: receiptNum
      };
      setFinancialEntries(prev => [newEntry, ...prev]);
      financialRepository.addEntry(newEntry).catch(err => {
        console.warn('[App] financialRepository addEntry error for AR settlement:', err);
      });

      addNotification({
        type: 'order_update',
        title: `AR Payment Collected: ${formatAppCurrency(amount)}`,
        message: `Receivable posted to ledger for ${cust?.name || entityId} (${paymentMethod}). Receipt #${receiptNum}`,
        urgency: 'low'
      });
    } else {
      const sup = suppliers.find(s => s.id === entityId);

      // Settle AP Supplier Bill
      setSuppliers(prev => prev.map(s => {
        if (s.id === entityId) {
          const updatedSup: Supplier = {
            ...s,
            outstandingPayableUSD: Math.max(0, Number((s.outstandingPayableUSD - amount).toFixed(2)))
          };
          supplierRepository.save(updatedSup, false).catch(err => {
            console.warn('[App] supplierRepository save on AP settlement failed:', err);
          });
          return updatedSup;
        }
        return s;
      }));

      // Allocate payout accurately across specific PO or unpaid supplier POs FIFO & persist to Supabase
      const targetPOId = specificOrderId || (refId !== entityId ? refId : '');
      let remainingAP = amount;
      const settledPoIds = new Set<string>();

      setPurchaseOrders(prev => prev.map(po => {
        if (po.paymentStatus === 'Paid in Full') return po;

        if (targetPOId && po.id === targetPOId) {
          const nextStatus: PurchaseOrderLanding['paymentStatus'] =
            amount + 0.01 >= po.totalCostUSD ? 'Paid in Full' : 'Partial Paid';
          const updatedPO = { ...po, paymentStatus: nextStatus };
          if (nextStatus === 'Paid in Full') settledPoIds.add(po.id);
          purchaseOrderRepository.savePurchaseOrderWithItems(updatedPO, false).catch(err => {
            console.warn('[App] purchaseOrderRepository save on AP settlement failed:', err);
          });
          return updatedPO;
        }

        if (!targetPOId && po.supplierId === entityId && remainingAP > 0.001) {
          const nextStatus: PurchaseOrderLanding['paymentStatus'] =
            remainingAP + 0.01 >= po.totalCostUSD ? 'Paid in Full' : 'Partial Paid';
          remainingAP = Math.max(0, Number((remainingAP - po.totalCostUSD).toFixed(2)));
          const updatedPO = { ...po, paymentStatus: nextStatus };
          if (nextStatus === 'Paid in Full') settledPoIds.add(po.id);
          purchaseOrderRepository.savePurchaseOrderWithItems(updatedPO, false).catch(err => {
            console.warn('[App] purchaseOrderRepository save on AP FIFO settlement failed:', err);
          });
          return updatedPO;
        }
        return po;
      }));

      if (settledPoIds.size > 0) {
        setFinancialEntries(prev =>
          prev.map(entry =>
            settledPoIds.has(entry.referenceId) && entry.status === 'Pending'
              ? { ...entry, status: 'Settled' as const }
              : entry
          )
        );
      }

      const voucherNum = refId.startsWith('VOUCH')
        ? refId
        : `VOUCH-${Date.now().toString().slice(-6)}`;

      const newEntry: FinancialLedgerEntry = {
        id: `FIN-${Date.now().toString().slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'COGS',
        category: 'COGS (Catch Intake)',
        description: notes
          ? `Harvester AP Settlement Wire - ${sup?.name || entityId} (${notes})`
          : specificOrderId
          ? `Harvester AP Settlement Wire - ${sup?.name || entityId} (PO #${specificOrderId})`
          : `Harvester AP Settlement Wire - ${sup?.name || entityId}`,
        referenceId: refId.startsWith('VOUCH') || refId.startsWith('PMT') ? refId : `PMT-AP-${refId}`,
        entityName: sup?.name || 'Harvester Co-op',
        amount: amount,
        paymentMethod: paymentMethod || 'Federal Wire Transfer / ACH',
        status: 'Settled',
        supplierId: entityId,
        voucherNumber: voucherNum,
        notes: notes
      };
      setFinancialEntries(prev => [newEntry, ...prev]);
      financialRepository.addEntry(newEntry).catch(err => {
        console.warn('[App] financialRepository addEntry error for AP settlement:', err);
      });

      addNotification({
        type: 'order_update',
        title: `Harvester Payout Disbursed: ${formatAppCurrency(amount)}`,
        message: `Settlement wire completed for ${sup?.name || entityId} (${paymentMethod}). Voucher #${voucherNum}`,
        urgency: 'low'
      });
    }
  };

  // Supplier AP Reversal / Void Handler
  const handleReverseSupplierPayment = (paymentEntryId: string, supplierId: string, amount: number, reason: string) => {
    // 1. Revert supplier balance: restore amount back to outstandingPayableUSD
    setSuppliers(prev => prev.map(sup => {
      if (sup.id === supplierId) {
        const restoredBal = sup.outstandingPayableUSD + amount;
        const updated: Supplier = { ...sup, outstandingPayableUSD: restoredBal };
        supplierRepository.save(updated, false).catch(err => {
          console.warn('[App] supplierRepository save on AP reversal failed:', err);
        });
        return updated;
      }
      return sup;
    }));

    // 2. Mark original payment entry as Overdue or add reversal note
    setFinancialEntries(prev => prev.map(entry => {
      if (entry.id === paymentEntryId) {
        return { ...entry, status: 'Overdue' as const, description: `${entry.description} [REVERSED: ${reason}]` };
      }
      return entry;
    }));

    // 3. Add Reversal Entry in financial ledger
    const sup = suppliers.find(s => s.id === supplierId);
    const reversalEntry: FinancialLedgerEntry = {
      id: `FIN-REV-AP-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'COGS',
      category: 'COGS (Catch Intake)',
      description: `Disbursement Reversal / Void - ${sup?.name || supplierId} (${reason})`,
      referenceId: `REV-${paymentEntryId}`,
      entityName: sup?.name || 'Harvester Fleet',
      amount: amount,
      paymentMethod: 'Wire Recall / Void',
      status: 'Settled',
      supplierId: supplierId,
      notes: reason,
      voucherNumber: `REV-${paymentEntryId}`
    };
    setFinancialEntries(prev => [reversalEntry, ...prev]);
    financialRepository.addEntry(reversalEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for AP reversal:', err);
    });

    addNotification({
      type: 'order_update',
      title: `Disbursement Voided: ${formatAppCurrency(amount)}`,
      message: `Reversal recorded for ${sup?.name || supplierId}. Reason: ${reason}`,
      urgency: 'medium'
    });
  };

  // Reversal / Void Payment Handler
  const handleReversePayment = (paymentEntryId: string, customerId: string, amount: number, reason: string) => {
    // 1. Revert customer balance: add amount back to outstandingBalanceUSD
    setCustomers(prev => prev.map(cust => {
      if (cust.id === customerId) {
        const restoredBal = cust.outstandingBalanceUSD + amount;
        customerRepository.updateFinancials(cust.id, restoredBal, cust.totalSpendUSD, cust.totalOrdersCount).catch(err => {
          console.warn('[App] customerRepository updateFinancials on AR reversal failed:', err);
        });
        return {
          ...cust,
          outstandingBalanceUSD: restoredBal
        };
      }
      return cust;
    }));

    // 2. Mark original payment entry as Reversed or add reversal offset
    setFinancialEntries(prev => prev.map(entry => {
      if (entry.id === paymentEntryId) {
        return { ...entry, status: 'Overdue' as const, description: `${entry.description} [REVERSED: ${reason}]` };
      }
      return entry;
    }));

    // 3. Add Reversal Entry in financial ledger (reverses Income cash receipt, never OpEx; positive amount per DB check constraint)
    const cust = customers.find(c => c.id === customerId);
    const reversalEntry: FinancialLedgerEntry = {
      id: `FIN-REV-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      category: 'Revenue (Wholesale)',
      description: `Payment Reversal / Void - ${cust?.name || customerId} (${reason})`,
      referenceId: `REV-${paymentEntryId}`,
      entityName: cust?.name || 'Customer Account',
      amount: Math.abs(amount),
      paymentMethod: 'Adjustment / Void',
      status: 'Settled',
      customerId: customerId,
      notes: reason
    };
    setFinancialEntries(prev => [reversalEntry, ...prev]);
    financialRepository.addEntry(reversalEntry).catch(err => {
      console.warn('[App] financialRepository addEntry error for AR reversal:', err);
    });

    addNotification({
      type: 'order_update',
      title: `Payment Reversed: ${formatAppCurrency(amount)}`,
      message: `Payment voided for ${cust?.name || customerId}. Reason: ${reason}`,
      urgency: 'medium'
    });
  };

  // Clear Reversal Entries from Supabase General Financial Ledger
  const handleClearReversalEntries = async () => {
    const res = await financialRepository.clearReversalEntries();

    if (res.requiresSqlMigration) {
      addNotification({
        type: 'system',
        title: 'Supabase SQL Migration Required to Delete Ledger Reversals',
        message: 'financial_ledger_entries is protected by an immutability trigger. Run supabase/CLEAR_REVERSALS_FINANCIAL_LEDGER.sql in Supabase SQL Editor, then click Clear Reversals again.',
        urgency: 'high'
      });
      return res;
    }

    if (res.source === 'supabase_rpc') {
      try {
        const fresh = await financialRepository.getEntries(isTenantUser ? [] : undefined);
        setFinancialEntries(fresh || []);
      } catch {
        setFinancialEntries(prev => prev.filter(e => !isReversalLedgerEntry(e)));
      }
    } else {
      setFinancialEntries(prev => prev.filter(e => !isReversalLedgerEntry(e)));
    }

    addNotification({
      type: 'system',
      title: `Cleared ${res.deletedCount} Reversal Entry(s)`,
      message:
        res.source === 'supabase_rpc'
          ? 'All reversal rows were removed from Supabase financial_ledger_entries.'
          : 'Reversal entries removed from local workspace cache.',
      urgency: 'low'
    });

    return res;
  };

  // Clear all Inventory Adjustment test entries from Supabase General Financial Ledger & Adjustment Audit Logs
  const handleClearInventoryAdjustmentEntries = async () => {
    const res = await financialRepository.clearInventoryAdjustmentEntries();

    if (res.requiresSqlMigration) {
      addNotification({
        type: 'system',
        title: 'Supabase SQL Migration Required to Delete Inventory Adjustment Ledger Entries',
        message: 'financial_ledger_entries is protected by enforce_insert_only_compliance(). Run supabase/CLEAR_INVENTORY_ADJUSTMENT_LEDGER.sql in Supabase SQL Editor, then retry.',
        urgency: 'high'
      });
      return res;
    }

    if (res.source === 'supabase_rpc') {
      try {
        const fresh = await financialRepository.getEntries(isTenantUser ? [] : undefined);
        setFinancialEntries(fresh || []);
      } catch {
        setFinancialEntries(prev => prev.filter(e => !isInventoryAdjustmentLedgerEntry(e)));
      }
      try {
        const freshAccounts = await adjustmentAccountRepository.getAccounts(
          isTenantUser ? INITIAL_ADJUSTMENT_ACCOUNTS : INITIAL_ADJUSTMENT_ACCOUNTS
        );
        setAdjustmentAccounts(freshAccounts || INITIAL_ADJUSTMENT_ACCOUNTS);
      } catch {
        setAdjustmentAccounts(prev => prev.map(acc => ({ ...acc, balanceUSD: 0 })));
      }
    } else {
      setFinancialEntries(prev => prev.filter(e => !isInventoryAdjustmentLedgerEntry(e)));
      setAdjustmentAccounts(prev => {
        const reset = prev.map(acc => ({ ...acc, balanceUSD: 0 }));
        adjustmentAccountRepository.setLocalCache(reset, activeOrgId || undefined);
        return reset;
      });
    }

    setStockAdjustments([]);
    if (activeOrgId) {
      stockAdjustmentRepository.setLocalCache([], activeOrgId);
    }

    addNotification({
      type: 'system',
      title: `Cleared ${res.deletedCount} Inventory Adjustment Entry(s)`,
      message:
        res.source === 'supabase_rpc'
          ? 'All Inventory Adjustment ledger rows and audit logs were deleted from Supabase.'
          : 'All Inventory Adjustment ledger rows were cleared from local workspace cache.',
      urgency: 'low'
    });

    return res;
  };

  // Delete specific nuisance / erroneous entries from Supabase General Financial Ledger
  const handleDeleteFinancialEntries = async (entryIds: string[]) => {
    const res = await financialRepository.deleteEntriesByIds(entryIds);

    if (res.requiresSqlMigration) {
      addNotification({
        type: 'system',
        title: 'Supabase SQL Migration Required to Delete Ledger Entries',
        message: 'financial_ledger_entries is protected by enforce_insert_only_compliance(). Run supabase/DELETE_AMOAKO_INSPIREMEN_LEDGER.sql in Supabase SQL Editor first.',
        urgency: 'high'
      });
      return res;
    }

    const idSet = new Set(entryIds);
    if (res.source === 'supabase_rpc') {
      try {
        const fresh = await financialRepository.getEntries(isTenantUser ? [] : undefined);
        setFinancialEntries(fresh || []);
      } catch {
        setFinancialEntries(prev => prev.filter(e => !idSet.has(e.id)));
      }
    } else {
      setFinancialEntries(prev => prev.filter(e => !idSet.has(e.id)));
    }

    addNotification({
      type: 'system',
      title: `Deleted ${res.deletedCount} Financial Entry(s)`,
      message:
        res.source === 'supabase_rpc'
          ? 'Selected ledger rows were removed from Supabase financial_ledger_entries.'
          : 'Selected ledger rows were removed from local workspace cache.',
      urgency: 'low'
    });

    return res;
  };

  // Edit / Update an Operating Expense in Supabase financial_ledger_entries
  const handleUpdateExpense = async (updatedExpense: FinancialLedgerEntry) => {
    const res = await financialRepository.updateExpenseEntry(updatedExpense);

    if (res.requiresSqlMigration) {
      addNotification({
        type: 'system',
        title: 'Supabase SQL Migration Required to Edit Expenses',
        message: 'financial_ledger_entries is protected by enforce_insert_only_compliance(). Run supabase/migrations/034_update_financial_ledger_expense_rpc.sql in Supabase SQL Editor first.',
        urgency: 'high'
      });
      return res;
    }

    if (res.source === 'supabase_rpc') {
      try {
        const fresh = await financialRepository.getEntries(isTenantUser ? [] : undefined);
        setFinancialEntries(fresh || []);
      } catch {
        setFinancialEntries(prev => prev.map(e => (e.id === updatedExpense.id ? res.updatedEntry : e)));
      }
    } else {
      setFinancialEntries(prev => prev.map(e => (e.id === updatedExpense.id ? res.updatedEntry : e)));
    }

    addNotification({
      type: 'system',
      title: `Expense Updated: ${formatAppCurrency(res.updatedEntry.amount)}`,
      message: `${res.updatedEntry.category} (${res.updatedEntry.description}) updated.`,
      urgency: 'low'
    });

    return res;
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
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col selection:bg-indigo-500 selection:text-white w-full max-w-full overflow-x-hidden">
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
        onOpenRecordExpenseModal={() => setIsRecordExpenseModalOpen(true)}
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

      {/* Trial and Days Count Status Banner - shown only during active evaluation trial */}
      {staffProfile?.organization?.subscription_status === 'trial' && (
        <TrialCountdownBanner
          organization={staffProfile.organization}
          onUpgradeClick={() => {
            setActiveTab('settings');
            setSettingsCategory('subscription');
          }}
        />
      )}

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

      {/* Main Content Area - with mobile bottom safe area padding and overflow protection */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8 min-w-0 max-w-full overflow-x-hidden">
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
            onOpenRecordExpense={() => setIsRecordExpenseModalOpen(true)}
            useImperial={useImperial}
            companyName={companyName}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            orders={orders}
            batches={batches}
            customers={customers}
            onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
            onOpenWeigher={(o) => setWeigherOrder(o)}
            onOpenInvoice={(o) => setInvoiceOrder(o)}
            onAdvanceOrderStatus={handleAdvanceOrderStatus}
            onEditOrder={(o) => setEditingOrder(o)}
            onEditQuote={(o) => setEditingQuoteOrder(o)}
            onDeleteOrder={(o) => setDeletingOrder(o)}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            useImperial={useImperial}
            companyName={companyName}
            formatCurrency={formatAppCurrency}
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
            onEditOrder={(o) => setEditingOrder(o)}
            onEditQuote={(o) => setEditingQuoteOrder(o)}
            onDeleteOrder={(o) => setDeletingOrder(o)}
            onUpdatePaymentStatus={handleUpdatePaymentStatus}
            onUpdateProductPricing={handleUpdateProductPricing}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onNavigateToInventory={() => setActiveTab('inventory')}
            formatCurrency={formatAppCurrency}
            useImperial={useImperial}
            settings={settings}
            companyName={companyName}
            stockAdjustments={stockAdjustments}
            purchaseOrders={purchaseOrders}
            onReconcileCatalog={handleReconcileCatalog}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            orders={orders}
            financialEntries={financialEntries}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onSelectCustomerForOrder={handleSelectCustomerForOrder}
            onRecordPayment={handleRecordPayment}
            onReversePayment={handleReversePayment}
            onOpenInvoice={(o) => setInvoiceOrder(o)}
            onVoidOrder={handleVoidOrder}
            onDeleteCustomer={handleDeleteCustomer}
            onUpdateCustomerStatus={handleUpdateCustomerStatus}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            batches={batches}
            settings={settings}
            financialEntries={financialEntries}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onAddPurchaseOrder={handleAddPurchaseOrder}
            onUpdatePurchaseOrder={handleUpdatePurchaseOrder}
            onRecordPayment={handleRecordPayment}
            onReversePayment={handleReverseSupplierPayment}
            onDeleteSupplier={handleDeleteSupplier}
            onUpdateSupplierStatus={handleUpdateSupplierStatus}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'financials' && (
          <FinancialsView
            orders={orders}
            purchaseOrders={purchaseOrders}
            retailSales={retailSales}
            batches={batches}
            products={products}
            customers={customers}
            suppliers={suppliers}
            financialEntries={financialEntries}
            adjustmentAccounts={adjustmentAccounts}
            stockAdjustments={stockAdjustments}
            onRecordPayment={handleRecordPayment}
            onAddExpense={handleAddExpense}
            onSaveAdjustmentAccount={handleSaveAdjustmentAccount}
            onClearReversalEntries={handleClearReversalEntries}
            onClearInventoryAdjustmentEntries={handleClearInventoryAdjustmentEntries}
            onDeleteFinancialEntries={handleDeleteFinancialEntries}
            onUpdateExpense={handleUpdateExpense}
            companyName={companyName}
            currencySymbol={settings.currency || 'GHS'}
            formatCurrency={formatAppCurrency}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryLedgerView
            batches={batches}
            products={products}
            orders={orders}
            purchaseOrders={purchaseOrders}
            adjustmentAccounts={adjustmentAccounts}
            stockAdjustments={stockAdjustments}
            companyName={companyName}
            currencySymbol={settings.currency || 'GHS'}
            formatCurrency={formatAppCurrency}
            onOpenPassport={(b) => setPassportBatch(b)}
            onOpenNewBatch={() => setIsNewBatchModalOpen(true)}
            onUpdateBatch={handleUpdateBatch}
            onDeleteBatch={handleDeleteBatch}
            onSaveAdjustmentAccount={handleSaveAdjustmentAccount}
            defaultAdjustmentAccountCode={settings.defaultAdjustmentAccountCode || '5150'}
            onNavigateToRetail={() => setActiveTab('retail_wholesale')}
            onReconcileCatalog={handleReconcileCatalog}
            onRefreshFromSupabase={handleRefreshInventoryFromSupabase}
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
          companyName={companyName}
          onClose={() => setInvoiceOrder(null)}
          useImperial={useImperial}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
          onRecordPayment={handleRecordPayment}
        />
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          batches={batches}
          customers={customers}
          settings={settings}
          onClose={() => setEditingOrder(null)}
          onSaveOrder={handleSaveOrder}
          useImperial={useImperial}
        />
      )}

      {editingQuoteOrder && (
        <EditQuoteModal
          order={editingQuoteOrder}
          batches={batches}
          settings={settings}
          onClose={() => setEditingQuoteOrder(null)}
          onSaveQuote={handleSaveQuote}
          useImperial={useImperial}
        />
      )}

      {deletingOrder && (
        <DeleteOrderModal
          order={deletingOrder}
          onClose={() => setDeletingOrder(null)}
          onConfirmDelete={handleDeleteOrder}
        />
      )}

      {isNewBatchModalOpen && (
        <NewBatchModal
          onClose={() => setIsNewBatchModalOpen(false)}
          onAddBatch={handleAddBatch}
          useImperial={useImperial}
          existingBatches={batches}
          settings={settings}
        />
      )}

      {isNewOrderModalOpen && (
        <NewOrderModal
          batches={batches}
          customers={customers}
          settings={settings}
          preselectedCustomerId={preselectedCustomerId}
          onClose={() => {
            setIsNewOrderModalOpen(false);
            setPreselectedCustomerId(null);
          }}
          onAddOrder={handleAddOrder}
          useImperial={useImperial}
        />
      )}

      {isRecordExpenseModalOpen && (
        <RecordExpenseModal
          isOpen={isRecordExpenseModalOpen}
          onClose={() => setIsRecordExpenseModalOpen(false)}
          onAddExpense={handleAddExpense}
          currency={settings.currency}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAlertCount={0}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isInstalled={isInstalled}
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
