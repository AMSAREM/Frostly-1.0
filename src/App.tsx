import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { RetailWholesaleView } from './components/RetailWholesaleView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { FinancialsView } from './components/FinancialsView';
import { InventoryLedgerView } from './components/InventoryLedgerView';
import { SettingsView } from './components/SettingsView';

import { TraceabilityPassportModal } from './components/Modals/TraceabilityPassportModal';
import { CatchWeightWeigherModal } from './components/Modals/CatchWeightWeigherModal';
import { InvoiceModal } from './components/Modals/InvoiceModal';
import { NewBatchModal } from './components/Modals/NewBatchModal';
import { NewOrderModal } from './components/Modals/NewOrderModal';

import { PWAInstallModal } from './components/PWAInstallModal';
import { PWAStatusBanner } from './components/PWAStatusBanner';
import { MobileBottomNav } from './components/MobileBottomNav';
import { usePWAInstall, useNetworkStatus } from './utils/pwa';

import { 
  INITIAL_BATCHES, 
  INITIAL_ORDERS, 
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PRODUCTS,
  INITIAL_RETAIL_TRANSACTIONS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_FINANCIAL_ENTRIES,
  INITIAL_NOTIFICATIONS 
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
  DEFAULT_SETTINGS 
} from './types';
import { formatCurrency } from './utils/formatters';
import { batchRepository } from './repositories/batchRepository';
import { syncManager } from './sync/syncManager';

