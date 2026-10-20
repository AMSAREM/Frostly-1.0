import React from 'react';

export interface FrostlyLogoProps {
  /** Size preset or pixel number */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Whether to render only the logo icon mark without text */
  iconOnly?: boolean;
  /** Optional custom styling class */
  className?: string;
  /** Color theme variant */
  variant?: 'blue' | 'white' | 'dark' | 'gradient' | 'current' | 'red';
  /** Optional custom subtext under or beside the name */
  showSubtext?: boolean;
  /** Custom subtext label */
  subtext?: string;
  /** ID for testing or targeting */
  id?: string;
}

/**
 * Official Brand Logo Component for Amansocean
 */
export const FrostlyLogo: React.FC<FrostlyLogoProps> = ({
  size = 'md',
  iconOnly = false,
  className = '',
  variant = 'red',
  showSubtext = false,
  subtext = 'Frozen Seafood & Delivery',
  id = 'amansocean-brand-logo'
}) => {
  let iconPx = 42;
  let textClass = 'text-xl font-extrabold';
  let subtextClass = 'text-xs';

  if (typeof size === 'number') {
    iconPx = Math.round(size);
    if (size <= 20) textClass = 'text-sm font-bold';
    else if (size <= 28) textClass = 'text-base font-extrabold';
    else if (size <= 36) textClass = 'text-lg font-black';
    else if (size <= 48) textClass = 'text-2xl font-black';
    else textClass = 'text-3xl font-black';
  } else {
    switch (size) {
      case 'xs':
        iconPx = 24;
        textClass = 'text-sm font-bold';
        subtextClass = 'text-[9px]';
        break;
      case 'sm':
        iconPx = 30;
        textClass = 'text-base font-extrabold';
        subtextClass = 'text-[10px]';
        break;
      case 'md':
        iconPx = 40;
        textClass = 'text-xl font-extrabold';
        subtextClass = 'text-xs';
        break;
      case 'lg':
        iconPx = 52;
        textClass = 'text-3xl font-black';
        subtextClass = 'text-sm';
        break;
      case 'xl':
        iconPx = 64;
        textClass = 'text-4xl font-black';
        subtextClass = 'text-sm tracking-wider';
        break;
    }
  }

  const textColor = variant === 'white' ? 'text-white' : 'text-[#1A1A1A]';

  // Red Circular AO Logo Badge
  const iconElement = (
    <div 
      className="shrink-0 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-black shadow-md border-2 border-[#FFC400] transition-transform duration-200 group-hover:scale-105"
      style={{
        width: `${iconPx}px`,
        height: `${iconPx}px`,
        fontSize: `${Math.round(iconPx * 0.44)}px`
      }}
    >
      AO
    </div>
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
          Amansocean
        </span>
        {showSubtext && (
          <span className={`${subtextClass} font-semibold text-neutral-500 tracking-wider uppercase mt-1 leading-none`}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};
