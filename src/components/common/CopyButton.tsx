import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text?: string | null;
  label?: string;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
  title?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className = '',
  compact = false,
  iconOnly = false,
  title,
}) => {
  const [copied, setCopied] = useState(false);

  if (!text || !text.trim()) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or restricted contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const tooltip = title || (copied ? 'Copied to clipboard!' : `Copy ${label || 'text'}`);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer select-none active:scale-95 ${
        copied
          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs font-bold'
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs hover:text-cyan-700 hover:border-cyan-400'
      } ${iconOnly ? 'p-1.5' : ''} ${className}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      )}
      {!iconOnly && (
        <span className="truncate">
          {copied ? 'Copied!' : compact ? 'Copy' : label ? `Copy ${label}` : 'Copy'}
        </span>
      )}
    </button>
  );
};
