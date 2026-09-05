import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Send, 
  Loader2, 
  ShieldCheck, 
  Server
} from 'lucide-react';
import { 
  getGoogleSmtpConfig, 
  testGoogleSmtpConnection, 
  GoogleSmtpConfigStatus, 
  GoogleSmtpTestResult 
} from '../services/googleSmtpService';

interface GoogleSmtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTestEmail?: string;
}

export const GoogleSmtpModal: React.FC<GoogleSmtpModalProps> = ({
  isOpen,
  onClose,
  defaultTestEmail = '',
}) => {
  const [config, setConfig] = useState<GoogleSmtpConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test form state
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<GoogleSmtpTestResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultTestEmail && !testEmail) {
        setTestEmail(defaultTestEmail);
      }
      loadConfig();
    }
  }, [isOpen, defaultTestEmail]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const cfg = await getGoogleSmtpConfig();
      setConfig(cfg);
    } catch (err) {
      console.error('Failed to load Google SMTP config:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testGoogleSmtpConnection(testEmail.trim());
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Failed to execute Google SMTP test',
        error: err?.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="google-smtp-modal"
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-heading text-slate-900">
                  Google SMTP Integration
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  smtp.gmail.com
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Reliable cold-chain email confirmation via Google Workspace &amp; Gmail.
              </p>
            </div>
          </div>
          <button
            id="btn-close-google-smtp-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Architecture Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900 text-xs block">
                Direct Google SMTP Delivery
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Organization confirmation emails, administrator activation links, and temperature deviation alerts route through Google&apos;s authenticated mail relay (<strong>smtp.gmail.com</strong>), replacing third-party services like Resend with your verified domain.
              </p>
            </div>
          </div>

          {/* Supabase Custom SMTP Settings Reference */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Server className="w-3.5 h-3.5 text-indigo-600" />
                Supabase Custom SMTP Parameters
              </span>
              <span className="text-[10px] text-slate-400">
                Dashboard &gt; Authentication &gt; SMTP Settings
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Host
                </div>
                <div className="font-mono text-xs font-semibold text-slate-800">
                  smtp.gmail.com
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('smtp.gmail.com', 'host')}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Copy Host"
                >
                  {copiedKey === 'host' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Port &amp; Security
                </div>
                <div className="font-mono text-xs font-semibold text-slate-800">
                  465 (SSL) / 587 (TLS)
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('465', 'port')}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Copy Port"
                >
                  {copiedKey === 'port' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Sender Name
                </div>
                <div className="font-mono text-xs font-semibold text-slate-800 truncate">
                  Frostly Seafood Platform
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard('Frostly Seafood Platform', 'sender_name')}
                  className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Copy Sender Name"
                >
                  {copiedKey === 'sender_name' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Authentication
                </div>
                <div className="text-[11px] font-semibold text-slate-800">
                  Google App Password (16 chars)
                </div>
              </div>
            </div>
          </div>

          {/* Quick 2-Step Setup Guide */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="font-bold text-slate-900 block text-xs">
              Configuring your Google Account:
            </span>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
              <li>
                Visit <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5">Google Account Security <ExternalLink className="w-2.5 h-2.5" /></a> and ensure <strong>2-Step Verification</strong> is enabled.
              </li>
              <li>
                Create a 16-character dedicated password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5">Google App Passwords <ExternalLink className="w-2.5 h-2.5" /></a> for app name <em>&quot;Frostly Seafood&quot;</em>.
              </li>
              <li>
                Add <code>GOOGLE_SMTP_USER</code> and <code>GOOGLE_SMTP_APP_PASSWORD</code> in your environment or Supabase SMTP settings.
              </li>
            </ol>
          </div>

          {/* Live Test Dispatch */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <span className="font-bold text-slate-900 block text-xs">
              Live Google SMTP Test Delivery
            </span>

            <form onSubmit={handleRunTest} className="flex gap-2">
              <input
                id="input-google-smtp-test-email"
                type="email"
                required
                placeholder="Enter recipient email (e.g. your email)..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                disabled={isTesting}
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-slate-50 focus:bg-white"
              />
              <button
                id="btn-run-google-smtp-test"
                type="submit"
                disabled={isTesting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Email</span>
                  </>
                )}
              </button>
            </form>

            {testResult && (
              <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                testResult.success 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                  : 'bg-amber-50 border border-amber-200 text-amber-900'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold">{testResult.message}</div>
                  {testResult.error && (
                    <div className="text-[11px] font-mono opacity-80">{testResult.error}</div>
                  )}
                  {testResult.setupGuide && (
                    <p className="text-[11px] mt-1 opacity-90 leading-relaxed">
                      Follow the guide above to generate your 16-character Google App Password.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Google SMTP Provider Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
