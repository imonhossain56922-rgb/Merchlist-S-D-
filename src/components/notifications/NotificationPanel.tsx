import React from 'react';
import { AppNotification } from '../../types';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService';
import { formatDateInTimezone } from '../../utils/dateUtils';
import { EmptyState } from '../common/EmptyState';
import { Bell, CheckCheck, X, ArrowRight, Zap, CheckCircle2, XCircle } from 'lucide-react';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  userId: string;
  timezone?: string;
  onSelectRequestId?: (requestId: string) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  userId,
  timezone,
  onSelectRequestId,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAll = async () => {
    await markAllNotificationsAsRead(userId);
  };

  const handleClickItem = async (notif: AppNotification) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.notificationId);
    }
    if (notif.requestId && onSelectRequestId) {
      onSelectRequestId(notif.requestId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-2xs" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 text-xs">
        {/* Header */}
        <div className="p-4 bg-[#0c192c] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px]">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-end">
            <button
              onClick={handleMarkAll}
              className="text-cyan-700 hover:text-cyan-900 font-semibold flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All as Read
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState title="No notifications." icon={Bell} />
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.read;

              return (
                <div
                  key={notif.notificationId}
                  onClick={() => handleClickItem(notif)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                    isUnread ? 'bg-cyan-50/40' : 'bg-white'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {notif.type === 'REQUEST_ASSIGNED' && (
                      <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {notif.type === 'REQUEST_COMPLETED' && (
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {notif.type === 'REQUEST_REJECTED' && (
                      <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center">
                        <XCircle className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {notif.type === 'REQUEST_RESUBMITTED' && (
                      <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className={`truncate font-semibold ${isUnread ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                        {notif.title}
                      </h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-slate-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {formatDateInTimezone(notif.createdAt, timezone, true)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
