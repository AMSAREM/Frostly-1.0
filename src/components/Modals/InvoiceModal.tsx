import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  ThermometerSnowflake, 
  ShieldCheck, 
  Truck, 
  FileText,
  DollarSign,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { ClientOrder, Customer } from '../../types';
import { formatCurrency, formatWeight } from '../../utils/formatters';

interface InvoiceModalProps {
  order: ClientOrder | null;
  customers?: Customer[];
  onClose: () => void;
  useImperial: boolean;
  onUpdatePaymentStatus: (orderId: string, status: ClientOrder['paymentStatus']) => void;
  onRecordPayment?: (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => void;
}

interface InvoiceModalContentProps {
  order: ClientOrder;
  customers?: Customer[];
  onClose: () => void;
  useImperial: boolean;
  onUpdatePaymentStatus: (orderId: string, status: ClientOrder['paymentStatus']) => void;
  onRecordPayment?: (type: 'AR' | 'AP', entityId: string, amount: number, refId: string) => void;
}

const InvoiceModalContent: React.FC<InvoiceModalContentProps> = ({
  order,
  customers = [],
  onClose,
  useImperial,
  onUpdatePaymentStatus,
  onRecordPayment
}) => {
  const [copied, setCopied] = useState(false);

  // Match customer for credit facility details
  const matchedCustomer = customers.find(
    c => (order.customerId && c.id === order.customerId) ||
         c.name.toLowerCase() === order.clientName.toLowerCase() ||
         c.companyName.toLowerCase() === order.clientName.toLowerCase()
  );

  const handlePrint = () => {
    window.print();
  };

  const totalDue = order.adjustedTotalUSD || order.quotedTotalUSD;

  const handleCopySummary = () => {
    const text = `FROSTLY SEAFOOD CATCH-WEIGHT INVOICE\nOrder ID: ${order.id}\nClient: ${order.clientName}\nDestination: ${order.deliveryAddress}\nTotal Amount Due: ${formatCurrency(totalDue)}\nStatus: ${order.paymentStatus}\nTerms: ${order.paymentTerms || matchedCustomer?.paymentTerms || 'Net-30'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSettlePayment = () => {
    if (onRecordPayment && matchedCustomer) {
      onRecordPayment('AR', matchedCustomer.id, totalDue, order.id);
    } else {
      onUpdatePaymentStatus(order.id, 'Paid');
    }
  };

  const subtotal = order.adjustedTotalUSD || order.quotedTotalUSD;
  const isCreditSale = order.saleType === 'Credit Sale (On Account)' || order.paymentStatus.startsWith('Pending');
  const terms = order.paymentTerms || matchedCustomer?.paymentTerms || 'Net-30';
  const dueDate = order.paymentDueDate || 'Net terms apply';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none print:m-0 print:w-full print:rounded-none">
        {/* Actions Bar (hidden on print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono-code font-bold text-indigo-400">INVOICE PREVIEW</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300 font-mono-code">{order.id}</span>
            {isCreditSale && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-bold">
                Credit Facility: {terms}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Body */}
        <div className="p-8 sm:p-10 space-y-7 text-slate-800" id="printable-invoice">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                  <ThermometerSnowflake className="w-4 h-4" />
                </div>
                <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-900">
                  Frostly Logistics Inc.
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Deep-Sea Catch Intake & Super-Cryo Cold Chain Hub<br />
                Pier 38 Seafood Terminal, San Francisco, CA 94107<br />
                FDA Reg #19948210 • USDC Quality Verified
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="font-mono-code font-bold text-lg text-slate-900">
                INVOICE #{order.id}
              </div>
              <div className="text-xs text-slate-500">
                Issued: {order.orderDate}
              </div>
              <div className="text-xs text-slate-500">
                Required Delivery: <strong className="text-slate-800">{order.requiredDeliveryDate}</strong>
              </div>
              {order.paymentDueDate && (
                <div className="text-xs text-indigo-700 font-bold flex sm:justify-end items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Payment Due: {order.paymentDueDate}</span>
                </div>
              )}
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                HACCP Monitored Dispatch
              </div>
            </div>
          </div>

          {/* Client & Logistics Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Billed Client & Commercial Account
              </div>
              <div className="font-bold text-slate-900 text-sm">{order.clientName}</div>
              <div className="text-slate-600">{order.deliveryAddress}</div>
              <div className="text-slate-500">
                Attn: {order.contactPerson} ({order.contactEmail} • {order.contactPhone})
              </div>

              {matchedCustomer && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Credit Facility:</span>
                    <span className="font-bold text-slate-800">{matchedCustomer.paymentTerms}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Approved Credit Limit:</span>
                    <span className="font-mono-code font-bold text-slate-800">{formatCurrency(matchedCustomer.creditLimitUSD)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Cold-Chain Transit Specification
              </div>
              <div className="text-slate-700">
                Packaging: <strong>{order.packagingRequirement}</strong>
              </div>
              <div className="text-slate-700 mt-0.5">
                Reefer Assignment: <strong>{order.assignedReeferId || 'Active Dispatch Queue'}</strong>
              </div>
              <div className="text-slate-700 mt-0.5">
                Driver: <strong>{order.assignedDriver || 'Assigned Pier Courier'}</strong>
              </div>
              {order.creditAuthorizedBy && (
                <div className="text-[11px] text-indigo-700 font-semibold mt-1">
                  Manager Credit Override: {order.creditAuthorizedBy}
                </div>
              )}
              {order.specialInstructions && (
                <div className="text-[11px] text-amber-800 mt-1 italic">
                  Note: {order.specialInstructions}
                </div>
              )}
            </div>
          </div>

          {/* Catch-Weight Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-2 font-bold">Item & Grade</th>
                  <th className="py-2.5 px-2 font-bold">Traceability Lot</th>
                  <th className="py-2.5 px-2 font-bold text-right">Quoted Target</th>
                  <th className="py-2.5 px-2 font-bold text-right text-indigo-700">Actual Weighed</th>
                  <th className="py-2.5 px-2 font-bold text-right">Unit Rate</th>
                  <th className="py-2.5 px-2 font-bold text-right">Adjusted Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => {
                  const actualKg = item.actualWeighedKg ?? item.requestedWeightKg;
                  const itemTotal = actualKg * item.pricePerKg;

                  return (
                    <tr key={item.id || idx}>
                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-900">{item.speciesName}</div>
                        <div className="text-slate-400 text-[10px]">Grade: {item.grade}</div>
                      </td>
                      <td className="py-3 px-2 font-mono-code text-slate-600">
                        {item.lotId || 'Lot Pending'}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-500 font-mono-code">
                        {formatWeight(item.requestedWeightKg, useImperial)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono-code font-bold text-indigo-700">
                        {formatWeight(actualKg, useImperial)}
                        {item.actualWeighedKg !== null && item.actualWeighedKg !== item.requestedWeightKg && (
                          <span className={`text-[10px] ml-1 ${item.actualWeighedKg > item.requestedWeightKg ? 'text-emerald-600' : 'text-rose-500'}`}>
                            ({item.actualWeighedKg > item.requestedWeightKg ? '+' : ''}
                            {((item.actualWeighedKg - item.requestedWeightKg)).toFixed(2)})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-mono-code text-slate-600">
                        {formatCurrency(item.pricePerKg)}/{useImperial ? 'lb' : 'kg'}
                      </td>
                      <td className="py-3 px-2 text-right font-mono-code font-bold text-slate-900">
                        {formatCurrency(itemTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals and Credit Terms */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-4 border-t border-slate-200">
            <div className="space-y-2 text-xs text-slate-500 max-w-sm">
              <div className="font-bold text-slate-700">Commercial Payment & Credit Terms</div>
              <p className="text-[11px] leading-relaxed">
                Raw marine agricultural catch-weight billing. Temperature logs tracked via RFID crypto logger. Invoiced on agreed credit terms ({terms}). Payment due by {dueDate}.
              </p>
              
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <span className="text-slate-600 font-semibold">Payment Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  order.paymentStatus === 'Paid' 
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {order.paymentStatus}
                </span>

                {order.paymentStatus !== 'Paid' && (
                  <button
                    onClick={handleSettlePayment}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
                  >
                    Record Payment Received ({formatCurrency(totalDue)})
                  </button>
                )}
              </div>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Quoted Baseline:</span>
                <span className="font-mono-code">{formatCurrency(order.quotedTotalUSD)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Catch-Weight Variance:</span>
                <span className="font-mono-code font-bold text-indigo-700">
                  {subtotal - order.quotedTotalUSD >= 0 ? `+${formatCurrency(subtotal - order.quotedTotalUSD)}` : formatCurrency(subtotal - order.quotedTotalUSD)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax & Harbor Wharfage:</span>
                <span className="font-mono-code">$0.00 (Exempt)</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount Due:</span>
                <span className="font-mono-code text-indigo-700">{formatCurrency(totalDue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Close Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export const InvoiceModal: React.FC<InvoiceModalProps> = (props) => {
  if (!props.order) {
    return null;
  }
  return <InvoiceModalContent {...props} order={props.order} key={props.order.id} />;
};
