import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Check, Loader2 } from 'lucide-react';

export interface ExportDropdownProps {
  label?: string;
  onExportExcel: () => Promise<void> | void;
  onExportPdf: () => Promise<void> | void;
  excelTooltip?: string;
  pdfTooltip?: string;
  variant?: 'primary' | 'secondary' | 'subtle';
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  className?: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  label = 'Export',
  onExportExcel,
  onExportPdf,
  excelTooltip = 'Download full workbook with formulas & analytics (.xlsx)',
  pdfTooltip = 'Generate print-ready executive PDF report (.pdf)',
  variant = 'secondary',
  size = 'md',
  align = 'right',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingType, setExportingType] = useState<'excel' | 'pdf' | null>(null);
  const [completedType, setCompletedType] = useState<'excel' | 'pdf' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (type: 'excel' | 'pdf') => {
    try {
      setExportingType(type);
      if (type === 'excel') {
        await onExportExcel();
      } else {
        await onExportPdf();
      }
      setCompletedType(type);
      setTimeout(() => setCompletedType(null), 2500);
      setIsOpen(false);
    } catch (err) {
      console.error(`[ExportDropdown] Failed exporting ${type}:`, err);
    } finally {
      setExportingType(null);
    }
  };

  const buttonSizeStyles = size === 'sm' 
    ? 'px-3 py-1.5 text-xs' 
    : 'px-3.5 py-2 text-xs';

  const buttonVariantStyles = 
    variant === 'primary'
      ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
      : variant === 'subtle'
      ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 shadow-2xs';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        disabled={exportingType !== null}
        className={`inline-flex items-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait ${buttonSizeStyles} ${buttonVariantStyles}`}
        title="Export data to Excel or PDF"
      >
        {exportingType ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : completedType ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <Download className="w-3.5 h-3.5 text-current opacity-80" />
        )}
        <span>{exportingType ? 'Exporting...' : label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-64 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Export Format
          </div>

          <div className="space-y-1 p-1">
            {/* Excel Option */}
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={exportingType !== null}
              className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-50 transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 flex items-center justify-between">
                  <span>Excel Spreadsheet</span>
                  <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">.XLSX</span>
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                  {excelTooltip}
                </div>
              </div>
            </button>

            {/* PDF Option */}
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exportingType !== null}
              className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-rose-50 transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4 text-rose-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 group-hover:text-rose-900 flex items-center justify-between">
                  <span>Executive PDF Report</span>
                  <span className="font-mono text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-bold">.PDF</span>
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                  {pdfTooltip}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
