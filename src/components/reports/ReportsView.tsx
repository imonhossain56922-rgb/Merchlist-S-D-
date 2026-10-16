import React, { useState, useMemo } from 'react';
import { UserProfile, MockupRequest, RequestStatus, RequestPriority, RequestSource } from '../../types';
import { formatDateInTimezone, getDateKeyInTimezone, getTodayKeyInTimezone } from '../../utils/dateUtils';
import { generateReportPdf } from '../../utils/pdfGenerator';
import { PriorityBadge, StatusBadge, SourceBadge } from '../common/Badges';
import { EmptyState } from '../common/EmptyState';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface ReportsViewProps {
  currentUser: UserProfile;
  requests: MockupRequest[];
  allUsers: UserProfile[];
  timezone?: string;
  onSelectRequest: (request: MockupRequest) => void;
  companyName?: string;
  applicationName?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  currentUser,
  requests,
  allUsers,
  timezone = 'Asia/Dubai',
  onSelectRequest,
  companyName = 'Merchlist',
  applicationName = 'Marchlist Mockup Request',
}) => {
  const [dateRangePreset, setDateRangePreset] = useState<
    'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM'
  >('THIS_MONTH');

  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | RequestStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | RequestPriority>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | RequestSource>('ALL');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('ALL');
  const [designerFilter, setDesignerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const salesReps = useMemo(() => allUsers.filter((u) => u.role === 'SALES_REPRESENTATIVE'), [allUsers]);
  const designers = useMemo(() => allUsers.filter((u) => u.role === 'DESIGNER'), [allUsers]);

  // Compute date range bounds
  const dateBounds = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayKeyInTimezone(timezone);

    switch (dateRangePreset) {
      case 'TODAY':
        return { start: todayStr, end: todayStr, label: 'Today' };

      case 'YESTERDAY': {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yestStr = getDateKeyInTimezone(yest, timezone);
        return { start: yestStr, end: yestStr, label: 'Yesterday' };
      }

      case 'LAST_7_DAYS': {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: getDateKeyInTimezone(past, timezone), end: todayStr, label: 'Last 7 Days' };
      }

      case 'THIS_MONTH': {
        const yearMonth = todayStr.slice(0, 7);
        return { start: `${yearMonth}-01`, end: todayStr, label: 'This Month' };
      }

      case 'LAST_MONTH': {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: getDateKeyInTimezone(prevMonthDate, timezone),
          end: getDateKeyInTimezone(lastDayPrevMonth, timezone),
          label: 'Last Month',
        };
      }

      case 'CUSTOM':
        return {
          start: customStartDate || '1970-01-01',
          end: customEndDate || '2099-12-31',
          label: `Custom (${customStartDate || 'Start'} to ${customEndDate || 'End'})`,
        };

      case 'ALL':
      default:
        return { start: '1970-01-01', end: '2099-12-31', label: 'All Historical Records' };
    }
  }, [dateRangePreset, customStartDate, customEndDate, timezone]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (req.deleted) return false;

      // Date range filter
      const reqDate = getDateKeyInTimezone(req.createdAt, timezone);
      if (reqDate < dateBounds.start || reqDate > dateBounds.end) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;

      // Priority
      if (priorityFilter !== 'ALL' && req.priority !== priorityFilter) return false;

      // Source
      if (sourceFilter !== 'ALL' && req.source !== sourceFilter) return false;

      // Sales Rep
      if (salesRepFilter !== 'ALL' && req.salesRepresentativeId !== salesRepFilter) return false;

      // Designer
      if (designerFilter !== 'ALL' && req.designerId !== designerFilter) return false;

      // Search query (Request ID, Title, Item, Client)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = req.requestId.toLowerCase().includes(q);
        const matchTitle = (req.mockupTitle || '').toLowerCase().includes(q);
        const matchItem = (req.itemName || '').toLowerCase().includes(q);
        const matchClient = (req.clientName || '').toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchItem && !matchClient) return false;
      }

      return true;
    });
  }, [
    requests,
    dateBounds,
    statusFilter,
    priorityFilter,
    sourceFilter,
    salesRepFilter,
    designerFilter,
    searchQuery,
    timezone,
  ]);

  // Metrics summary
  const summary = useMemo(() => {
    const total = filteredRequests.length;
    const completed = filteredRequests.filter((r) => r.status === 'COMPLETED').length;
    const pending = filteredRequests.filter((r) => r.status === 'PENDING').length;
    const rejected = filteredRequests.filter((r) => r.status === 'REJECTED').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, rejected, rate };
  }, [filteredRequests]);

  const handleExportPdf = () => {
    generateReportPdf({
      requests: filteredRequests,
      dateRangeLabel: dateBounds.label,
      appliedFilters: {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
        salesRep: salesReps.find((s) => s.userId === salesRepFilter)?.name,
        designer: designers.find((d) => d.userId === designerFilter)?.name,
      },
      generatedByName: currentUser.name,
      timezone,
      companyName,
      applicationName,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">
            Operational Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade performance analytics, volume metrics, and printable corporate PDF reports.
          </p>
        </div>

        <button
          onClick={handleExportPdf}
          disabled={filteredRequests.length === 0}
          className="px-4 py-2.5 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export Official PDF Report
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-semibold block uppercase text-[10px]">
            Filtered Volume
          </span>
          <span className="text-2xl font-extrabold text-[#0c192c] mt-1 block">
            {summary.total}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-emerald-700 font-semibold block uppercase text-[10px]">
            Completed
          </span>
          <span className="text-2xl font-extrabold text-emerald-800 mt-1 block">
            {summary.completed}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
          <span className="text-amber-700 font-semibold block uppercase text-[10px]">
            Pending
          </span>
          <span className="text-2xl font-extrabold text-amber-800 mt-1 block">
            {summary.pending}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs">
          <span className="text-blue-700 font-semibold block uppercase text-[10px]">
            Completion Rate
          </span>
          <span className="text-2xl font-extrabold text-blue-800 mt-1 block">
            {summary.rate}%
          </span>
        </div>
      </div>

      {/* Filter Matrix Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
        {/* Date Range Presets */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
            Date Range Filter
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'LAST_MONTH', label: 'Last Month' },
              { id: 'ALL', label: 'All Time' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDateRangePreset(preset.id as typeof dateRangePreset)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  dateRangePreset === preset.id
                    ? 'bg-[#0c192c] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if CUSTOM selected */}
          {dateRangePreset === 'CUSTOM' && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Detailed Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="SUPER_URGENT">Super Urgent</option>
              <option value="URGENT">Urgent</option>
              <option value="REGULAR">Regular</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
            >
              <option value="ALL">All Sources</option>
              <option value="gallabox">Gallabox</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="others">Others</option>
            </select>
          </div>

          {(currentUser.role === 'ADMIN' || currentUser.role === 'HEAD_OF_SALES') && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sales Rep
                </label>
                <select
                  value={salesRepFilter}
                  onChange={(e) => setSalesRepFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                >
                  <option value="ALL">All Sales Reps</option>
                  {salesReps.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Designer
                </label>
                <select
                  value={designerFilter}
                  onChange={(e) => setDesignerFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                >
                  <option value="ALL">All Designers</option>
                  {designers.map((d) => (
                    <option key={d.userId} value={d.userId}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto text-xs">
        {filteredRequests.length === 0 ? (
          <EmptyState
            title="No requests match the selected report criteria."
            description="Adjust your filters or date range above to view historical requests."
          />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Mockup Title / Item</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Sales Rep</th>
                <th className="py-3 px-4">Designer</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Completed Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {req.requestId}
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <div className="font-semibold text-slate-800 truncate">
                      {req.mockupTitle || (req.source === 'gallabox' ? 'Gallabox Request' : '-')}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {req.itemName || '-'}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <SourceBadge source={req.source} />
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                    {req.salesRepresentativeName}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                    {req.designerName}
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {formatDateInTimezone(req.createdAt, timezone, true)}
                  </td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                    {req.completedAt ? (
                      formatDateInTimezone(req.completedAt, timezone, true)
                    ) : (
                      <span className="text-slate-400 italic">Not Completed</span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <StatusBadge status={req.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <PriorityBadge priority={req.priority} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRequest(req);
                      }}
                      className="px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
