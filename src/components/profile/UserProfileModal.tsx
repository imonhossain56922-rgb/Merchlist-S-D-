import React from 'react';
import { UserProfile } from '../../types';
import { UserAvatar } from '../common/UserAvatar';
import { RoleBadge } from '../common/Badges';
import { formatDateInTimezone } from '../../utils/dateUtils';
import { X, Shield, Calendar, Clock, Palette, User, CheckCircle2, XCircle } from 'lucide-react';

interface UserProfileModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  timezone?: string;
  allUsers?: UserProfile[];
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  timezone,
  allUsers,
}) => {
  if (!isOpen || !user) return null;

  const assignedDesigner = allUsers?.find(
    (u) => u.userId === user.assignedDesignerId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Banner */}
        <div className="h-24 bg-gradient-to-r from-[#0c192c] via-[#132a4a] to-cyan-900 relative flex items-start justify-end p-3">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Details */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Avatar positioning overlapping header */}
          <div className="-mt-12 mb-4 flex items-end justify-between">
            <div className="ring-4 ring-white rounded-full shadow-lg bg-white">
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                role={user.role}
                size="2xl"
              />
            </div>
            <div className="mb-2">
              <RoleBadge role={user.role} />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 leading-tight">{user.name}</h3>
            <p className="font-mono text-xs text-slate-500 font-semibold tracking-wider mt-0.5">
              Login ID: {user.loginId}
            </p>
          </div>

          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" /> Account Role
              </span>
              <span className="font-semibold text-slate-800">
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                {user.active ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                )}
                Status
              </span>
              <span
                className={`font-semibold ${
                  user.active ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {user.active ? 'Active' : 'Disabled'}
              </span>
            </div>

            {user.role === 'SALES_REPRESENTATIVE' && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-cyan-50/60 border border-cyan-200/60">
                <span className="text-cyan-800 font-medium flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-cyan-600" /> Assigned Designer
                </span>
                <span className="font-bold text-slate-900">
                  {user.assignedDesignerName || assignedDesigner?.name || 'None Assigned'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Member Since
              </span>
              <span className="font-medium text-slate-700">
                {formatDateInTimezone(user.createdAt, timezone, false)}
              </span>
            </div>

            {user.lastActivityAt && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Activity
                </span>
                <span className="font-medium text-slate-700">
                  {formatDateInTimezone(user.lastActivityAt, timezone, true)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
