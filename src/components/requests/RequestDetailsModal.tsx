import React, { useState } from 'react';
import { MockupRequest, UserProfile } from '../../types';
import { PriorityBadge, StatusBadge, SourceBadge, RevisionBadge } from '../common/Badges';
import {
  completeMockupRequest,
  rejectMockupRequest,
  resubmitMockupRequest,
  reopenMockupRequest,
  softDeleteMockupRequest,
  requestMockupRevision,
  requestBackMockup,
  resubmitReturnedRequest,
} from '../../services/requestService';
import { generateProductionJobSheetPdf } from '../../utils/pdfGenerator';
import { formatDateInTimezone, formatWaitingTime } from '../../utils/dateUtils';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Paperclip,
  RotateCcw,
  Trash2,
  Calendar,
  User,
  AlertTriangle,
  FileEdit,
  Send,
  Copy,
  Check,
  FileDown,
  Loader2,
  Plus,
  CornerUpLeft,
} from 'lucide-react';

import { CopyButton } from '../common/CopyButton';

interface RequestDetailsModalProps {
  request: MockupRequest | null;
  currentUser: UserProfile;
  timezone?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  initialOpenRevisionModal?: boolean;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
  request,
  currentUser,
  timezone = 'Asia/Dubai',
  isOpen,
  onClose,
  onUpdate,
  initialOpenRevisionModal = false,
}) => {
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestBackModal, setShowRequestBackModal] = useState(false);
  const [requestBackReason, setRequestBackReason] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(initialOpenRevisionModal);
  const [changesDetails, setChangesDetails] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resubmit edit states for Sales Representative (Rejected)
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editItem, setEditItem] = useState('');

  // Resubmit edit states for Returned for Clarification (REQUEST_BACK)
  const [isResubmittingReturned, setIsResubmittingReturned] = useState(false);
  const [returnedItems, setReturnedItems] = useState<string[]>([]);
  const [returnedLinks, setReturnedLinks] = useState<string[]>([]);
  const [returnedNotes, setReturnedNotes] = useState('');
  const [returnedAttachments, setReturnedAttachments] = useState<Array<{ id: string; name: string; url: string; size: number; type: string; uploadedAt: string }>>([]);

  React.useEffect(() => {
    if (initialOpenRevisionModal) {
      setShowRevisionModal(true);
    }
  }, [initialOpenRevisionModal, request?.id]);

  React.useEffect(() => {
    if (request) {
      if (request.itemNames && request.itemNames.length > 0) {
        setReturnedItems([...request.itemNames]);
      } else if (request.itemName) {
        setReturnedItems([request.itemName]);
      } else {
        setReturnedItems(['']);
      }

      if (request.additionalReferenceLinks && request.additionalReferenceLinks.length > 0) {
        setReturnedLinks([...request.additionalReferenceLinks]);
      } else {
        const initialL: string[] = [];
        if (request.referenceLinks) initialL.push(request.referenceLinks);
        if (request.additionalLinks) initialL.push(request.additionalLinks);
        setReturnedLinks(initialL.length > 0 ? initialL : ['']);
      }

      setReturnedNotes(request.notes || '');
      setReturnedAttachments([]);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const isDesigner = currentUser.role === 'DESIGNER' && request.designerId === currentUser.userId;
  const isSalesOwner =
    (currentUser.role === 'SALES_REPRESENTATIVE' &&
      request.salesRepresentativeId === currentUser.userId) ||
    currentUser.role === 'HEAD_OF_SALES' ||
    currentUser.role === 'ADMIN';
  const isAdmin = currentUser.role === 'ADMIN';

  const handleComplete = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await completeMockupRequest({
        request,
        designerId: currentUser.userId,
        designerName: currentUser.name,
        timezone,
      });
      setShowCompleteConfirm(false);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to complete request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setErrorMessage('Please provide a reason for rejecting this request.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await rejectMockupRequest({
        request,
        designerId: currentUser.userId,
        designerName: currentUser.name,
        rejectionReason: rejectionReason.trim(),
      });
      setShowRejectModal(false);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reject request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNotes.trim()) {
      setErrorMessage('Notes / Instructions are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await resubmitMockupRequest({
        request,
        salesRepresentativeId: currentUser.userId,
        salesRepresentativeName: currentUser.name,
        updatedFields: {
          notes: editNotes.trim(),
          ...(request.source !== 'gallabox'
            ? {
                mockupTitle: editTitle.trim() || request.mockupTitle,
                itemName: editItem.trim() || request.itemName,
              }
            : {}),
        },
      });
      setIsResubmitting(false);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resubmit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!confirm('Are you sure you want to reopen this completed mockup request?')) return;
    setIsSubmitting(true);
    try {
      await reopenMockupRequest({
        request,
        adminId: currentUser.userId,
        adminName: currentUser.name,
      });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reopen request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!confirm('Are you sure you want to soft delete this mockup request? Historical logs and counters will be preserved.')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await softDeleteMockupRequest({
        requestId: request.id,
        adminId: currentUser.userId,
        adminName: currentUser.name,
      });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changesDetails.trim()) {
      setErrorMessage('Please enter Changes Details.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestMockupRevision({
        request,
        salesRepresentativeId: currentUser.userId,
        salesRepresentativeName: currentUser.name,
        changesDetails: changesDetails.trim(),
        timezone,
      });
      setShowRevisionModal(false);
      setChangesDetails('');
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit revision request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadJobSheet = async () => {
    setIsGeneratingPdf(true);
    setErrorMessage(null);
    try {
      await generateProductionJobSheetPdf({
        request,
        timezone,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate Production Job Sheet PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleRequestBack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestBackReason.trim()) {
      setErrorMessage('Please describe the required clarification or missing assets.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestBackMockup({
        request,
        designerId: currentUser.userId,
        designerName: currentUser.name,
        reason: requestBackReason.trim(),
      });
      setShowRequestBackModal(false);
      setRequestBackReason('');
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to return request back.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmitReturned = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = returnedItems.map((i) => i.trim()).filter(Boolean);
    const validLinks = returnedLinks.map((l) => l.trim()).filter(Boolean);

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await resubmitReturnedRequest({
        request,
        salesRepresentativeId: currentUser.userId,
        salesRepresentativeName: currentUser.name,
        updatedNotes: returnedNotes.trim() || undefined,
        itemNames: validItems.length > 0 ? validItems : undefined,
        additionalReferenceLinks: validLinks.length > 0 ? validLinks : undefined,
        newAttachments: returnedAttachments.length > 0 ? returnedAttachments : undefined,
        timezone,
      });
      setIsResubmittingReturned(false);
      onUpdate();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resubmit request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnedAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setReturnedAttachments((prev) => [
          ...prev,
          {
            id: `ATT_RET_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            url: reader.result as string,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0c192c] rounded-t-2xl flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-extrabold text-lg text-cyan-300 tracking-wider">
                {request.requestId}
              </span>
              <CopyButton
                text={request.requestId}
                compact
                className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white"
              />
            </div>
            {request.currentRevision && request.currentRevision > 0 && (
              <RevisionBadge revisionNumber={request.currentRevision} />
            )}
            <PriorityBadge priority={request.priority} />
            <StatusBadge status={request.status} />
            <SourceBadge source={request.source} />
          </div>

          <div className="flex items-center gap-2">
            {/* Download Production Job Sheet PDF */}
            <button
              type="button"
              onClick={handleDownloadJobSheet}
              disabled={isGeneratingPdf}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Download Merchlist Production Job Sheet (PDF)"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-cyan-300" />
              )}
              <span className="hidden sm:inline">Job Sheet (PDF)</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Active Revision Banner if request is currently in revision and pending */}
          {request.status === 'PENDING' && request.currentRevision && request.currentRevision > 0 && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 shadow-2xs">
              <div className="flex items-start gap-3">
                <FileEdit className="w-5 h-5 text-purple-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-purple-950 text-sm">
                      Revision #{request.currentRevision} in Progress
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-600 text-white">
                      Active
                    </span>
                  </div>
                  <div className="mt-1.5 p-2.5 bg-white rounded-lg border border-purple-200 text-slate-900 font-medium whitespace-pre-wrap leading-relaxed">
                    <span className="font-bold text-purple-900 block text-[11px] mb-0.5">
                      Changes Details:
                    </span>
                    {request.latestChangesDetails}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Returned for Clarification (REQUEST_BACK) Alert Banner */}
          {request.status === 'REQUEST_BACK' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 shadow-2xs animate-in fade-in">
              <div className="flex items-start gap-3">
                <RotateCcw className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-amber-950 text-sm">
                      Returned for Clarification by Designer
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-slate-950">
                      Action Required
                    </span>
                  </div>
                  <div className="mt-2 p-3 bg-white rounded-lg border border-amber-200 text-slate-900 leading-relaxed shadow-2xs">
                    <span className="font-bold text-amber-900 block text-[11px] mb-0.5">
                      Clarification / Reason Requested:
                    </span>
                    <p className="whitespace-pre-wrap font-medium">{request.requestBackReason || 'Designer requested updates or clarification.'}</p>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-2">
                    Returned on {formatDateInTimezone(request.requestBackAt, timezone)} by {request.requestBackByName || request.designerName}
                  </p>

                  {isSalesOwner && !isResubmittingReturned && (
                    <button
                      onClick={() => setIsResubmittingReturned(true)}
                      className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileEdit className="w-4 h-4" />
                      <span>Update & Resubmit to Designer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Returned Request Resubmission Form (Sales Representative) */}
          {isResubmittingReturned && (
            <form onSubmit={handleResubmitReturned} className="p-4 bg-amber-50/50 rounded-2xl border border-amber-300 space-y-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <h4 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                  <CornerUpLeft className="w-4 h-4 text-amber-700" />
                  <span>Update Specifications & Return to Designer Queue</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsResubmittingReturned(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Multiple Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Item(s) / Product(s)
                  </label>
                  <button
                    type="button"
                    onClick={() => setReturnedItems((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {returnedItems.map((itm, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={itm}
                        onChange={(e) => {
                          const next = [...returnedItems];
                          next[idx] = e.target.value;
                          setReturnedItems(next);
                        }}
                        placeholder={`Item #${idx + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      {returnedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setReturnedItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Updated Notes / Response to Designer */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Clarification Notes / Instructions for Designer
                </label>
                <textarea
                  rows={3}
                  value={returnedNotes}
                  onChange={(e) => setReturnedNotes(e.target.value)}
                  placeholder="Explain the updates made, clarification for the designer, or new specifications..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Reference Links */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Reference Links (Drive, Canva, Figma)
                  </label>
                  <button
                    type="button"
                    onClick={() => setReturnedLinks((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Link</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {returnedLinks.map((lnk, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={lnk}
                        onChange={(e) => {
                          const next = [...returnedLinks];
                          next[idx] = e.target.value;
                          setReturnedLinks(next);
                        }}
                        placeholder="https://..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      {returnedLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setReturnedLinks((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload New Attachments */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Upload Additional Files / Logos (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleReturnedAttachmentUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
                />
                {returnedAttachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {returnedAttachments.map((att) => (
                      <span key={att.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-amber-300 text-[11px] font-semibold text-slate-800">
                        <Paperclip className="w-3 h-3 text-amber-700" />
                        {att.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => setIsResubmittingReturned(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Resubmitting...' : 'Confirm Resubmission to Designer'}
                </button>
              </div>
            </form>
          )}

          {/* Rejection Alert Banner if rejected */}
          {request.status === 'REJECTED' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <div className="flex items-start gap-2.5">
                <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-rose-900 text-sm">Request Rejected by Designer</h4>
                  <p className="text-rose-700 mt-1">
                    <span className="font-semibold">Reason:</span> {request.rejectionReason}
                  </p>
                  <p className="text-[11px] text-rose-600 mt-1">
                    Rejected on {formatDateInTimezone(request.rejectedAt, timezone)} by {request.rejectedByName}
                  </p>

                  {isSalesOwner && !isResubmitting && (
                    <button
                      onClick={() => {
                        setEditNotes(request.notes);
                        setEditTitle(request.mockupTitle || '');
                        setEditItem(request.itemName || '');
                        setIsResubmitting(true);
                      }}
                      className="mt-3 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-xs"
                    >
                      Correct & Resubmit Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Resubmission Form (if sales rep clicked resubmit) */}
          {isResubmitting && (
            <form onSubmit={handleResubmit} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 text-sm">Update and Resubmit Request</h4>
              {request.source !== 'gallabox' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Mockup Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Item / Product Name</label>
                    <input
                      type="text"
                      value={editItem}
                      onChange={(e) => setEditItem(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Corrected Notes / Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded border border-slate-300 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsResubmitting(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#0c192c] text-white rounded font-semibold hover:bg-slate-800 shadow-xs"
                >
                  {isSubmitting ? 'Resubmitting...' : 'Confirm Resubmission'}
                </button>
              </div>
            </form>
          )}

          {/* Quick Copy Action Bar for Designer */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 via-[#0c192c] to-cyan-950 text-white rounded-xl border border-cyan-800/40 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
                <Copy className="w-4 h-4 text-cyan-400" />
              </span>
              <div>
                <span className="text-xs font-bold text-white block">Designer Copy Station</span>
                <span className="text-[10px] text-cyan-300/80">Copy single client fields or all specs into clipboard</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {request.clientName && (
                <CopyButton text={request.clientName} label="Client Name" />
              )}
              {request.clientMobileNumber && (
                <CopyButton text={request.clientMobileNumber} label="Phone" />
              )}
              <CopyButton
                text={`Request ID: ${request.requestId}\nMockup Title: ${request.mockupTitle || 'N/A'}\nItem Name: ${request.itemName || 'N/A'}\nClient Name: ${request.clientName || 'N/A'}\nClient Mobile: ${request.clientMobileNumber || 'N/A'}\nContact By: ${request.contactBy || 'N/A'}\nSource: ${request.source}\nPriority: ${request.priority}\n\nNotes / Instructions:\n${request.notes}${request.referenceLinks ? `\n\nReference Link: ${request.referenceLinks}` : ''}${request.additionalLinks ? `\nAdditional Link: ${request.additionalLinks}` : ''}`}
                label="Copy All Details"
                className="bg-cyan-500 text-slate-950 font-bold border-cyan-400 hover:bg-cyan-400"
              />
            </div>
          </div>

          {/* Primary Request Specs with individual copy buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Mockup Title */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                  Mockup Title
                </span>
                <span className="text-slate-900 font-bold text-xs truncate block select-all mt-0.5">
                  {request.mockupTitle || (request.source === 'gallabox' ? 'Gallabox Request' : 'Not specified')}
                </span>
              </div>
              {request.mockupTitle && <CopyButton text={request.mockupTitle} compact />}
            </div>

            {/* Item Name(s) */}
            {request.itemNames && request.itemNames.length > 0 ? (
              <div className="md:col-span-2 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider block">
                    Ordered Product(s) / Item(s) ({request.itemNames.length})
                  </span>
                  <CopyButton
                    text={request.itemNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}
                    label="All Items"
                    compact
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {request.itemNames.map((itm, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-900 text-xs truncate select-all">
                          {itm}
                        </span>
                      </div>
                      <CopyButton text={itm} compact />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                    Item / Product Name
                  </span>
                  <span className="text-slate-900 font-bold text-xs truncate block select-all mt-0.5">
                    {request.itemName || (request.source === 'gallabox' ? 'Not Applicable' : 'Not specified')}
                  </span>
                </div>
                {request.itemName && <CopyButton text={request.itemName} compact />}
              </div>
            )}

            {/* Client Name */}
            <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-200/80 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-cyan-800 font-bold text-[10px] uppercase tracking-wider block">
                  Client Name
                </span>
                <span className="text-slate-900 font-bold text-xs truncate block select-all mt-0.5">
                  {request.clientName || 'Not specified'}
                </span>
              </div>
              {request.clientName && (
                <CopyButton text={request.clientName} label="Name" compact className="bg-white" />
              )}
            </div>

            {/* Client Mobile Number */}
            <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-200/80 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-cyan-800 font-bold text-[10px] uppercase tracking-wider block">
                  Client Mobile Number
                </span>
                <span className="font-mono text-slate-900 font-bold text-xs truncate block select-all mt-0.5">
                  {request.clientMobileNumber || 'Not specified'}
                </span>
              </div>
              {request.clientMobileNumber && (
                <CopyButton text={request.clientMobileNumber} label="Phone" compact className="bg-white" />
              )}
            </div>

            {/* Contact By */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                  Contact By
                </span>
                <span className="text-slate-900 font-semibold text-xs truncate block select-all mt-0.5">
                  {request.contactBy || '-'}
                </span>
              </div>
              {request.contactBy && <CopyButton text={request.contactBy} compact />}
            </div>

            {/* Sales Rep */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                  Sales Representative
                </span>
                <span className="text-slate-900 font-semibold text-xs truncate block mt-0.5">
                  {request.salesRepresentativeName}
                </span>
              </div>
              <CopyButton text={request.salesRepresentativeName} compact />
            </div>

            {/* Assigned Designer */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                  Assigned Designer
                </span>
                <span className="text-slate-900 font-semibold text-xs truncate block mt-0.5">
                  {request.designerName}
                </span>
              </div>
              <CopyButton text={request.designerName} compact />
            </div>

            {/* Waiting Time */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                  Waiting / Total Time
                </span>
                <span className="text-slate-900 font-semibold text-xs truncate block mt-0.5">
                  {request.status === 'COMPLETED'
                    ? formatWaitingTime(request.createdAt, request.completedAt)
                    : formatWaitingTime(request.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes / Instructions with Copy Button */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Notes / Instructions
              </h4>
              <CopyButton text={request.notes} label="Notes" />
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs text-xs select-all">
              {request.notes}
            </div>
          </div>

          {/* Reference Links */}
          {(request.referenceLinks || request.additionalLinks) && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Reference Links</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {request.referenceLinks && (
                  <a
                    href={request.referenceLinks}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between hover:bg-slate-50 text-cyan-700 font-medium"
                  >
                    <span className="truncate max-w-[240px]">{request.referenceLinks}</span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                )}
                {request.additionalLinks && (
                  <a
                    href={request.additionalLinks}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between hover:bg-slate-50 text-cyan-700 font-medium"
                  >
                    <span className="truncate max-w-[240px]">{request.additionalLinks}</span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 text-xs mb-2 uppercase tracking-wider">
                Attachments ({request.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {request.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                  >
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="truncate flex-1 font-medium">{att.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Revision History Table */}
          {request.revisions && request.revisions.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 text-xs mb-3 uppercase tracking-wider flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-purple-600" />
                Revision History ({request.revisions.length})
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Revision</th>
                      <th className="py-2.5 px-3">Changes Details</th>
                      <th className="py-2.5 px-3">Requested At</th>
                      <th className="py-2.5 px-3">Requested By</th>
                      <th className="py-2.5 px-3">Completed At</th>
                      <th className="py-2.5 px-3">Completed By</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {request.revisions.map((rev) => (
                      <tr key={rev.revisionNumber} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-bold font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Rev #{rev.revisionNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 max-w-[220px] whitespace-pre-wrap font-medium">
                          {rev.changesDetails}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {formatDateInTimezone(rev.requestedAt, timezone, true)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                          {rev.requestedByName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {rev.completedAt ? (
                            formatDateInTimezone(rev.completedAt, timezone, true)
                          ) : (
                            <span className="text-amber-600 font-medium">In Progress</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          {rev.completedByName || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {rev.completedAt ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3" />
                              Active Queue
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Complete Lifecycle Timeline */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs mb-3 uppercase tracking-wider">
              Request Timeline
            </h4>
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 pl-7">
              {request.timeline && request.timeline.length > 0 ? (
                request.timeline.map((evt, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-7 top-1 w-2.5 h-2.5 rounded-full bg-cyan-600 ring-4 ring-white" />
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-slate-900">{evt.action}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateInTimezone(evt.timestamp, timezone, true)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      By {evt.performedByName} {evt.note ? `— ${evt.note}` : ''}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">
                  Created {formatDateInTimezone(request.createdAt, timezone, true)} by{' '}
                  {request.salesRepresentativeName}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                {request.status === 'COMPLETED' && (
                  <button
                    onClick={handleReopen}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 text-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reopen
                  </button>
                )}
                <button
                  onClick={handleSoftDelete}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Soft Delete
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Sales Representative Action: Revision Request on Completed Order */}
            {request.status === 'COMPLETED' && (isSalesOwner || isAdmin) && (
              <button
                onClick={() => setShowRevisionModal(true)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <FileEdit className="w-4 h-4" />
                Revision Request
              </button>
            )}

            {/* Designer Actions for Pending Requests */}
            {isDesigner && request.status === 'PENDING' && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 font-semibold hover:bg-rose-50 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Request
                </button>
                <button
                  onClick={() => setShowCompleteConfirm(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Complete
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Dialog: Revision Request with "Changes Details" single input */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-purple-600" />
                Revision Request — {request.requestId}
              </h4>
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Describe the modifications or adjustments required for this design. The request ID will remain unchanged and will be returned to the Designer&apos;s active queue.
            </p>
            <form onSubmit={handleRevisionSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Changes Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={changesDetails}
                  onChange={(e) => setChangesDetails(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Sending...' : 'Send Revision Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Complete Request */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Complete Mockup Request</h4>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to mark this mockup as completed? This will notify the Sales Representative and record your completion timestamp.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCompleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
              >
                {isSubmitting ? 'Completing...' : 'Mark as Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Reject Request with Required Reason */}
      {showRejectModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h4 className="text-sm font-bold text-slate-900 mb-1">Reject Mockup Request</h4>
            <p className="text-xs text-slate-500 mb-4">
              Why are you rejecting this request?
            </p>
            <form onSubmit={handleReject}>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
