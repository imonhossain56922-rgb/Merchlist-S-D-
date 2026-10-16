import React, { useState, useEffect } from 'react';
import { UserProfile, MockupRequest, DesignerCapacity } from '../../types';
import { calculateDailyOverview, getTodayKeyInTimezone, getDateKeyInTimezone } from '../../utils/dateUtils';
import { getDesignerCapacity } from '../../services/requestService';
import { StatCard } from './StatCards';
import { RequestList } from '../requests/RequestList';
import {
  FilePlus2,
  CheckCircle2,
  Clock,
  History,
  TrendingUp,
  Palette,
  Zap,
  AlertCircle,
  Plus,
  XCircle,
} from 'lucide-react';

interface SalesDashboardProps {
  currentUser: UserProfile;
  requests: MockupRequest[];
  timezone?: string;
  onOpenNewModal: () => void;
  onSelectRequest: (request: MockupRequest) => void;
  onOpenRevisionRequest?: (request: MockupRequest) => void;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  currentUser,
  requests,
  timezone,
  onOpenNewModal,
  onSelectRequest,
  onOpenRevisionRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'rejected' | 'completed' | 'today'>('all');
  const [capacity, setCapacity] = useState<DesignerCapacity | null>(null);

  // Compute daily stats for this sales rep
  const dailyStats = calculateDailyOverview(requests, timezone);

  // Fetch live capacity for assigned designer
  useEffect(() => {
    if (currentUser.assignedDesignerId) {
      getDesignerCapacity(currentUser.assignedDesignerId, currentUser.assignedDesignerName).then((cap) => {
        setCapacity(cap);
      });
    }
  }, [currentUser.assignedDesignerId, currentUser.assignedDesignerName, requests]);

  const todayKey = getTodayKeyInTimezone(timezone);

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const rejectedRequests = requests.filter((r) => r.status === 'REJECTED');
  const completedRequests = requests.filter((r) => r.status === 'COMPLETED');
  const todayRequests = requests.filter((r) => getDateKeyInTimezone(r.createdAt, timezone) === todayKey);

  const displayedRequests = () => {
    switch (activeTab) {
      case 'pending':
        return pendingRequests;
      case 'rejected':
        return rejectedRequests;
      case 'completed':
        return completedRequests;
      case 'today':
        return todayRequests;
      case 'all':
      default:
        return requests;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Assigned Designer Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider block">
            Sales Dashboard
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0c192c] tracking-tight">
            Welcome, {currentUser.name}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <Palette className="w-3.5 h-3.5 text-cyan-600" />
            <span>Assigned Designer:</span>
            <span className="font-bold text-slate-900">
              {currentUser.assignedDesignerName || 'Not Assigned'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Assigned Designer Priority Capacity Indicator */}
          {capacity && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Priority Capacity:
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  capacity.canAcceptSuperUrgent
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-rose-600 text-white font-bold'
                }`}
              >
                Super Urgent: {capacity.superUrgentCount}/1
              </span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                  capacity.canAcceptUrgent
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-amber-500 text-white font-bold'
                }`}
              >
                Urgent: {capacity.urgentCount}/2
              </span>
            </div>
          )}

          <button
            onClick={onOpenNewModal}
            className="px-4 py-2.5 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Mockup Request
          </button>
        </div>
      </div>

      {/* Rejection Alert Box if any rejected requests require attention */}
      {rejectedRequests.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-900">
                Action Required: {rejectedRequests.length} Rejected Request(s)
              </h4>
              <p className="text-rose-700 mt-0.5">
                The designer requested corrections. Review the feedback and resubmit when ready.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('rejected')}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 shadow-xs whitespace-nowrap"
          >
            Review Rejected
          </button>
        </div>
      )}

      {/* Today's Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Total Requests"
          value={requests.length}
          icon={FilePlus2}
          subtext="Lifetime submitted"
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
          subtext="New pending"
        />
        <StatCard
          label="Previous Pending"
          value={dailyStats.previousPending}
          variant="warning"
          icon={History}
          subtext="From earlier days"
        />
        <StatCard
          label="Completion Rate"
          value={`${dailyStats.completionRate}%`}
          variant="default"
          icon={TrendingUp}
          subtext="Overall efficiency"
        />
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'all', label: `All Requests (${requests.length})` },
            { id: 'pending', label: `Pending (${pendingRequests.length})` },
            { id: 'rejected', label: `Rejected (${rejectedRequests.length})`, alert: rejectedRequests.length > 0 },
            { id: 'completed', label: `Completed (${completedRequests.length})` },
            { id: 'today', label: `Today's (${todayRequests.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[#0c192c] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              {tab.alert && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
            </button>
          ))}
        </div>
      </div>

      {/* Request Table / Cards */}
      <RequestList
        requests={displayedRequests()}
        currentUser={currentUser}
        timezone={timezone}
        onSelectRequest={onSelectRequest}
        onOpenRevisionRequest={onOpenRevisionRequest}
        emptyTitle={
          activeTab === 'rejected'
            ? 'No rejected requests.'
            : activeTab === 'pending'
            ? 'No pending requests.'
            : activeTab === 'completed'
            ? 'No completed requests yet.'
            : 'No mockup requests yet.'
        }
        emptyDescription="Create your first mockup request using the button above."
      />
    </div>
  );
};
