import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types';
import { fetchAuditLogs } from '../../services/auditService';
import { formatDateInTimezone } from '../../utils/dateUtils';
import { EmptyState } from '../common/EmptyState';
import { History, Search, Shield, RefreshCw } from 'lucide-react';

interface AuditLogsViewProps {
  timezone?: string;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ timezone }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    const data = await fetchAuditLogs(150);
    setLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.performedByName.toLowerCase().includes(q) ||
      (log.targetId && log.targetId.toLowerCase().includes(q)) ||
      (log.newValue && log.newValue.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">Audit Trail</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, append-only security logs of all critical system modifications and user events.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto text-xs">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading audit history...</div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No audit log entries recorded yet."
            description="System operations such as user management, settings changes, and mockup status changes will appear here."
            icon={History}
          />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Target Type / ID</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.logId} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {formatDateInTimezone(log.timestamp, timezone, true)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    <div>{log.performedByName}</div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {log.performedByRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-mono">
                    {log.targetType} {log.targetId ? `(${log.targetId})` : ''}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                    {log.newValue || log.previousValue || '-'}
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
