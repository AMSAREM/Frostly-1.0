import React from 'react';

export interface FrostlyLogoProps {
  /** Size preset or pixel number */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Whether to render only the logo icon mark without text */
  iconOnly?: boolean;
  /** Optional custom styling class */
  className?: string;
  /** Color theme variant */
  variant?: 'blue' | 'white' | 'dark' | 'gradient' | 'current';
  /** Optional custom subtext under or beside the name */
  showSubtext?: boolean;
  /** Custom subtext label */
  subtext?: string;
  /** ID for testing or targeting */
  id?: string;
}

/**
 * Frostly Official Brand Logo Component
 * Renders the official 4-lobed interlocking infinity-turbine cold-chain emblem.
 */
export const FrostlyLogo: React.FC<FrostlyLogoProps> = ({
  size = 'md',
  iconOnly = false,
  className = '',
  variant = 'blue',
  showSubtext = false,
  subtext = 'Cold-Chain Platform',
  id = 'frostly-brand-logo'
}) => {
  // Map size presets to pixel dimensions
  let iconPx = 32;
  let textClass = 'text-lg';
  let subtextClass = 'text-[10px]';

  if (typeof size === 'number') {
    iconPx = size;
    if (size <= 20) textClass = 'text-xs';
    else if (size <= 28) textClass = 'text-sm';
    else if (size <= 36) textClass = 'text-base';
    else if (size <= 48) textClass = 'text-xl';
    else textClass = 'text-2xl';
  } else {
    switch (size) {
      case 'xs':
        iconPx = 18;
        textClass = 'text-xs font-bold';
        subtextClass = 'text-[8px]';
        break;
      case 'sm':
        iconPx = 24;
        textClass = 'text-sm font-bold';
        subtextClass = 'text-[9px]';
        break;
      case 'md':
        iconPx = 32;
        textClass = 'text-lg font-bold';
        subtextClass = 'text-[10px]';
        break;
      case 'lg':
        iconPx = 42;
        textClass = 'text-2xl font-black';
        subtextClass = 'text-xs';
        break;
      case 'xl':
        iconPx = 56;
        textClass = 'text-3xl font-black';
        subtextClass = 'text-xs tracking-wider';
        break;
    }
  }

  // Stroke color based on variant
  let strokeColor = '#0052FF'; // Official Vibrant Royal Blue from uploaded brand asset
  let textColor = 'text-slate-900';

  if (variant === 'white') {
    strokeColor = '#FFFFFF';
    textColor = 'text-white';
  } else if (variant === 'dark') {
    strokeColor = '#0F172A';
    textColor = 'text-slate-900';
  } else if (variant === 'current') {
    strokeColor = 'currentColor';
    textColor = 'text-current';
  } else if (variant === 'gradient') {
    strokeColor = 'url(#frostly-grad)';
    textColor = 'text-slate-900';
  }

  const iconElement = (
    <img
      src="/logofrostly1.png"
      alt="Frostly"
      width={iconPx}
      height={iconPx}
      className={`shrink-0 object-contain select-none transition-transform duration-200 group-hover:scale-105 ${
        variant === 'white' ? 'brightness-0 invert' : ''
      }`}
      style={{
        width: `${iconPx}px`,
        height: `${iconPx}px`,
      }}
      loading="eager"
      decoding="async"
    />
  );

  if (iconOnly) {
    return (
      <div id={id} className={`inline-flex items-center justify-center ${className}`}>
        {iconElement}
      </div>
    );
  }

  return (
    <div id={id} className={`inline-flex items-center gap-2.5 ${className}`}>
      {iconElement}
      <div className="flex flex-col text-left">
        <span className={`${textClass} font-heading tracking-tight ${textColor} leading-none`}>
          Frostly
        </span>
        {showSubtext && (
          <span className={`${subtextClass} font-semibold text-slate-400 tracking-wider uppercase mt-0.5 leading-none`}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};
