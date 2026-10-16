import React, { useState } from 'react';
import { MockupRequest, UserProfile } from '../../types';
import { requestMockupRevision } from '../../services/requestService';
import { FileEdit, Send, X, AlertTriangle } from 'lucide-react';

interface RevisionModalProps {
  request: MockupRequest | null;
  currentUser: UserProfile;
  timezone?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({
  request,
  currentUser,
  timezone,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [changesDetails, setChangesDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  const nextRevNumber = (request.revisions?.length || 0) + 1;

  const handleSubmit = async (e: React.FormEvent) => {
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

      setChangesDetails('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to send revision request.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Revision Request
                <span className="font-mono text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded text-xs border border-purple-200">
                  {request.requestId}
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                  Round #{nextRevNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Assigned Designer: <strong className="text-slate-700">{request.designerName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mb-3 p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-[11px] text-slate-700 leading-relaxed">
          The Request ID will remain exactly <strong className="font-mono text-purple-900">{request.requestId}</strong>. This order will be returned to the design team&apos;s active queue with your changes note.
        </div>

        {/* Form with ONLY ONE input text box: "Changes Details" */}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label
              htmlFor="changesDetails"
              className="block text-xs font-bold text-slate-900 mb-1.5"
            >
              Changes Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="changesDetails"
              name="changesDetails"
              rows={5}
              autoFocus
              value={changesDetails}
              onChange={(e) => setChangesDetails(e.target.value)}
              required
              placeholder="Write detailed notes of what needs to be changed in this design for the designer..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 leading-relaxed placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !changesDetails.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Sending to Designer...' : 'Send Revision Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
