import React from 'react';
import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { validateEmail } from '../utils/emailValidation';

interface EmailValidationFeedbackProps {
  email: string;
  onApplySuggestion?: (suggested: string) => void;
  className?: string;
}

export const EmailValidationFeedback: React.FC<EmailValidationFeedbackProps> = ({
  email,
  onApplySuggestion,
  className = '',
}) => {
  if (!email || email.trim().length < 3) return null;

  const result = validateEmail(email);

  // Case 1: Typo detected with suggestion (e.g. user typed @gamil.com instead of @gmail.com)
  if (result.suggestion && onApplySuggestion) {
    return (
      <div
        className={`mt-1.5 flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 animate-in fade-in duration-150 ${className}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="truncate">
            Did you mean <strong className="font-semibold">{result.suggestion}</strong>?
          </span>
        </div>
        <button
          type="button"
          onClick={() => onApplySuggestion(result.suggestion!)}
          className="ml-2 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold transition-colors cursor-pointer shrink-0"
        >
          Fix typo
        </button>
      </div>
    );
  }

  // Case 2: Validation error (disposable domain or invalid syntax)
  if (!result.isValid) {
    return (
      <div
        className={`mt-1.5 flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 animate-in fade-in duration-150 ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span className="leading-snug">{result.error}</span>
      </div>
    );
  }

  // Case 3: Perfectly valid email address
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600 animate-in fade-in duration-150 ${className}`}
    >
      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
      <span>Authentic work email format validated</span>
    </div>
  );
};
