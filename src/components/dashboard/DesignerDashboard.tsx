import React, { useState, useMemo } from 'react';
import { UserProfile, MockupRequest, RequestPriority, RequestSource, RequestStatus } from '../../types';
import { calculateDailyOverview, getTodayKeyInTimezone, getDateKeyInTimezone } from '../../utils/dateUtils';
import { sortDesignerQueue } from '../../services/requestService';
import { StatCard } from './StatCards';
import { RequestList } from '../requests/RequestList';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  RotateCcw,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';

interface DesignerDashboardProps {
  currentUser: UserProfile;
  requests: MockupRequest[];
  timezone?: string;
  onSelectRequest: (request: MockupRequest) => void;
  onCompleteRequest?: (request: MockupRequest) => void;
  onOpenRevisionRequest?: (request: MockupRequest) => void;
}

export const DesignerDashboard: React.FC<DesignerDashboardProps> = ({
  currentUser,
  requests,
  timezone,
  onSelectRequest,
  onCompleteRequest,
  onOpenRevisionRequest,
}) => {
  // Manual filter states
  const [statusFilter, setStatusFilter] = useState<'ALL' | RequestStatus>('PENDING');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | RequestPriority>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | RequestSource>('ALL');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('ALL');
  const [isDefaultFilterActive, setIsDefaultFilterActive] = useState(true);

  // Daily statistics for Designer
  const dailyStats = calculateDailyOverview(requests, timezone);

  // Sales Representative Breakdown (real data only)
  const salesRepBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; completed: number; pending: number; rejected: number }
    >();

    requests.forEach((req) => {
      const repId = req.salesRepresentativeId;
      const repName = req.salesRepresentativeName || 'Sales Rep';
      const existing = map.get(repId) || {
        name: repName,
        total: 0,
        completed: 0,
        pending: 0,
        rejected: 0,
      };

      existing.total++;
      if (req.status === 'COMPLETED') existing.completed++;
      else if (req.status === 'PENDING') existing.pending++;
      else if (req.status === 'REJECTED') existing.rejected++;

      map.set(repId, existing);
    });

    return Array.from(map.values());
  }, [requests]);

  // Unique sales reps for filter dropdown
  const uniqueSalesReps = useMemo(() => {
    const reps = new Set<string>();
    requests.forEach((r) => reps.add(r.salesRepresentativeName));
    return Array.from(reps);
  }, [requests]);

  // Reset to Default Filter
  const handleResetToDefaultFilter = () => {
    setStatusFilter('PENDING');
    setPriorityFilter('ALL');
    setSourceFilter('ALL');
    setSalesRepFilter('ALL');
    setIsDefaultFilterActive(true);
  };

  // Filter & Queue Sorting logic
  const filteredRequests = useMemo(() => {
    let list = requests.filter((req) => !req.deleted);

    // Filter by status
    if (statusFilter !== 'ALL') {
      list = list.filter((r) => r.status === statusFilter);
    }

    // Filter by priority
    if (priorityFilter !== 'ALL') {
      list = list.filter((r) => r.priority === priorityFilter);
    }

    // Filter by source
    if (sourceFilter !== 'ALL') {
      list = list.filter((r) => r.source === sourceFilter);
    }

    // Filter by sales rep
    if (salesRepFilter !== 'ALL') {
      list = list.filter((r) => r.salesRepresentativeName === salesRepFilter);
    }

    // Apply strict priority queue sorting:
    // SUPER_URGENT (oldest first) -> URGENT (oldest first) -> REGULAR (oldest first)
    return sortDesignerQueue(list);
  }, [requests, statusFilter, priorityFilter, sourceFilter, salesRepFilter]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block">
            Designer Workspace
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0c192c] tracking-tight">
            Welcome, {currentUser.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Requests assigned to your queue sorted automatically by priority and waiting time.
          </p>
        </div>

        {/* Default Filter Button */}
        <button
          onClick={handleResetToDefaultFilter}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-xs ${
            isDefaultFilterActive && statusFilter === 'PENDING' && priorityFilter === 'ALL'
              ? 'bg-[#0c192c] text-white'
              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Default Filter (Priority Queue)
        </button>
      </div>

      {/* Today's Work Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Received Today"
          value={dailyStats.createdToday}
          icon={Clock}
          subtext="New arrivals"
        />
        <StatCard
          label="Completed Today"
          value={dailyStats.completedToday}
          variant="success"
          icon={CheckCircle2}
          subtext="Finished today"
        />
        <StatCard
          label="Pending Today"
          value={dailyStats.pendingToday}
          variant="info"
          icon={Clock}
          subtext="Arrived today"
        />
        <StatCard
          label="Previous Pending"
          value={dailyStats.previousPending}
          variant="warning"
          icon={History}
          subtext="From earlier days"
        />
        <StatCard
          label="Total Pending"
          value={dailyStats.totalPending}
          variant={dailyStats.totalPending > 0 ? 'danger' : 'default'}
          icon={AlertTriangle}
          subtext="Active in queue"
        />
        <StatCard
          label="Completion Rate"
          value={`${dailyStats.completionRate}%`}
          variant="default"
          icon={TrendingUp}
          subtext="Today's speed"
        />
      </div>

      {/* Sales Representative Breakdown Card (Real Data Only) */}
      {salesRepBreakdown.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-cyan-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Sales Representative Workload Breakdown
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {salesRepBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between"
              >
                <div className="font-bold text-slate-900 mb-1">{item.name}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>{item.total} Requests</span>
                  <span className="text-emerald-700 font-semibold">{item.completed} Done</span>
                  <span className="text-amber-700 font-semibold">{item.pending} Pending</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
            <span>Queue Filters</span>
          </div>
          {(!isDefaultFilterActive || statusFilter !== 'PENDING' || priorityFilter !== 'ALL') && (
            <button
              onClick={handleResetToDefaultFilter}
              className="text-xs text-cyan-600 hover:text-cyan-800 font-semibold"
            >
              Reset to Default
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setIsDefaultFilterActive(false);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending (Active Queue)</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as typeof priorityFilter);
                setIsDefaultFilterActive(false);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
            >
              <option value="ALL">All Priorities</option>
              <option value="SUPER_URGENT">Super Urgent</option>
              <option value="URGENT">Urgent</option>
              <option value="REGULAR">Regular</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as typeof sourceFilter);
                setIsDefaultFilterActive(false);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
            >
              <option value="ALL">All Sources</option>
              <option value="gallabox">Gallabox</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="others">Others</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Sales Representative
            </label>
            <select
              value={salesRepFilter}
              onChange={(e) => {
                setSalesRepFilter(e.target.value);
                setIsDefaultFilterActive(false);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
            >
              <option value="ALL">All Representatives</option>
              {uniqueSalesReps.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Queue Listing */}
      <RequestList
        requests={filteredRequests}
        currentUser={currentUser}
        timezone={timezone}
        onSelectRequest={onSelectRequest}
        onCompleteRequest={onCompleteRequest}
        onOpenRevisionRequest={onOpenRevisionRequest}
        emptyTitle={
          statusFilter === 'PENDING'
            ? 'No pending requests in your queue.'
            : 'No matching requests found.'
        }
        emptyDescription="New requests assigned to you will appear here in real time according to priority."
      />
    </div>
  );
};
