import React from 'react';
import { PRIMARY_APP_ICON_DATA_URL, WORDMARK_LOGO_DATA_URL } from './logoData';

export const PRIMARY_APP_ICON_PATH = '/IMG_8904.png';
export const WORDMARK_LOGO_PATH = '/IMG_8905.png';

interface MerchlistLogoProps {
  className?: string;
  variant?: 'responsive' | 'icon' | 'wordmark' | 'both';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showSubtitle?: boolean;
  customLogoUrl?: string | null;
  onDarkBackground?: boolean;
}

export const MerchlistLogo: React.FC<MerchlistLogoProps> = ({
  className = '',
  variant = 'responsive',
  size = 'md',
  showSubtitle = false,
  customLogoUrl,
  onDarkBackground = false,
}) => {
  // If a custom logo URL is explicitly supplied from company settings, allow it as fallback
  if (customLogoUrl) {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <img
          src={customLogoUrl}
          alt="Merchlist"
          className="h-8 w-auto max-w-[160px] object-contain"
          referrerPolicy="no-referrer"
        />
        {showSubtitle && (
          <span className="text-[10px] font-bold tracking-widest uppercase text-cyan-600">
            Mockup Request
          </span>
        )}
      </div>
    );
  }

  // Size mappings preserving exact proportional scaling without distorting aspect ratios
  const iconSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-11 h-11',
    xl: 'w-16 h-16',
    '2xl': 'w-24 h-24',
  };

  const wordmarkSizeClasses = {
    sm: 'h-4 w-auto',
    md: 'h-6 w-auto',
    lg: 'h-8 w-auto',
    xl: 'h-11 w-auto',
    '2xl': 'h-16 w-auto',
  };

  // The base icon element: Official black circular logo with white lowercase 'ml'
  const iconElement = (
    <img
      src={PRIMARY_APP_ICON_DATA_URL || PRIMARY_APP_ICON_PATH}
      alt="Merchlist Logo Icon"
      loading="eager"
      decoding="sync"
      className={`${iconSizeClasses[size]} object-contain flex-shrink-0 select-none`}
      referrerPolicy="no-referrer"
    />
  );

  // The wordmark element: Official 'merchlist' wordmark
  const wordmarkElement = (
    <img
      src={WORDMARK_LOGO_DATA_URL || WORDMARK_LOGO_PATH}
      alt="Merchlist Wordmark"
      loading="eager"
      decoding="sync"
      className={`${wordmarkSizeClasses[size]} object-contain flex-shrink-0 select-none`}
      referrerPolicy="no-referrer"
    />
  );

  // Wrapper for dark backgrounds: provides a clean white card/container so the black logos contrast crisp and clear
  const renderContainer = (children: React.ReactNode) => {
    if (onDarkBackground) {
      return (
        <div className={`bg-white rounded-xl px-2.5 py-1.5 shadow-xs inline-flex items-center gap-2.5 ${className}`}>
          {children}
        </div>
      );
    }
    return <div className={`inline-flex items-center gap-2.5 ${className}`}>{children}</div>;
  };

  if (variant === 'icon') {
    return renderContainer(iconElement);
  }

  if (variant === 'wordmark') {
    return renderContainer(
      <div className="inline-flex flex-col items-start">
        {wordmarkElement}
        {showSubtitle && (
          <span className="text-[9px] font-bold tracking-widest uppercase text-cyan-700 mt-0.5">
            Mockup Request
          </span>
        )}
      </div>
    );
  }

  if (variant === 'both') {
    return renderContainer(
      <div className="inline-flex items-center gap-2.5">
        {iconElement}
        <div className="flex flex-col">
          {wordmarkElement}
          {showSubtitle && (
            <span className="text-[9px] font-bold tracking-widest uppercase text-cyan-700 mt-0.5">
              Mockup Request
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: 'responsive' behavior
  // On desktop/tablet layouts: prefer full 'merchlist' wordmark
  // On mobile/small screens: prefer circular 'ml' icon
  return renderContainer(
    <div className="inline-flex items-center gap-2">
      {/* Mobile Icon View */}
      <div className="block md:hidden">
        {iconElement}
      </div>

      {/* Desktop Wordmark View */}
      <div className="hidden md:flex flex-col">
        {wordmarkElement}
        {showSubtitle && (
          <span className="text-[9px] font-bold tracking-widest uppercase text-cyan-700 mt-0.5">
            Mockup Request
          </span>
        )}
      </div>
    </div>
  );
};
