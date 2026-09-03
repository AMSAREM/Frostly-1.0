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
  DollarSign
} from 'lucide-react';
import { ClientOrder } from '../../types';
import { formatCurrency, formatWeight } from '../../utils/formatters';

interface InvoiceModalProps {
  order: ClientOrder | null;
  onClose: () => void;
  useImperial: boolean;
  onUpdatePaymentStatus: (orderId: string, status: ClientOrder['paymentStatus']) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  order,
  onClose,
  useImperial,
  onUpdatePaymentStatus
}) => {
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = `FROSTLY SEAFOOD CATCH-WEIGHT INVOICE\nOrder ID: ${order.id}\nClient: ${order.clientName}\nDestination: ${order.deliveryAddress}\nTotal Amount Due: ${formatCurrency(order.adjustedTotalUSD || order.quotedTotalUSD)}\nStatus: ${order.paymentStatus}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const subtotal = order.adjustedTotalUSD || order.quotedTotalUSD;
  const taxAmount = 0; // Wholesale exempt / raw marine agricultural exemption
  const totalDue = subtotal + taxAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="invoice-modal-content"
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Control Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Catch-Weight Commercial Invoice & Cold-Chain Packing Slip
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="p-8 sm:p-10 space-y-8 bg-white text-slate-800">
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
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
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                HACCP Monitored Dispatch
              </div>
            </div>
          </div>

          {/* Client & Logistics Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                Billed Client & Consignee
              </div>
              <div className="font-bold text-slate-900 text-sm">{order.clientName}</div>
              <div className="text-slate-600 mt-0.5">{order.deliveryAddress}</div>
              <div className="text-slate-500 mt-1">
                Attn: {order.contactPerson} ({order.contactEmail} • {order.contactPhone})
              </div>
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
                  const diffKg = (item.actualWeighedKg ?? item.requestedWeightKg) - item.requestedWeightKg;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-900">{item.speciesName}</div>
                        <div className="text-[11px] text-slate-500">Grade: {item.grade}</div>
                      </td>
                      <td className="py-3 px-2 font-mono-code text-indigo-700 font-medium">
                        {item.lotId}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-500">
                        {formatWeight(item.requestedWeightKg, useImperial)}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-emerald-700">
                        {formatWeight(actualKg, useImperial)}
                        {diffKg !== 0 && (
                          <div className="text-[10px] font-normal text-slate-400">
                            ({diffKg > 0 ? `+${diffKg.toFixed(2)}` : diffKg.toFixed(2)} kg yield)
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-700">
                        {formatCurrency(item.pricePerKg)}/kg
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-slate-900 font-mono-code">
                        {formatCurrency(itemTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals and Terms */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-4 border-t border-slate-200">
            <div className="space-y-1 text-xs text-slate-500 max-w-sm">
              <div className="font-bold text-slate-700">Payment & Cold-Chain Terms</div>
              <p className="text-[11px] leading-relaxed">
                Raw marine agricultural catch-weight billing. Temperature logs logged via RFID crypto sensor. Any temperature variance claims must be lodged within 2 hours of arrival inspection.
              </p>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-slate-600 font-medium">Payment Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  order.paymentStatus === 'Paid' 
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {order.paymentStatus}
                </span>
                {order.paymentStatus !== 'Paid' && (
                  <button
                    onClick={() => onUpdatePaymentStatus(order.id, 'Paid')}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    Mark as Paid
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
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
