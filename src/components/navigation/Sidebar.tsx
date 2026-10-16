import React from 'react';
import { UserProfile, UserRole } from '../../types';
import { MerchlistLogo } from '../brand/MerchlistLogo';
import { UserAvatar } from '../common/UserAvatar';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Palette,
  Briefcase,
  FileText,
  FilePlus2,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  History,
  Bell,
  Settings,
  User,
  LogOut,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentUser: UserProfile;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  unreadCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  customLogoUrl?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentTab,
  onSelectTab,
  onLogout,
  unreadCount = 0,
  isOpenMobile = false,
  onCloseMobile,
  customLogoUrl,
}) => {
  const getNavItems = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'sales_reps', label: 'Sales Representatives', icon: UserCheck },
          { id: 'designers', label: 'Designers', icon: Palette },
          { id: 'head_of_sales', label: 'Head of Sales', icon: Briefcase },
          { id: 'mockup_requests', label: 'Mockup Requests', icon: FileText },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'audit_logs', label: 'Audit Logs', icon: History },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
          { id: 'company_settings', label: 'Company Settings', icon: Settings },
          { id: 'profile', label: 'Profile', icon: User },
        ];

      case 'HEAD_OF_SALES':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'sales_team', label: 'Sales Team', icon: UserCheck },
          { id: 'design_team', label: 'Design Team', icon: Palette },
          { id: 'mockup_requests', label: 'Mockup Requests', icon: FileText },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
          { id: 'profile', label: 'Profile', icon: User },
        ];

      case 'SALES_REPRESENTATIVE':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'new_mockup', label: 'New Mockup', icon: FilePlus2, highlight: true },
          { id: 'my_requests', label: 'My Requests', icon: FileText },
          { id: 'pending', label: 'Pending', icon: Clock },
          { id: 'rejected', label: 'Rejected', icon: XCircle },
          { id: 'completed', label: 'Completed', icon: CheckCircle2 },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
          { id: 'profile', label: 'Profile', icon: User },
        ];

      case 'DESIGNER':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'pending_requests', label: 'Pending Requests', icon: Clock, highlight: true },
          { id: 'rejected', label: 'Rejected', icon: XCircle },
          { id: 'completed', label: 'Completed', icon: CheckCircle2 },
          { id: 'all_requests', label: 'All Requests', icon: FileText },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
          { id: 'profile', label: 'Profile', icon: User },
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems(currentUser.role);

  const roleDisplayNames: Record<UserRole, string> = {
    ADMIN: 'Admin',
    HEAD_OF_SALES: 'Head of Sales',
    SALES_REPRESENTATIVE: 'Sales Representative',
    DESIGNER: 'Designer',
  };

  const content = (
    <div className="flex flex-col h-full bg-[#0c192c] text-white w-64 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <MerchlistLogo variant="both" size="md" onDarkBackground={true} showSubtitle={true} customLogoUrl={customLogoUrl} />
        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-[#0c192c] font-semibold shadow-xs'
                  : item.highlight
                  ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-[#0c192c]' : item.highlight ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-[#0c192c] text-white' : 'bg-cyan-500 text-slate-950'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-800 bg-[#081220]/70">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              name={currentUser.name}
              avatarUrl={currentUser.avatarUrl}
              role={currentUser.role}
              size="lg"
              className="cursor-pointer"
              onClick={() => onSelectTab('profile')}
            />
            <div className="min-w-0 cursor-pointer" onClick={() => onSelectTab('profile')}>
              <p className="text-xs font-semibold text-white truncate hover:text-cyan-300 transition-colors">{currentUser.name}</p>
              <p className="text-[10px] text-cyan-400 font-medium truncate">
                {roleDisplayNames[currentUser.role]}
              </p>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider truncate">
                ID: {currentUser.loginId}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-30 shadow-xl border-r border-slate-800">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
