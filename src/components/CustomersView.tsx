import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  CreditCard, 
  ShoppingBag, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { Customer, ClientOrder, CustomerType, PricingTier, PaymentTerms } from '../types';

interface CustomersViewProps {
  customers: Customer[];
  orders: ClientOrder[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onSelectCustomerForOrder: (customer: Customer) => void;
  onRecordPayment: (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => void;
  formatCurrency: (amount: number) => string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers = [],
  orders = [],
  onAddCustomer,
  onUpdateCustomer,
  onSelectCustomerForOrder,
  onRecordPayment,
  formatCurrency
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState<boolean>(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newType, setNewType] = useState<CustomerType>('Wholesale Restaurant');
  const [newTier, setNewTier] = useState<PricingTier>('Tier 1 (VIP Wholesale -15%)');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('50000');
  const [newTerms, setNewTerms] = useState<PaymentTerms>('Net-30');
  const [newNotes, setNewNotes] = useState('');

  // Aggregations
  const totalReceivables = customers.reduce((sum, c) => sum + c.outstandingBalanceUSD, 0);
  const totalSpendAll = customers.reduce((sum, c) => sum + c.totalSpendUSD, 0);

  const filteredCustomers = customers.filter(cust => {
    const matchesType = filterType === 'all' || cust.type === filterType;
    const matchesSearch = 
      cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const newCust: Customer = {
      id: `CUST-${(customers.length + 101).toString()}`,
      name: newName.trim(),
      companyName: newCompany.trim() || newName.trim(),
      type: newType,
      tier: newTier,
      contactPerson: newContact.trim() || 'Purchasing Agent',
      email: newEmail.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim(),
      city: newCity.trim() || 'San Francisco, CA',
      creditLimitUSD: parseFloat(newCreditLimit) || 25000,
      outstandingBalanceUSD: 0,
      paymentTerms: newTerms,
      totalOrdersCount: 0,
      totalSpendUSD: 0,
      status: 'Active',
      notes: newNotes.trim(),
      joinedDate: new Date().toISOString().split('T')[0]
    };

    onAddCustomer(newCust);
    setIsAddCustomerModalOpen(false);
    // Reset Form
    setNewName('');
    setNewCompany('');
    setNewContact('');
    setNewEmail('');
    setNewPhone('');
    setNewAddress('');
    setNewCity('');
    setNewNotes('');
  };

  const handleOpenPayment = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount(customer.outstandingBalanceUSD.toString());
    setIsRecordPaymentModalOpen(true);
  };

  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;

    onRecordPayment('AR', selectedCustomer.id, amt, selectedCustomer.id);
    setIsRecordPaymentModalOpen(false);
  };

  // Get orders specific to selected customer
  const customerOrders = selectedCustomer 
    ? orders.filter(o => o.clientName.toLowerCase().includes(selectedCustomer.name.toLowerCase()) || o.clientName.toLowerCase().includes(selectedCustomer.companyName.toLowerCase()))
    : [];

  return (
    <div className="space-y-6">
      {/* Header with Search and Add Customer Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-100/80 text-indigo-700 rounded-xl">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer CRM & Accounts</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage wholesale restaurants, hotel chains, supermarket buyers, and VIP retail accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-add-customer"
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* CRM Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Client Accounts</div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">{customers.length} Accounts</div>
          <div className="text-xs text-slate-500">100% active credit standing</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Receivables (AR)</div>
          <div className="text-2xl font-black text-amber-700 font-mono-code">{formatCurrency(totalReceivables)}</div>
          <div className="text-xs text-slate-500">Awaiting Net-15 / Net-30 collection</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Lifetime Volume</div>
          <div className="text-2xl font-black text-emerald-700 font-mono-code">{formatCurrency(totalSpendAll)}</div>
          <div className="text-xs text-slate-500">Across all B2B & VIP retail orders</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Credit Line</div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(customers.reduce((s, c) => s + c.creditLimitUSD, 0) / (customers.length || 1))}
          </div>
          <div className="text-xs text-slate-500">Secured wholesale accounts</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers by name, company, contact or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-medium shrink-0">Type:</span>
          {['all', 'Wholesale Restaurant', 'Hotel & Resort', 'Supermarket / Retailer', 'Fishmonger / Distributor', 'Direct Retail VIP'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                filterType === t
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'all' ? 'All Accounts' : t.split(' / ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Customer Cards (Phones & Small screens) */}
      <div className="space-y-3 md:hidden">
        {filteredCustomers.map((cust) => {
          const isOverdue = cust.outstandingBalanceUSD > 0;
          return (
            <div key={cust.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>{cust.name}</span>
                    {cust.type?.includes('Wholesale') && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                        B2B
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{cust.companyName}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  cust.tier?.includes('VIP')
                    ? 'bg-purple-100 text-purple-800'
                    : cust.tier?.includes('Standard')
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  {cust.tier || 'Standard'}
                </span>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{cust.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{cust.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Balance Due</span>
                  {isOverdue ? (
                    <span className="font-mono-code font-black text-rose-600">{formatCurrency(cust.outstandingBalanceUSD)}</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">$0.00</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Spent</span>
                  <span className="font-mono-code font-bold text-slate-900">{formatCurrency(cust.totalSpendUSD)}</span>
                  <span className="text-slate-400 text-[10px] block font-normal">{cust.totalOrdersCount} orders</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setSelectedCustomer(cust)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold text-center cursor-pointer"
                >
                  View Profile
                </button>
                {isOverdue ? (
                  <button
                    onClick={() => handleOpenPayment(cust)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer"
                  >
                    Receive Pay
                  </button>
                ) : (
                  <button
                    onClick={() => onSelectCustomerForOrder(cust)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center cursor-pointer"
                  >
                    New Order
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Customer Directory Table (Tablets & Desktop) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Customer & Business</th>
                <th className="py-3.5 px-4">Channel & Tier</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Terms & Credit</th>
                <th className="py-3.5 px-4 text-right">Balance Due</th>
                <th className="py-3.5 px-4 text-right">Total Spent</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((cust) => {
                const isOverdue = cust.outstandingBalanceUSD > 0;
                return (
                  <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{cust.name}</span>
                        {cust.type?.includes('Wholesale') && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                            B2B
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{cust.companyName}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-800">{cust.type}</div>
                      <div className="text-[10px] font-bold text-indigo-600 mt-0.5 flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />
                        <span>{cust.tier}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-medium text-slate-900">{cust.contactPerson}</div>
                      <div className="text-slate-400 text-[11px]">{cust.email}</div>
                      <div className="text-slate-400 text-[11px]">{cust.city}</div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">{cust.paymentTerms}</div>
                      <div className="text-slate-400 text-[11px]">Limit: {formatCurrency(cust.creditLimitUSD)}</div>
                    </td>

                    <td className="py-4 px-4 text-right font-mono-code">
                      {isOverdue ? (
                        <div>
                          <div className="font-bold text-amber-700 text-sm">
                            {formatCurrency(cust.outstandingBalanceUSD)}
                          </div>
                          <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                            Unpaid
                          </span>
                        </div>
                      ) : (
                        <div className="text-emerald-600 font-semibold">$0.00 (Current)</div>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right font-mono-code font-bold text-slate-900">
                      <div>{formatCurrency(cust.totalSpendUSD)}</div>
                      <div className="text-slate-400 text-[10px] font-normal">{cust.totalOrdersCount} orders</div>
                    </td>

                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedCustomer(cust)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        Profile
                      </button>

                      {isOverdue ? (
                        <button
                          onClick={() => handleOpenPayment(cust)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Pay
                        </button>
                      ) : (
                        <button
                          onClick={() => onSelectCustomerForOrder(cust)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Order
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Profile & Purchase History Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <p className="text-xs text-slate-500">{selectedCustomer.companyName} • Member since {selectedCustomer.joinedDate}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Profile Grid Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Pricing Tier</div>
                <div className="text-xs font-bold text-slate-900 mt-1">{selectedCustomer.tier}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Payment Terms</div>
                <div className="text-xs font-bold text-slate-900 mt-1">{selectedCustomer.paymentTerms}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Credit Limit</div>
                <div className="text-xs font-mono-code font-bold text-slate-900 mt-1">{formatCurrency(selectedCustomer.creditLimitUSD)}</div>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] text-amber-800 font-bold uppercase">Balance Due</div>
                <div className="text-xs font-mono-code font-bold text-amber-950 mt-1">{formatCurrency(selectedCustomer.outstandingBalanceUSD)}</div>
              </div>
            </div>

            {/* Contact & Location Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Primary Contact:</span>
                <span>{selectedCustomer.contactPerson}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Email:</span>
                <span className="font-mono-code text-indigo-600">{selectedCustomer.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Phone:</span>
                <span>{selectedCustomer.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Delivery Address:</span>
                <span>{selectedCustomer.address}, {selectedCustomer.city}</span>
              </div>
              {selectedCustomer.notes && (
                <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                  <strong>Notes:</strong> {selectedCustomer.notes}
                </div>
              )}
            </div>

            {/* Order History */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Order History & Invoices</h3>
              {customerOrders.length > 0 ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                  {customerOrders.map(order => (
                    <div key={order.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-900 font-mono-code mr-2">{order.id}</span>
                        <span className="text-slate-500">{order.orderDate}</span>
                        <div className="text-[11px] text-slate-400">
                          {order.items.map(i => `${i.speciesName} (${i.requestedWeightKg}kg)`).join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono-code font-bold text-slate-900">{formatCurrency(order.adjustedTotalUSD || order.quotedTotalUSD)}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
                  No previous orders logged for this client yet.
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              {selectedCustomer.outstandingBalanceUSD > 0 && (
                <button
                  onClick={() => {
                    const cust = selectedCustomer;
                    setSelectedCustomer(null);
                    handleOpenPayment(cust);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Record Payment Received ({formatCurrency(selectedCustomer.outstandingBalanceUSD)})
                </button>
              )}
              <button
                onClick={() => {
                  const cust = selectedCustomer;
                  setSelectedCustomer(null);
                  onSelectCustomerForOrder(cust);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Create New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add New Customer Account</h3>
              </div>
              <button 
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Brand Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Nobu Downtown"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Legal Company Entity</label>
                  <input
                    type="text"
                    placeholder="e.g. Nobu Hospitality Group LLC"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Customer Segment</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Wholesale Restaurant">Wholesale Restaurant</option>
                    <option value="Hotel & Resort">Hotel & Resort</option>
                    <option value="Supermarket / Retailer">Supermarket / Retailer</option>
                    <option value="Fishmonger / Distributor">Fishmonger / Distributor</option>
                    <option value="Direct Retail VIP">Direct Retail VIP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pricing Tier</label>
                  <select
                    value={newTier}
                    onChange={(e) => setNewTier(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Tier 1 (VIP Wholesale -15%)">Tier 1 (VIP Wholesale -15%)</option>
                    <option value="Tier 2 (Standard Wholesale)">Tier 2 (Standard Wholesale)</option>
                    <option value="Retail Standard">Retail Standard</option>
                    <option value="Contract Custom">Contract Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Chef Matsuhisa"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="orders@restaurant.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 (415) 000-0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    placeholder="San Francisco, CA"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Credit Limit ($ USD)</label>
                  <input
                    type="number"
                    step="1000"
                    value={newCreditLimit}
                    onChange={(e) => setNewCreditLimit(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={newTerms}
                    onChange={(e) => setNewTerms(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Net-30">Net-30</option>
                    <option value="Net-15">Net-15</option>
                    <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                    <option value="Instant Card/Cash">Instant Card/Cash</option>
                    <option value="Prepaid / Due on Receipt">Prepaid / Due on Receipt</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Address</label>
                <input
                  type="text"
                  placeholder="Street Address, Pier / Dock loading bay"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Special Handling / Order Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sashimi grade cutting requirements, morning delivery window..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Save & Activate Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isRecordPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Record Customer Payment</h3>
              </div>
              <button 
                onClick={() => setIsRecordPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Customer <strong>{selectedCustomer.name}</strong> has an outstanding receivable balance of <strong>{formatCurrency(selectedCustomer.outstandingBalanceUSD)}</strong>.
            </p>

            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount Received ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomer.outstandingBalanceUSD}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono-code font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecordPaymentModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Post Payment to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
