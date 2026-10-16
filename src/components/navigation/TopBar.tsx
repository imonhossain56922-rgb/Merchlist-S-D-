import React from 'react';
import { UserProfile } from '../../types';
import { RoleBadge } from '../common/Badges';
import { UserAvatar } from '../common/UserAvatar';
import { PRIMARY_APP_ICON_DATA_URL, WORDMARK_LOGO_DATA_URL } from '../brand/logoData';
import { Bell, Menu, Palette, Shield } from 'lucide-react';

interface TopBarProps {
  currentUser: UserProfile;
  applicationName?: string;
  onOpenMobileMenu: () => void;
  onOpenNotifications: () => void;
  onOpenProfile?: () => void;
  unreadCount?: number;
  assignedDesignerName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  applicationName = 'Marchlist Mockup Request',
  onOpenMobileMenu,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0,
  assignedDesignerName,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Official Logos: Circular on mobile, wordmark on larger screens */}
        <img
          src={PRIMARY_APP_ICON_DATA_URL || '/IMG_8904.png'}
          alt="Merchlist Icon"
          loading="eager"
          decoding="sync"
          className="w-7 h-7 object-contain md:hidden select-none"
          referrerPolicy="no-referrer"
        />

        <div className="flex items-center gap-3">
          <img
            src={WORDMARK_LOGO_DATA_URL || '/IMG_8905.png'}
            alt="Merchlist Wordmark"
            loading="eager"
            decoding="sync"
            className="h-6 w-auto object-contain hidden lg:block select-none"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-base md:text-lg font-bold text-[#0c192c] tracking-tight leading-tight">
              {applicationName}
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
              Merchlist Internal Operations System
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Sales Representative Assigned Designer Info */}
        {currentUser.role === 'SALES_REPRESENTATIVE' && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-50/70 border border-cyan-200/80">
            <Palette className="w-3.5 h-3.5 text-cyan-700" />
            <div className="text-left leading-none">
              <span className="text-[10px] text-cyan-700 font-semibold uppercase tracking-wider block">
                Assigned Designer
              </span>
              <span className="text-xs font-bold text-slate-900">
                {assignedDesignerName || currentUser.assignedDesignerName || 'None'}
              </span>
            </div>
          </div>
        )}

        {/* Role Badge */}
        <div className="hidden xs:block">
          <RoleBadge role={currentUser.role} />
        </div>

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200/60"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar Shortcut */}
        <button
          type="button"
          onClick={onOpenProfile}
          title={`My Profile (${currentUser.name})`}
          className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-cyan-500 transition-all cursor-pointer"
        >
          <UserAvatar
            name={currentUser.name}
            avatarUrl={currentUser.avatarUrl}
            role={currentUser.role}
            size="md"
          />
        </button>
      </div>
    </header>
  );
};
