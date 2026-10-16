import React from 'react';
import { LucideIcon, FilePlus2, CheckCircle2, Clock, AlertTriangle, Zap, TrendingUp, History } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon = FilePlus2,
  variant = 'default',
}) => {
  const variantStyles = {
    default: {
      card: 'bg-white border-slate-200/80',
      iconBox: 'bg-slate-100 text-slate-700',
    },
    success: {
      card: 'bg-white border-emerald-200/80',
      iconBox: 'bg-emerald-50 text-emerald-700',
    },
    warning: {
      card: 'bg-white border-amber-200/80',
      iconBox: 'bg-amber-50 text-amber-700',
    },
    danger: {
      card: 'bg-white border-rose-200/80',
      iconBox: 'bg-rose-50 text-rose-700',
    },
    info: {
      card: 'bg-white border-cyan-200/80',
      iconBox: 'bg-cyan-50 text-cyan-700',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className={`p-4 rounded-xl border shadow-xs flex items-center justify-between transition-all ${style.card}`}>
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl sm:text-2xl font-extrabold text-[#0c192c] tracking-tight mt-0.5">{value}</p>
        {subtext && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{subtext}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.iconBox}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};
