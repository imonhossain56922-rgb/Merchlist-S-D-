import React, { useMemo } from 'react';
import { UserProfile, MockupRequest } from '../../types';
import { calculateDailyOverview, getTodayKeyInTimezone, getDateKeyInTimezone } from '../../utils/dateUtils';
import { StatCard } from './StatCards';
import { RequestList } from '../requests/RequestList';
import {
  Users,
  Palette,
  Shield,
  Briefcase,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  History,
  AlertTriangle,
  UserPlus,
  Settings,
  ArrowUpRight,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: UserProfile;
  requests: MockupRequest[];
  allUsers: UserProfile[];
  timezone?: string;
  onNavigateTab: (tab: string) => void;
  onSelectRequest: (request: MockupRequest) => void;
  onOpenRevisionRequest?: (request: MockupRequest) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  requests,
  allUsers,
  timezone,
  onNavigateTab,
  onSelectRequest,
  onOpenRevisionRequest,
}) => {
  const dailyStats = calculateDailyOverview(requests, timezone);

  // User counts by role
  const userCounts = useMemo(() => {
    const counts = { ADMIN: 0, HEAD_OF_SALES: 0, SALES_REPRESENTATIVE: 0, DESIGNER: 0, total: 0 };
    allUsers.forEach((u) => {
      if (u.active) {
        counts.total++;
        if (counts[u.role] !== undefined) counts[u.role]++;
      }
    });
    return counts;
  }, [allUsers]);

  // Request source breakdown
  const sourceStats = useMemo(() => {
    const counts = { gallabox: 0, whatsapp: 0, email: 0, others: 0 };
    requests.forEach((r) => {
      if (counts[r.source] !== undefined) counts[r.source]++;
    });
    return counts;
  }, [requests]);

  // Recent 10 requests
  const recentRequests = useMemo(() => {
    return [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider block">
            System Administration
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0c192c] tracking-tight">
            Administrator Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full operational oversight of users, assignments, mockup lifecycles, and audit history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigateTab('users')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add User
          </button>
          <button
            onClick={() => onNavigateTab('company_settings')}
            className="px-3.5 py-2 rounded-xl bg-[#0c192c] hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      {/* User Directory Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Active Users"
          value={userCounts.total}
          icon={Users}
          subtext="Full corporate roster"
        />
        <StatCard
          label="Sales Representatives"
          value={userCounts.SALES_REPRESENTATIVE}
          variant="info"
          icon={Users}
          subtext="Active sales accounts"
        />
        <StatCard
          label="Designers"
          value={userCounts.DESIGNER}
          variant="success"
          icon={Palette}
          subtext="Active design staff"
        />
        <StatCard
          label="Administrators"
          value={userCounts.ADMIN}
          icon={Shield}
          subtext="System operators"
        />
      </div>

      {/* Today's Operational Pulse */}
      <div>
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          Today's Operational Pulse ({timezone || 'Asia/Dubai'})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <StatCard
            label="Created Today"
            value={dailyStats.createdToday}
            icon={Clock}
            subtext="New arrivals today"
          />
          <StatCard
            label="Completed Today"
            value={dailyStats.completedToday}
            variant="success"
            icon={CheckCircle2}
            subtext="Completed today"
          />
          <StatCard
            label="Pending Today"
            value={dailyStats.pendingToday}
            variant="info"
            icon={Clock}
            subtext="Created today & waiting"
          />
          <StatCard
            label="Previous Pending"
            value={dailyStats.previousPending}
            variant="warning"
            icon={History}
            subtext="Carried over unfinished"
          />
          <StatCard
            label="Completion Rate"
            value={`${dailyStats.completionRate}%`}
            variant="default"
            icon={TrendingUp}
            subtext="Daily productivity"
          />
        </div>
      </div>

      {/* Source Channels Grid */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          Channel Request Volumes
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-purple-700">Gallabox</span>
            <span className="text-2xl font-extrabold text-purple-950 block mt-1">
              {sourceStats.gallabox}
            </span>
          </div>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-emerald-700">WhatsApp</span>
            <span className="text-2xl font-extrabold text-emerald-950 block mt-1">
              {sourceStats.whatsapp}
            </span>
          </div>
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-blue-700">Email</span>
            <span className="text-2xl font-extrabold text-blue-950 block mt-1">
              {sourceStats.email}
            </span>
          </div>
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-700">Others</span>
            <span className="text-2xl font-extrabold text-slate-900 block mt-1">
              {sourceStats.others}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Recent Mockup Requests ({recentRequests.length})
          </h3>
          <button
            onClick={() => onNavigateTab('mockup_requests')}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1"
          >
            View All Requests <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <RequestList
          requests={recentRequests}
          currentUser={currentUser}
          timezone={timezone}
          onSelectRequest={onSelectRequest}
          onOpenRevisionRequest={onOpenRevisionRequest}
          emptyTitle="No mockup requests in the system."
          emptyDescription="When Sales Representatives submit requests, they will appear here in real time."
        />
      </div>
    </div>
  );
};
