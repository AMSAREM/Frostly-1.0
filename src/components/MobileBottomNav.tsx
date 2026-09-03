import React, { useState } from 'react';
import { 
  Anchor, 
  ShoppingBag, 
  Users, 
  Ship, 
  DollarSign, 
  Package,
  Settings,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { ActiveTab } from './Header';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeAlertCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  activeAlertCount
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const primaryTabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Overview', icon: <Anchor className="w-5 h-5" /> },
    { id: 'retail_wholesale', label: 'POS & Sales', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-5 h-5" />, badge: activeAlertCount > 0 ? activeAlertCount : undefined },
    { id: 'financials', label: 'Financials', icon: <DollarSign className="w-5 h-5" /> },
  ];

  const moreItems: { id: ActiveTab; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'customers', label: 'Customer Directory & CRM', description: 'Restaurant accounts, credit limits & aging AR', icon: <Users className="w-5 h-5 text-indigo-600" /> },
    { id: 'suppliers', label: 'Suppliers & Catch Landings', description: 'Harvester fleet co-ops, dock receipts & AP', icon: <Ship className="w-5 h-5 text-blue-600" /> },
    { id: 'settings', label: 'System Settings & HACCP', description: 'Cold-chain thresholds, facility profile & data backups', icon: <Settings className="w-5 h-5 text-slate-700" /> },
  ];

  const isMoreActive = activeTab === 'customers' || activeTab === 'suppliers' || activeTab === 'settings';

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* Mobile "More" Slide-up Drawer */}
      {showMoreMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-t-3xl p-5 pb-8 space-y-4 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom-5 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="font-heading font-extrabold text-base text-slate-900">
                  Frostly ERP Modules
                </div>
                <p className="text-[11px] text-slate-500">Quick access to suppliers, CRM & system settings</p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {moreItems.map((item) => {
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`mobile-more-tab-${item.id}`}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                        : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-200/60">
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.label}</div>
                        <div className="text-[11px] text-slate-500">{item.description}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-lg">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`mobile-tab-${tab.id}`}
                onClick={() => handleSelectTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center h-full py-1 relative transition-colors cursor-pointer ${
                  isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="relative">
                  <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                    {tab.icon}
                  </span>
                  {tab.badge && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] tracking-tight mt-1 transition-all ${
                  isActive ? 'font-bold text-indigo-700' : 'font-medium'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-indigo-600" />
                )}
              </button>
            );
          })}

          {/* "More" Trigger Tab Button */}
          <button
            id="mobile-tab-more"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex-1 flex flex-col items-center justify-center h-full py-1 relative transition-colors cursor-pointer ${
              isMoreActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className="relative">
              <span className={`transition-transform duration-200 ${isMoreActive ? 'scale-110' : ''}`}>
                <Menu className="w-5 h-5" />
              </span>
              {isMoreActive && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </div>
            <span className={`text-[10px] tracking-tight mt-1 transition-all ${
              isMoreActive ? 'font-bold text-indigo-700' : 'font-medium'
            }`}>
              More
            </span>
            {isMoreActive && (
              <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-indigo-600" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
};

