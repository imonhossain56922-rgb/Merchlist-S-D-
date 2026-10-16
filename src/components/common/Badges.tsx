import React from 'react';
import { RequestPriority, RequestStatus, RequestSource, UserRole } from '../../types';
import { AlertCircle, Clock, CheckCircle2, XCircle, Zap } from 'lucide-react';

export const PriorityBadge: React.FC<{ priority: RequestPriority; size?: 'sm' | 'md' }> = ({
  priority,
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (priority) {
    case 'SUPER_URGENT':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md bg-rose-600 text-white shadow-xs ${sizeClasses}`}
        >
          <Zap className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          SUPER URGENT
        </span>
      );
    case 'URGENT':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-amber-500 text-white shadow-xs ${sizeClasses}`}
        >
          <AlertCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          URGENT
        </span>
      );
    case 'REGULAR':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}
        >
          <Clock className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          REGULAR
        </span>
      );
  }
};

export const StatusBadge: React.FC<{ status: RequestStatus; size?: 'sm' | 'md' }> = ({
  status,
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (status) {
    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <CheckCircle2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Completed
        </span>
      );
    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}
        >
          <XCircle className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Rejected
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-sky-50 text-sky-700 border border-sky-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
          Pending
        </span>
      );
  }
};

export const SourceBadge: React.FC<{ source: RequestSource }> = ({ source }) => {
  const styles: Record<RequestSource, string> = {
    gallabox: 'bg-purple-50 text-purple-700 border-purple-200',
    whatsapp: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    email: 'bg-blue-50 text-blue-700 border-blue-200',
    others: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const labels: Record<RequestSource, string> = {
    gallabox: 'Gallabox',
    whatsapp: 'WhatsApp',
    email: 'Email',
    others: 'Others',
  };

  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border capitalize ${
        styles[source] || styles.others
      }`}
    >
      {labels[source] || source}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const labels: Record<UserRole, string> = {
    ADMIN: 'Admin',
    HEAD_OF_SALES: 'Head of Sales',
    SALES_REPRESENTATIVE: 'Sales Representative',
    DESIGNER: 'Designer',
  };

  const styles: Record<UserRole, string> = {
    ADMIN: 'bg-slate-900 text-white',
    HEAD_OF_SALES: 'bg-indigo-600 text-white',
    SALES_REPRESENTATIVE: 'bg-cyan-600 text-white',
    DESIGNER: 'bg-teal-600 text-white',
  };

  return (
    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded tracking-wide ${styles[role]}`}>
      {labels[role]}
    </span>
  );
};

export const RevisionBadge: React.FC<{ revisionNumber: number; size?: 'sm' | 'md' }> = ({
  revisionNumber,
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-md bg-purple-600 text-white shadow-xs ${sizeClasses}`}
    >
      Revision #{revisionNumber}
    </span>
  );
};
