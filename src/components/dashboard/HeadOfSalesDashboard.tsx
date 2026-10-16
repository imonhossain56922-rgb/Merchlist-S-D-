import React, { useState, useMemo } from 'react';
import { UserProfile, MockupRequest } from '../../types';
import { calculateDailyOverview, getTodayKeyInTimezone, getDateKeyInTimezone, formatWaitingTime } from '../../utils/dateUtils';
import { StatCard } from './StatCards';
import { RequestList } from '../requests/RequestList';
import { SourceBadge } from '../common/Badges';
import {
  Users,
  Palette,
  FileText,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Zap,
  BarChart2,
  UserCheck,
  ChevronRight,
  PieChart,
} from 'lucide-react';

interface HeadOfSalesDashboardProps {
  currentUser: UserProfile;
  requests: MockupRequest[];
  allUsers: UserProfile[];
  timezone?: string;
  onSelectRequest: (request: MockupRequest) => void;
  onOpenRevisionRequest?: (request: MockupRequest) => void;
}

export const HeadOfSalesDashboard: React.FC<HeadOfSalesDashboardProps> = ({
  currentUser,
  requests,
  allUsers,
  timezone,
  onSelectRequest,
  onOpenRevisionRequest,
}) => {
  const [viewMode, setViewMode] = useState<'team' | 'individual'>('team');
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string | null>(null);

  const salesReps = useMemo(() => allUsers.filter((u) => u.role === 'SALES_REPRESENTATIVE' && u.active), [allUsers]);
  const designers = useMemo(() => allUsers.filter((u) => u.role === 'DESIGNER' && u.active), [allUsers]);

  const dailyStats = calculateDailyOverview(requests, timezone);

  // Request Source Metrics
  const sourceStats = useMemo(() => {
    const counts = { gallabox: 0, whatsapp: 0, email: 0, others: 0 };
    requests.forEach((r) => {
      if (counts[r.source] !== undefined) {
        counts[r.source]++;
      }
    });
    return counts;
  }, [requests]);

  // Selected Sales Rep Stats
  const selectedRepStats = useMemo(() => {
    if (!selectedRepId) return null;
    const rep = salesReps.find((r) => r.userId === selectedRepId);
    if (!rep) return null;

    const repRequests = requests.filter((r) => r.salesRepresentativeId === selectedRepId);
    const repDaily = calculateDailyOverview(repRequests, timezone);

    const sourceBreakdown = { gallabox: 0, whatsapp: 0, email: 0, others: 0 };
    repRequests.forEach((r) => {
      sourceBreakdown[r.source]++;
    });

    return {
      user: rep,
      requests: repRequests,
      daily: repDaily,
      sourceBreakdown,
    };
  }, [selectedRepId, salesReps, requests, timezone]);

  // Selected Designer Stats
  const selectedDesignerStats = useMemo(() => {
    if (!selectedDesignerId) return null;
    const des = designers.find((d) => d.userId === selectedDesignerId);
    if (!des) return null;

    const desRequests = requests.filter((r) => r.designerId === selectedDesignerId);
    const desDaily = calculateDailyOverview(desRequests, timezone);

    // Sales Rep breakdown for this designer
    const repCounts = new Map<string, { name: string; count: number }>();
    desRequests.forEach((r) => {
      const existing = repCounts.get(r.salesRepresentativeId) || {
        name: r.salesRepresentativeName,
        count: 0,
      };
      existing.count++;
      repCounts.set(r.salesRepresentativeId, existing);
    });

    return {
      user: des,
      requests: desRequests,
      daily: desDaily,
      repBreakdown: Array.from(repCounts.values()),
    };
  }, [selectedDesignerId, designers, requests, timezone]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
            Executive Monitoring
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0c192c] tracking-tight">
            Head of Sales Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time management overview of sales team volume, designer workloads, and source channels.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => {
              setViewMode('team');
              setSelectedRepId(null);
              setSelectedDesignerId(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'team'
                ? 'bg-white text-[#0c192c] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Team Overview
          </button>
          <button
            onClick={() => setViewMode('individual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'individual'
                ? 'bg-white text-[#0c192c] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Individual Performance
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Total Sales Reps"
          value={salesReps.length}
          icon={UserCheck}
          subtext="Active team members"
        />
        <StatCard
          label="Total Designers"
          value={designers.length}
          icon={Palette}
          subtext="Active design staff"
        />
        <StatCard
          label="Created Today"
          value={dailyStats.createdToday}
          icon={Clock}
          subtext="Today's total"
        />
        <StatCard
          label="Completed Today"
          value={dailyStats.completedToday}
          variant="success"
          icon={CheckCircle2}
          subtext="Resolved today"
        />
        <StatCard
          label="Total Pending"
          value={dailyStats.totalPending}
          variant="warning"
          icon={AlertTriangle}
          subtext={`${dailyStats.previousPending} from previous days`}
        />
      </div>

      {viewMode === 'team' ? (
        /* ================= TEAM OVERVIEW ================= */
        <div className="space-y-6">
          {/* Request Sources Overview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              Request Source Distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200">
                <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider block">
                  Gallabox
                </span>
                <span className="text-xl font-bold text-purple-950 mt-1 block">
                  {sourceStats.gallabox}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  WhatsApp
                </span>
                <span className="text-xl font-bold text-emerald-950 mt-1 block">
                  {sourceStats.whatsapp}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Email
                </span>
                <span className="text-xl font-bold text-blue-950 mt-1 block">
                  {sourceStats.email}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                  Others
                </span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">
                  {sourceStats.others}
                </span>
              </div>
            </div>
          </div>

          {/* Sales Team Performance Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-600" />
              Sales Team Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                    <th className="py-2.5 px-3">Sales Rep</th>
                    <th className="py-2.5 px-3">Login ID</th>
                    <th className="py-2.5 px-3">Assigned Designer</th>
                    <th className="py-2.5 px-3">Total Requests</th>
                    <th className="py-2.5 px-3">Completed</th>
                    <th className="py-2.5 px-3">Pending</th>
                    <th className="py-2.5 px-3">Rejected</th>
                    <th className="py-2.5 px-3 text-right">Drill Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesReps.map((rep) => {
                    const repReqs = requests.filter((r) => r.salesRepresentativeId === rep.userId);
                    const completed = repReqs.filter((r) => r.status === 'COMPLETED').length;
                    const pending = repReqs.filter((r) => r.status === 'PENDING').length;
                    const rejected = repReqs.filter((r) => r.status === 'REJECTED').length;

                    return (
                      <tr key={rep.userId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{rep.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{rep.loginId}</td>
                        <td className="py-2.5 px-3 font-medium text-cyan-800">
                          {rep.assignedDesignerName || 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 font-bold">{repReqs.length}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">{completed}</td>
                        <td className="py-2.5 px-3 text-amber-700 font-semibold">{pending}</td>
                        <td className="py-2.5 px-3 text-rose-700 font-semibold">{rejected}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedRepId(rep.userId);
                              setViewMode('individual');
                            }}
                            className="text-cyan-700 hover:text-cyan-900 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            View <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Designer Performance Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-teal-600" />
              Design Team Workload & Completion
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase">
                    <th className="py-2.5 px-3">Designer</th>
                    <th className="py-2.5 px-3">Login ID</th>
                    <th className="py-2.5 px-3">Assigned Total</th>
                    <th className="py-2.5 px-3">Completed</th>
                    <th className="py-2.5 px-3">Active Pending</th>
                    <th className="py-2.5 px-3">Super Urgent Active</th>
                    <th className="py-2.5 px-3">Urgent Active</th>
                    <th className="py-2.5 px-3 text-right">Drill Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {designers.map((des) => {
                    const desReqs = requests.filter((r) => r.designerId === des.userId);
                    const completed = desReqs.filter((r) => r.status === 'COMPLETED').length;
                    const pending = desReqs.filter((r) => r.status === 'PENDING').length;
                    const superUrgent = desReqs.filter(
                      (r) => r.status === 'PENDING' && r.priority === 'SUPER_URGENT'
                    ).length;
                    const urgent = desReqs.filter(
                      (r) => r.status === 'PENDING' && r.priority === 'URGENT'
                    ).length;

                    return (
                      <tr key={des.userId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{des.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{des.loginId}</td>
                        <td className="py-2.5 px-3 font-bold">{desReqs.length}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-semibold">{completed}</td>
                        <td className="py-2.5 px-3 text-amber-700 font-semibold">{pending}</td>
                        <td className="py-2.5 px-3 text-rose-700 font-bold">{superUrgent}/1</td>
                        <td className="py-2.5 px-3 text-amber-700 font-bold">{urgent}/2</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedDesignerId(des.userId);
                              setViewMode('individual');
                            }}
                            className="text-teal-700 hover:text-teal-900 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            View <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= INDIVIDUAL PERFORMANCE VIEW ================= */
        <div className="space-y-6">
          {/* Individual User Selector */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Select Sales Representative
              </label>
              <select
                value={selectedRepId || ''}
                onChange={(e) => {
                  setSelectedRepId(e.target.value || null);
                  setSelectedDesignerId(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
              >
                <option value="">-- Choose Sales Representative --</option>
                {salesReps.map((rep) => (
                  <option key={rep.userId} value={rep.userId}>
                    {rep.name} (ID: {rep.loginId})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Or Select Designer
              </label>
              <select
                value={selectedDesignerId || ''}
                onChange={(e) => {
                  setSelectedDesignerId(e.target.value || null);
                  setSelectedRepId(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
              >
                <option value="">-- Choose Designer --</option>
                {designers.map((des) => (
                  <option key={des.userId} value={des.userId}>
                    {des.name} (ID: {des.loginId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Drilldown Sales Rep Card */}
          {selectedRepStats && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedRepStats.user.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Login ID: <span className="font-mono">{selectedRepStats.user.loginId}</span> | Assigned Designer:{' '}
                      <span className="font-bold text-slate-800">
                        {selectedRepStats.user.assignedDesignerName || 'Unassigned'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total</span>
                    <span className="text-lg font-bold text-slate-900">{selectedRepStats.requests.length}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <span className="text-[10px] text-emerald-700 uppercase font-semibold block">Completed</span>
                    <span className="text-lg font-bold text-emerald-800">{selectedRepStats.daily.completedToday}</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block">Pending</span>
                    <span className="text-lg font-bold text-amber-800">{selectedRepStats.daily.totalPending}</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <span className="text-[10px] text-blue-700 uppercase font-semibold block">Completion Rate</span>
                    <span className="text-lg font-bold text-blue-800">{selectedRepStats.daily.completionRate}%</span>
                  </div>
                </div>
              </div>

              <RequestList
                requests={selectedRepStats.requests}
                currentUser={currentUser}
                timezone={timezone}
                onSelectRequest={onSelectRequest}
                onOpenRevisionRequest={onOpenRevisionRequest}
                emptyTitle="No requests created by this Sales Representative yet."
              />
            </div>
          )}

          {/* Drilldown Designer Card */}
          {selectedDesignerStats && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedDesignerStats.user.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Login ID: <span className="font-mono">{selectedDesignerStats.user.loginId}</span> (Designer)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Workload</span>
                    <span className="text-lg font-bold text-slate-900">{selectedDesignerStats.requests.length}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <span className="text-[10px] text-emerald-700 uppercase font-semibold block">Completed Today</span>
                    <span className="text-lg font-bold text-emerald-800">{selectedDesignerStats.daily.completedToday}</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block">Active Queue</span>
                    <span className="text-lg font-bold text-amber-800">{selectedDesignerStats.daily.totalPending}</span>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl">
                    <span className="text-[10px] text-rose-700 uppercase font-semibold block">Super Urgent / Urgent</span>
                    <span className="text-lg font-bold text-rose-800">
                      {selectedDesignerStats.daily.superUrgentCount} / {selectedDesignerStats.daily.urgentCount}
                    </span>
                  </div>
                </div>
              </div>

              <RequestList
                requests={selectedDesignerStats.requests}
                currentUser={currentUser}
                timezone={timezone}
                onSelectRequest={onSelectRequest}
                onOpenRevisionRequest={onOpenRevisionRequest}
                emptyTitle="No requests assigned to this Designer yet."
              />
            </div>
          )}

          {!selectedRepStats && !selectedDesignerStats && (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              Select a Sales Representative or Designer from the dropdown above to view their individual performance metrics.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
