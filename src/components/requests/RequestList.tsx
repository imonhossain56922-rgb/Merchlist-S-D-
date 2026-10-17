import React, { useState } from 'react';
import { MockupRequest, UserProfile } from '../../types';
import { PriorityBadge, StatusBadge, SourceBadge, RevisionBadge } from '../common/Badges';
import { formatDateInTimezone, formatWaitingTime } from '../../utils/dateUtils';
import { EmptyState } from '../common/EmptyState';
import { CopyButton } from '../common/CopyButton';
import {
  Eye,
  Clock,
  CheckCircle2,
  FileEdit,
  CornerDownRight,
  ChevronDown,
  ChevronRight,
  Copy,
} from 'lucide-react';

interface RequestListProps {
  requests: MockupRequest[];
  currentUser: UserProfile;
  timezone?: string;
  onSelectRequest: (request: MockupRequest) => void;
  onOpenRevisionRequest?: (request: MockupRequest) => void;
  onCompleteRequest?: (request: MockupRequest) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const RequestList: React.FC<RequestListProps> = ({
  requests,
  currentUser,
  timezone,
  onSelectRequest,
  onOpenRevisionRequest,
  onCompleteRequest,
  emptyTitle = 'No mockup requests yet.',
  emptyDescription,
}) => {
  // Track expanded revision rows (default all expanded to see revision history immediately)
  const [collapsedRevisions, setCollapsedRevisions] = useState<Record<string, boolean>>({});

  if (requests.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const toggleRevisionCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedRevisions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Request ID</th>
              <th className="py-3 px-4">Mockup Title & Item</th>
              <th className="py-3 px-4">Client / Phone</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Sales Rep</th>
              <th className="py-3 px-4">Designer</th>
              <th className="py-3 px-4">Created / Requested</th>
              <th className="py-3 px-4">Waiting / Elapsed</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req) => {
              const isDesignerForReq =
                currentUser.role === 'DESIGNER' && req.designerId === currentUser.userId;
              const isSalesOwner =
                (currentUser.role === 'SALES_REPRESENTATIVE' &&
                  req.salesRepresentativeId === currentUser.userId) ||
                currentUser.role === 'HEAD_OF_SALES' ||
                currentUser.role === 'ADMIN';

              const waitingTime =
                req.status === 'COMPLETED'
                  ? formatWaitingTime(req.createdAt, req.completedAt)
                  : formatWaitingTime(req.createdAt);

              const hasRevisions = req.revisions && req.revisions.length > 0;
              const isCollapsed = collapsedRevisions[req.id] || false;

              return (
                <React.Fragment key={req.id}>
                  {/* Main Order Row */}
                  <tr
                    onClick={() => onSelectRequest(req)}
                    className={`hover:bg-slate-50/90 cursor-pointer transition-colors ${
                      req.currentRevision && req.currentRevision > 0 && req.status === 'PENDING'
                        ? 'bg-purple-50/20'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {hasRevisions && (
                          <button
                            type="button"
                            onClick={(e) => toggleRevisionCollapse(req.id, e)}
                            className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            title={isCollapsed ? 'Show revisions' : 'Hide revisions'}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <span>{req.requestId}</span>
                        {req.currentRevision && req.currentRevision > 0 && (
                          <RevisionBadge revisionNumber={req.currentRevision} size="sm" />
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-semibold text-slate-800 truncate">
                        {req.mockupTitle || (req.source === 'gallabox' ? 'Gallabox Request' : '-')}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {req.itemName || (req.source === 'gallabox' ? 'Direct notes' : '-')}
                      </div>
                      {/* If pending revision, display changes note directly to designer */}
                      {req.status === 'PENDING' && req.latestChangesDetails && (
                        <div className="mt-1 px-2 py-1 rounded bg-purple-50 border border-purple-200 text-purple-950 font-medium text-[11px] leading-tight">
                          <span className="font-bold text-purple-700">Changes Details: </span>
                          <span className="line-clamp-2">{req.latestChangesDetails}</span>
                        </div>
                      )}
                    </td>

                    {/* Client & Mobile column with single-click copy buttons */}
                    <td className="py-3 px-4 max-w-[210px]">
                      <div className="space-y-1">
                        {req.clientName ? (
                          <div className="flex items-center justify-between gap-1 bg-cyan-50/70 border border-cyan-200/60 rounded px-1.5 py-0.5">
                            <span className="font-semibold text-slate-900 truncate" title={req.clientName}>
                              {req.clientName}
                            </span>
                            <CopyButton text={req.clientName} compact label="Name" className="h-5 px-1.5 py-0 text-[10px]" />
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] block">-</span>
                        )}
                        {req.clientMobileNumber && (
                          <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                            <span className="font-mono text-[11px] text-slate-800 truncate" title={req.clientMobileNumber}>
                              {req.clientMobileNumber}
                            </span>
                            <CopyButton text={req.clientMobileNumber} compact label="Phone" className="h-5 px-1.5 py-0 text-[10px]" />
                          </div>
                        )}
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

                    <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {waitingTime}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <PriorityBadge priority={req.priority} size="sm" />
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={req.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Complete button for Designer on pending requests */}
                        {isDesignerForReq && req.status === 'PENDING' && onCompleteRequest && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCompleteRequest(req);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Complete
                          </button>
                        )}

                        {/* Revision Request button on completed orders */}
                        {req.status === 'COMPLETED' && isSalesOwner && onOpenRevisionRequest && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRevisionRequest(req);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors border border-purple-200 shadow-2xs"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            Revision Request
                          </button>
                        )}

                        <CopyButton
                          text={`Request ID: ${req.requestId}\nMockup Title: ${req.mockupTitle || 'N/A'}\nItem: ${req.itemName || 'N/A'}\nClient Name: ${req.clientName || 'N/A'}\nClient Phone: ${req.clientMobileNumber || 'N/A'}\nSource: ${req.source}\nPriority: ${req.priority}\nNotes:\n${req.notes}`}
                          compact
                          label="Specs"
                          title="Copy client and mockup specifications to clipboard"
                        />

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRequest(req);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Underneath that request: Additional rows for each revision round with identical completed order columns */}
                  {hasRevisions &&
                    !isCollapsed &&
                    req.revisions!.map((rev) => {
                      const revWaitingTime = rev.completedAt
                        ? formatWaitingTime(rev.requestedAt, rev.completedAt)
                        : formatWaitingTime(rev.requestedAt);

                      const isRevCompleted = !!rev.completedAt;

                      return (
                        <tr
                          key={`${req.id}-rev-${rev.revisionNumber}`}
                          onClick={() => onSelectRequest(req)}
                          className="bg-purple-50/20 hover:bg-purple-50/50 cursor-pointer border-t border-purple-100/60 transition-colors"
                        >
                          {/* 1. Request ID with revision tree indicator */}
                          <td className="py-2.5 px-4 pl-8 font-mono text-xs font-bold text-purple-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <CornerDownRight className="w-3.5 h-3.5 text-purple-400" />
                              <span>{req.requestId}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Rev #{rev.revisionNumber}
                              </span>
                            </div>
                          </td>

                          {/* 2. Changes Details column */}
                          <td className="py-2.5 px-4 max-w-[240px]">
                            <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                              <span>Changes Details:</span>
                            </div>
                            <div
                              className="text-xs text-slate-800 font-medium line-clamp-2"
                              title={rev.changesDetails}
                            >
                              {rev.changesDetails}
                            </div>
                          </td>

                          {/* 2b. Client info spacer */}
                          <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                            -
                          </td>

                          {/* 3. Source */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <SourceBadge source={req.source} />
                          </td>

                          {/* 4. Sales Rep */}
                          <td className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {rev.requestedByName || req.salesRepresentativeName}
                          </td>

                          {/* 5. Designer */}
                          <td className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {rev.completedByName || req.designerName}
                          </td>

                          {/* 6. Requested Date */}
                          <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                            {formatDateInTimezone(rev.requestedAt, timezone, true)}
                          </td>

                          {/* 7. Waiting / Elapsed Time */}
                          <td className="py-2.5 px-4 font-medium text-purple-900 whitespace-nowrap">
                            {revWaitingTime}
                          </td>

                          {/* 8. Priority */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <PriorityBadge priority={req.priority} size="sm" />
                          </td>

                          {/* 9. Status */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {isRevCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                In Progress
                              </span>
                            )}
                          </td>

                          {/* 10. Actions */}
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* If revision is currently pending and designer viewing */}
                              {!isRevCompleted &&
                                isDesignerForReq &&
                                req.status === 'PENDING' &&
                                onCompleteRequest && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCompleteRequest(req);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Complete
                                  </button>
                                )}

                              {/* If this revision is completed and sales rep viewing, allow Revision Request */}
                              {isRevCompleted &&
                                req.status === 'COMPLETED' &&
                                isSalesOwner &&
                                onOpenRevisionRequest && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenRevisionRequest(req);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                                  >
                                    <FileEdit className="w-3 h-3" />
                                    Revision Request
                                  </button>
                                )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectRequest(req);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile & Tablet Responsive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
        {requests.map((req) => {
          const isDesignerForReq =
            currentUser.role === 'DESIGNER' && req.designerId === currentUser.userId;
          const isSalesOwner =
            (currentUser.role === 'SALES_REPRESENTATIVE' &&
              req.salesRepresentativeId === currentUser.userId) ||
            currentUser.role === 'HEAD_OF_SALES' ||
            currentUser.role === 'ADMIN';

          const waitingTime =
            req.status === 'COMPLETED'
              ? formatWaitingTime(req.createdAt, req.completedAt)
              : formatWaitingTime(req.createdAt);

          const hasRevisions = req.revisions && req.revisions.length > 0;

          return (
            <div
              key={req.id}
              onClick={() => onSelectRequest(req)}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-[#0c192c]">
                      {req.requestId}
                    </span>
                    {req.currentRevision && req.currentRevision > 0 && (
                      <RevisionBadge revisionNumber={req.currentRevision} size="sm" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SourceBadge source={req.source} />
                    <StatusBadge status={req.status} size="sm" />
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 text-xs line-clamp-1 mb-1">
                  {req.mockupTitle || (req.source === 'gallabox' ? 'Gallabox Request' : '-')}
                </h4>
                <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                  {req.itemName || (req.source === 'gallabox' ? 'Direct request notes' : '-')}
                </p>

                {/* Client Contact Info with individual single-click copy buttons */}
                {(req.clientName || req.clientMobileNumber) && (
                  <div className="mb-2.5 p-2 rounded-lg bg-cyan-50/60 border border-cyan-200/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider block">
                      Client Contact Info
                    </span>
                    <div className="space-y-1">
                      {req.clientName && (
                        <div className="flex items-center justify-between gap-1 bg-white p-1.5 rounded border border-cyan-200/70 text-xs">
                          <span className="font-bold text-slate-900 truncate">{req.clientName}</span>
                          <CopyButton text={req.clientName} compact label="Name" className="h-5 px-1.5 py-0 text-[10px]" />
                        </div>
                      )}
                      {req.clientMobileNumber && (
                        <div className="flex items-center justify-between gap-1 bg-white p-1.5 rounded border border-cyan-200/70 text-xs">
                          <span className="font-mono font-semibold text-slate-800 truncate">{req.clientMobileNumber}</span>
                          <CopyButton text={req.clientMobileNumber} compact label="Phone" className="h-5 px-1.5 py-0 text-[10px]" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* If active revision, display Changes Details in card */}
                {req.status === 'PENDING' && req.latestChangesDetails && (
                  <div className="mb-2.5 p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-950 text-[11px]">
                    <span className="font-bold text-purple-700 block mb-0.5">
                      Changes Details:
                    </span>
                    <p className="line-clamp-2">{req.latestChangesDetails}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                  <span>
                    Sales: <strong className="text-slate-800">{req.salesRepresentativeName}</strong>
                  </span>
                  <span>
                    Designer: <strong className="text-slate-800">{req.designerName}</strong>
                  </span>
                </div>

                {/* Revision List inside Card */}
                {hasRevisions && (
                  <div className="mt-2.5 pt-2 border-t border-purple-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                      Revisions ({req.revisions!.length})
                    </span>
                    {req.revisions!.map((rev) => (
                      <div
                        key={rev.revisionNumber}
                        className="p-2 rounded bg-purple-50/60 border border-purple-100 text-[11px]"
                      >
                        <div className="flex items-center justify-between font-bold text-purple-900 mb-1">
                          <span>Rev #{rev.revisionNumber}</span>
                          <span className="text-[10px] font-semibold">
                            {rev.completedAt ? (
                              <span className="text-emerald-700">Completed</span>
                            ) : (
                              <span className="text-amber-700">In Progress</span>
                            )}
                          </span>
                        </div>
                        <div className="text-slate-700 line-clamp-2 mb-1">
                          <strong className="text-purple-800">Changes:</strong> {rev.changesDetails}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>{formatDateInTimezone(rev.requestedAt, timezone, true)}</span>
                          <span>
                            {rev.completedByName
                              ? `By ${rev.completedByName}`
                              : `Elapsed: ${formatWaitingTime(rev.requestedAt, rev.completedAt)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={req.priority} size="sm" />
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {waitingTime}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Designer Complete button */}
                  {isDesignerForReq && req.status === 'PENDING' && onCompleteRequest && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompleteRequest(req);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Complete
                    </button>
                  )}

                  {/* Revision Request Button */}
                  {req.status === 'COMPLETED' && isSalesOwner && onOpenRevisionRequest && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRevisionRequest(req);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 shadow-2xs"
                    >
                      <FileEdit className="w-3 h-3" />
                      Revision Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