export default function App() {
  // PWA and Network state
  const { isInstallable, isInstalled, isIOS, isStandalone, triggerInstall } = usePWAInstall();
  const { isOnline } = useNetworkStatus();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

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
      if (tabParam && ['dashboard', 'retail_wholesale', 'customers', 'suppliers', 'financials', 'inventory', 'settings'].includes(tabParam)) {
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

  // Safe local storage load helper (Purges previous v2 seeded mock data)
  const [batches, setBatches] = useState<InventoryBatch[]>(() => {
    try {
      localStorage.removeItem('frostly_batches_v2');
      const saved = localStorage.getItem('frostly_batches_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_BATCHES;
    } catch {
      return INITIAL_BATCHES;
    }
  });

  const [orders, setOrders] = useState<ClientOrder[]>(() => {
    try {
      localStorage.removeItem('frostly_orders_v2');
      const saved = localStorage.getItem('frostly_orders_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_ORDERS;
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      localStorage.removeItem('frostly_customers_v2');
      const saved = localStorage.getItem('frostly_customers_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      localStorage.removeItem('frostly_suppliers_v2');
      const saved = localStorage.getItem('frostly_suppliers_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_SUPPLIERS;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [products, setProducts] = useState<RetailWholesaleProduct[]>(() => {
    try {
      localStorage.removeItem('frostly_products_v2');
      const saved = localStorage.getItem('frostly_products_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [retailSales, setRetailSales] = useState<RetailTransaction[]>(() => {
    try {
      localStorage.removeItem('frostly_retail_sales_v2');
      const saved = localStorage.getItem('frostly_retail_sales_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_RETAIL_TRANSACTIONS;
    } catch {
      return INITIAL_RETAIL_TRANSACTIONS;
    }
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderLanding[]>(() => {
    try {
      localStorage.removeItem('frostly_purchase_orders_v2');
      const saved = localStorage.getItem('frostly_purchase_orders_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_PURCHASE_ORDERS;
    } catch {
      return INITIAL_PURCHASE_ORDERS;
    }
  });

  const [financialEntries, setFinancialEntries] = useState<FinancialLedgerEntry[]>(() => {
    try {
      localStorage.removeItem('frostly_financial_entries_v2');
      const saved = localStorage.getItem('frostly_financial_entries_v3');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_FINANCIAL_ENTRIES;
    } catch {
      return INITIAL_FINANCIAL_ENTRIES;
    }
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);

  // Modals state
  const [passportBatch, setPassportBatch] = useState<InventoryBatch | null>(null);
  const [weigherOrder, setWeigherOrder] = useState<ClientOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<ClientOrder | null>(null);
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // Hydrate batches from repository on mount (with live Supabase sync when online & authenticated)
  useEffect(() => {
    let isMounted = true;
    batchRepository.getBatches(batches).then(fresh => {
      if (isMounted && fresh && fresh.length > 0) {
        setBatches(fresh);
      }
    }).catch(err => {
      console.warn('[App] Batch repository load error:', err);
    });
    return () => { isMounted = false; };
  }, []);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('frostly_batches_v3', JSON.stringify(batches));
  }, [batches]);

  useEffect(() => {
    localStorage.setItem('frostly_orders_v3', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('frostly_customers_v3', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('frostly_suppliers_v3', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('frostly_products_v3', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('frostly_retail_sales_v3', JSON.stringify(retailSales));
  }, [retailSales]);

  useEffect(() => {
    localStorage.setItem('frostly_purchase_orders_v3', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  useEffect(() => {
    localStorage.setItem('frostly_financial_entries_v3', JSON.stringify(financialEntries));
  }, [financialEntries]);

  useEffect(() => {
    localStorage.setItem('frostly_settings_v3', JSON.stringify(settings));
  }, [settings]);

  // Settings & Data Management Handlers
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    setUseImperial(newSettings.useImperial);
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
    if (imported.batches) setBatches(imported.batches);
    if (imported.orders) setOrders(imported.orders);
    if (imported.customers) setCustomers(imported.customers);
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
  };

  const addNotification = (notif: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: SystemNotification = {
      ...notif,
      id: 'notif-' + Date.now(),
      timestamp: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
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

  // Add Order Handler
  const handleAddOrder = (newOrder: ClientOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    
    // Update customer spend and balance if matched
    setCustomers(prev => prev.map(cust => {
      if (cust.name.toLowerCase() === newOrder.clientName.toLowerCase() || cust.companyName.toLowerCase() === newOrder.clientName.toLowerCase()) {
        const orderVal = newOrder.quotedTotalUSD;
        return {
          ...cust,
          totalOrdersCount: cust.totalOrdersCount + 1,
          totalSpendUSD: cust.totalSpendUSD + orderVal,
          outstandingBalanceUSD: cust.outstandingBalanceUSD + orderVal
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
      description: `Wholesale Order Placed - ${newOrder.clientName} (${newOrder.id})`,
      referenceId: newOrder.id,
      entityName: newOrder.clientName,
      amount: newOrder.quotedTotalUSD,
      paymentMethod: 'Invoiced Net Terms',
      status: 'Pending'
    };
    setFinancialEntries(prev => [newFinEntry, ...prev]);

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
      return {
        ...order,
        items: updatedItems,
        adjustedTotalUSD: adjustedTotal,
        status: order.status === 'Pending Confirmation' ? 'Weighing & Grading' : order.status
      };
    }));

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
      return { ...o, status: nextStatus };
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
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: status } : o));
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
    addNotification({
      type: 'order_update',
      title: `New Customer Enrolled: ${newCust.name}`,
      message: `${newCust.companyName} registered with ${newCust.tier}. Credit Limit: $${newCust.creditLimitUSD.toLocaleString()}.`,
      urgency: 'low'
    });
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCust.id ? updatedCust : c));
  };

  const handleSelectCustomerForOrder = (customer: Customer) => {
    setIsNewOrderModalOpen(true);
  };

  // Supplier Management Handlers
  const handleAddSupplier = (newSup: Supplier) => {
    setSuppliers(prev => [newSup, ...prev]);
    addNotification({
      type: 'order_update',
      title: `New Harvester Supplier Added`,
      message: `${newSup.name} (${newSup.portLocation}) registered.`,
      urgency: 'low'
    });
  };

  const handleAddPurchaseOrder = (newPO: PurchaseOrderLanding) => {
    setPurchaseOrders(prev => [newPO, ...prev]);

    // Update Supplier totals
    setSuppliers(prev => prev.map(sup => {
      if (sup.id === newPO.supplierId) {
        const item = newPO.speciesItems[0];
        return {
          ...sup,
          totalPurchasedUSD: sup.totalPurchasedUSD + newPO.totalCostUSD,
          outstandingPayableUSD: sup.outstandingPayableUSD + newPO.totalCostUSD,
          totalWeightSuppliedKg: sup.totalWeightSuppliedKg + (item ? item.weightKg : 0)
        };
      }
      return sup;
    }));

    // Add to Inventory Batches
    const item = newPO.speciesItems[0];
    if (item) {
      const newBatch: InventoryBatch = {
        id: newPO.lotAssignedId,
        speciesId: 'spec-landed',
        speciesName: item.speciesName,
        scientificName: 'Harvest Catch Provenance',
        category: item.speciesName.includes('Salmon') ? 'Salmonid' : item.speciesName.includes('Crab') || item.speciesName.includes('Lobster') || item.speciesName.includes('Prawn') ? 'Crustacean' : item.speciesName.includes('Scallop') ? 'Mollusk' : 'Pelagic',
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

    // Deduct stock from products
    setProducts(prev => prev.map(prod => {
      const soldItem = sale.items.find(i => i.productId === prod.id);
      if (soldItem) {
        return {
          ...prod,
          stockKg: Math.max(0, parseFloat((prod.stockKg - (prod.unit === 'pack' ? soldItem.quantity * 0.5 : soldItem.quantity)).toFixed(1)))
        };
      }
      return prod;
    }));

    // Add Income ledger entry
    const newFinEntry: FinancialLedgerEntry = {
      id: `FIN-${Date.now().toString().slice(-4)}`,
      date: sale.date.split(' ')[0],
      type: 'Income',
      category: 'Revenue (Retail POS)',
      description: `Retail Counter Sale - ${sale.receiptNumber} (${sale.customerName})`,
      referenceId: sale.id,
      entityName: sale.customerName,
      amount: sale.totalAmount,
      paymentMethod: sale.paymentMethod,
      status: 'Settled'
    };
    setFinancialEntries(prev => [newFinEntry, ...prev]);

    addNotification({
      type: 'order_update',
      title: `Retail POS Sale: $${sale.totalAmount.toFixed(2)}`,
      message: `Receipt ${sale.receiptNumber} processed via ${sale.paymentMethod}.`,
      urgency: 'low'
    });
  };

  const handleUpdateProductPricing = (productId: string, wholesalePrice: number, retailPrice: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          wholesalePricePerUnit: wholesalePrice,
          retailPricePerUnit: retailPrice
        };
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

  // Universal Payment & Settle Ledger Handler (AR / AP)
  const handleRecordPayment = (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => {
    if (type === 'AR') {
      // Customer paid receivable
      setCustomers(prev => prev.map(cust => {
        if (cust.id === entityId) {
          return {
            ...cust,
            outstandingBalanceUSD: Math.max(0, cust.outstandingBalanceUSD - amount)
          };
        }
        return cust;
      }));

      // Update Order payment status if order ID passed
      setOrders(prev => prev.map(o => {
        if (o.id === refId || o.clientName.toLowerCase().includes(entityId.toLowerCase())) {
          return { ...o, paymentStatus: 'Paid' };
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
          return {
            ...sup,
            outstandingPayableUSD: Math.max(0, sup.outstandingPayableUSD - amount)
          };
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
      />

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
          />
        )}

        {activeTab === 'retail_wholesale' && (
          <RetailWholesaleView
            products={products}
            retailSales={retailSales}
            wholesaleOrders={orders}
            customers={customers}
            onCompleteRetailSale={handleCompleteRetailSale}
            onOpenNewWholesaleOrder={() => setIsNewOrderModalOpen(true)}
            onOpenWeigher={(o) => setWeigherOrder(o)}
            onOpenInvoice={(o) => setInvoiceOrder(o)}
            onUpdateProductPricing={handleUpdateProductPricing}
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
            onOpenPassport={(b) => setPassportBatch(b)}
            onOpenNewBatch={() => setIsNewBatchModalOpen(true)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            useImperial={useImperial}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            batches={batches}
            orders={orders}
            customers={customers}
            suppliers={suppliers}
            products={products}
            retailSales={retailSales}
            purchaseOrders={purchaseOrders}
            financialEntries={financialEntries}
            onRestoreAllData={handleRestoreAllData}
            onResetToDefaults={handleResetToDefaults}
          />
        )}
      </main>

      {/* Modals */}
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
          onClose={() => setInvoiceOrder(null)}
          useImperial={useImperial}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
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
          onClose={() => setIsNewOrderModalOpen(false)}
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
    </div>
  );
}
