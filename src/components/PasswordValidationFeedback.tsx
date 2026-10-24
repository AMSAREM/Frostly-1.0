import React from 'react';
import { Check, X, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { validatePassword, generateSecurePassword, PasswordValidationResult } from '../utils/passwordValidation';

interface PasswordValidationFeedbackProps {
  password: string;
  showChecklist?: boolean;
  onGeneratePassword?: (generated: string) => void;
  onSuggestPassword?: (generated: string) => void;
  compact?: boolean;
}

export const PasswordValidationFeedback: React.FC<PasswordValidationFeedbackProps> = ({
  password,
  showChecklist = true,
  onGeneratePassword,
  onSuggestPassword,
  compact = false,
}) => {
  const triggerGenerate = onSuggestPassword || onGeneratePassword;

  if (!password) {
    if (triggerGenerate) {
      return (
        <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
          <span className="text-[11px] text-slate-400">Must be at least 8 characters with upper, lower, number, and symbol.</span>
          <button
            type="button"
            onClick={() => triggerGenerate(generateSecurePassword(12))}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Generate Strong</span>
          </button>
        </div>
      );
    }
    return null;
  }

  const result: PasswordValidationResult = validatePassword(password);

  const getStrengthBarColor = () => {
    switch (result.strength) {
      case 'strong':
        return 'bg-emerald-500';
      case 'good':
        return 'bg-blue-500';
      case 'fair':
        return 'bg-amber-500';
      case 'weak':
        return 'bg-orange-500';
      default:
        return 'bg-rose-500';
    }
  };

  const getStrengthTextColor = () => {
    switch (result.strength) {
      case 'strong':
        return 'text-emerald-700 font-bold';
      case 'good':
        return 'text-blue-700 font-bold';
      case 'fair':
        return 'text-amber-700 font-medium';
      case 'weak':
        return 'text-orange-700 font-medium';
      default:
        return 'text-rose-700 font-medium';
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Strength Bar & Label */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500">Security:</span>
            <span className={`text-[11px] ${getStrengthTextColor()}`}>{result.strengthLabel}</span>
          </div>
          {triggerGenerate && (
            <button
              type="button"
              onClick={() => triggerGenerate(generateSecurePassword(12))}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Suggest Strong</span>
            </button>
          )}
        </div>

        {/* 4-Segment Strength Indicator */}
        <div className="grid grid-cols-4 gap-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              result.score >= 20 ? getStrengthBarColor() : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              result.score >= 50 ? getStrengthBarColor() : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              result.score >= 70 ? getStrengthBarColor() : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              result.score >= 85 ? getStrengthBarColor() : 'bg-transparent'
            }`}
          />
        </div>
      </div>

      {/* Interactive Rules Checklist */}
      {showChecklist && (
        <div
          className={`grid ${
            compact ? 'grid-cols-1' : 'grid-cols-2'
          } gap-x-2 gap-y-1 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]`}
        >
          {result.ruleChecks.map((rule) => (
            <div
              key={rule.id}
              className={`flex items-center gap-1.5 transition-colors ${
                rule.passed ? 'text-emerald-700 font-medium' : 'text-slate-400'
              }`}
            >
              {rule.passed ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-slate-300 shrink-0" />
              )}
              <span className="truncate">{rule.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Specific Error Callout if invalid */}
      {!result.isValid && result.errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{result.errorMessage}</span>
        </div>
      )}
    </div>
  );
};
