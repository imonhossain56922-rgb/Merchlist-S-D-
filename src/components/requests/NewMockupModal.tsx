import React, { useState, useEffect } from 'react';
import { UserProfile, RequestSource, RequestPriority, DesignerCapacity } from '../../types';
import { createMockupRequest, getDesignerCapacity } from '../../services/requestService';
import { X, Upload, AlertCircle, Zap, Clock, ShieldAlert, Check, Palette } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface NewMockupModalProps {
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  timezone?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewMockupModal: React.FC<NewMockupModalProps> = ({
  currentUser,
  allUsers = [],
  timezone,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [source, setSource] = useState<RequestSource>('whatsapp');
  const [priority, setPriority] = useState<RequestPriority>('REGULAR');
  const [mockupTitle, setMockupTitle] = useState('');
  const [itemName, setItemName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientMobileNumber, setClientMobileNumber] = useState('');
  const [contactBy, setContactBy] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceLinks, setReferenceLinks] = useState('');
  const [additionalLinks, setAdditionalLinks] = useState('');
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; url: string; size: number; type: string; uploadedAt: string }>>([]);

  const [availableDesigners, setAvailableDesigners] = useState<UserProfile[]>([]);

  // Keep available designers updated from allUsers or fetch from Firestore if empty
  useEffect(() => {
    const fromProps = allUsers.filter((u) => u.role === 'DESIGNER' && u.active && !u.deleted);
    if (fromProps.length > 0) {
      setAvailableDesigners(fromProps);
    } else if (isOpen) {
      // Direct query fallback to ensure designers are always loaded
      getDocs(query(collection(db, 'users'), where('role', '==', 'DESIGNER')))
        .then((snap) => {
          const list = snap.docs
            .map((d) => d.data() as UserProfile)
            .filter((u) => u.active && !u.deleted);
          setAvailableDesigners(list);
        })
        .catch((err) => console.warn('Failed to load designers in modal:', err));
    }
  }, [allUsers, isOpen]);

  const [selectedDesignerId, setSelectedDesignerId] = useState<string>(() => {
    return currentUser.assignedDesignerId || '';
  });

  // Automatically select assigned designer or first available designer
  useEffect(() => {
    if (!selectedDesignerId || !availableDesigners.some((d) => d.userId === selectedDesignerId)) {
      if (currentUser.assignedDesignerId && availableDesigners.some((d) => d.userId === currentUser.assignedDesignerId)) {
        setSelectedDesignerId(currentUser.assignedDesignerId);
      } else if (availableDesigners.length > 0) {
        setSelectedDesignerId(availableDesigners[0].userId);
      }
    }
  }, [availableDesigners, currentUser.assignedDesignerId, selectedDesignerId]);

  const selectedDesigner = availableDesigners.find((d) => d.userId === selectedDesignerId) ||
    allUsers.find((u) => u.userId === selectedDesignerId);

  const [capacity, setCapacity] = useState<DesignerCapacity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Designer capacity
  useEffect(() => {
    const designerId = selectedDesignerId || currentUser.assignedDesignerId;
    if (designerId) {
      getDesignerCapacity(designerId, selectedDesigner?.name || currentUser.assignedDesignerName).then((cap) => {
        setCapacity(cap);
      });
    }
  }, [selectedDesignerId, currentUser.assignedDesignerId, selectedDesigner?.name, isOpen]);

  if (!isOpen) return null;

  const isGallabox = source === 'gallabox';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert file to mock secure data url for local preview/storage
    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage('File size exceeds 15MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            url,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const designerIdToUse = selectedDesignerId || currentUser.assignedDesignerId;
    const designerNameToUse = selectedDesigner?.name || currentUser.assignedDesignerName || 'Assigned Designer';

    if (!designerIdToUse) {
      setErrorMessage('Please select a Designer for this mockup request.');
      return;
    }

    if (!notes.trim()) {
      setErrorMessage('Notes / Instructions are required.');
      return;
    }

    if (!isGallabox) {
      if (!mockupTitle.trim()) {
        setErrorMessage('Mockup Title is required.');
        return;
      }
      if (!itemName.trim()) {
        setErrorMessage('Item / Product Name is required.');
        return;
      }
    }

    // Capacity check
    if (priority === 'SUPER_URGENT' && capacity && !capacity.canAcceptSuperUrgent) {
      setErrorMessage(
        'The assigned Designer currently has an active Super Urgent request. Please wait until it is completed or use another priority.'
      );
      return;
    }

    if (priority === 'URGENT' && capacity && !capacity.canAcceptUrgent) {
      setErrorMessage(
        'The assigned Designer currently has the maximum number of active Urgent requests. Please wait until an Urgent request is completed or use Regular priority.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await createMockupRequest({
        source,
        priority,
        mockupTitle: isGallabox ? null : mockupTitle.trim(),
        itemName: isGallabox ? null : itemName.trim(),
        clientName: clientName.trim() || null,
        clientMobileNumber: clientMobileNumber.trim() || null,
        contactBy: isGallabox ? null : contactBy.trim() || null,
        notes: notes.trim(),
        referenceLinks: isGallabox ? null : referenceLinks.trim() || null,
        additionalLinks: isGallabox ? null : additionalLinks.trim() || null,
        attachments,
        salesRepresentativeId: currentUser.userId,
        salesRepresentativeName: currentUser.name,
        designerId: designerIdToUse,
        designerName: designerNameToUse,
        timezone,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create mockup request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0c192c] rounded-t-2xl flex items-center justify-between text-white">
          <div>
            <h3 className="text-base font-bold tracking-tight">New Mockup Request</h3>
            <p className="text-xs text-cyan-300">
              Assigned to: <span className="font-semibold text-white">{selectedDesigner?.name || currentUser.assignedDesignerName || 'Auto-assigning Designer'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Designer Selection */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-700" />
                <span>Assigned Designer</span>
                <span className="text-rose-500">*</span>
              </label>
              {selectedDesigner && (
                <span className="text-[10px] text-slate-500 font-mono">
                  ID: {selectedDesigner.loginId}
                </span>
              )}
            </div>
            <select
              value={selectedDesignerId}
              onChange={(e) => setSelectedDesignerId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
            >
              <option value="">-- Select Designer --</option>
              {availableDesigners.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.name} (ID: {d.loginId})
                </option>
              ))}
            </select>
          </div>

          {/* Designer Capacity Widget */}
          {capacity && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">
                  {capacity.designerName} Workload Capacity
                </span>
                <span className="text-[11px] text-slate-500">
                  Active Priority Limit
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div
                  className={`p-2 rounded-lg border ${
                    capacity.canAcceptSuperUrgent
                      ? 'bg-white border-slate-200 text-slate-700'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block text-slate-500">
                    Super Urgent
                  </span>
                  <span className="font-bold">{capacity.superUrgentCount} / 1 occupied</span>
                </div>

                <div
                  className={`p-2 rounded-lg border ${
                    capacity.canAcceptUrgent
                      ? 'bg-white border-slate-200 text-slate-700'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider block text-slate-500">
                    Urgent
                  </span>
                  <span className="font-bold">{capacity.urgentCount} / 2 occupied</span>
                </div>

                <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700">
                  <span className="text-[10px] font-semibold uppercase tracking-wider block text-slate-500">
                    Regular
                  </span>
                  <span className="font-bold text-emerald-600">Available</span>
                </div>
              </div>
            </div>
          )}

          {/* Request Source Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Request Source <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['gallabox', 'whatsapp', 'email', 'others'] as RequestSource[]).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSource(src)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-center capitalize ${
                    source === src
                      ? 'bg-[#0c192c] text-white border-[#0c192c] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Priority <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPriority('REGULAR')}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  priority === 'REGULAR'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Regular
              </button>

              <button
                type="button"
                onClick={() => setPriority('URGENT')}
                disabled={capacity ? !capacity.canAcceptUrgent : false}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  priority === 'URGENT'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : capacity && !capacity.canAcceptUrgent
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Urgent {capacity && !capacity.canAcceptUrgent && '(Full)'}
              </button>

              <button
                type="button"
                onClick={() => setPriority('SUPER_URGENT')}
                disabled={capacity ? !capacity.canAcceptSuperUrgent : false}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  priority === 'SUPER_URGENT'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : capacity && !capacity.canAcceptSuperUrgent
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Super Urgent {capacity && !capacity.canAcceptSuperUrgent && '(Full)'}
              </button>
            </div>
          </div>

          {/* Form Fields: DYNAMIC BASED ON SOURCE */}
          {isGallabox ? (
            /* GALLABOX SOURCE ONLY: Client Name, Client Mobile Number, Notes */
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Client Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={clientMobileNumber}
                    onChange={(e) => setClientMobileNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Notes / Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            /* WHATSAPP / EMAIL / OTHERS: Standard Full Form */
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Mockup Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mockupTitle}
                    onChange={(e) => setMockupTitle(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Item / Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Client Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={clientMobileNumber}
                    onChange={(e) => setClientMobileNumber(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Contact By
                  </label>
                  <input
                    type="text"
                    value={contactBy}
                    onChange={(e) => setContactBy(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Notes / Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Reference Link
                  </label>
                  <input
                    type="url"
                    value={referenceLinks}
                    onChange={(e) => setReferenceLinks(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Additional Links
                  </label>
                  <input
                    type="url"
                    value={additionalLinks}
                    onChange={(e) => setAdditionalLinks(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Attachments Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Attachments (Images / Reference files)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-600 font-medium">Click to select files</p>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <span className="truncate max-w-[300px] text-slate-700 font-medium">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Request...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
