import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, RequestSource, RequestPriority, DesignerCapacity } from '../../types';
import { createMockupRequest, getDesignerCapacity } from '../../services/requestService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  FilePlus2,
  Upload,
  AlertCircle,
  Zap,
  Clock,
  ShieldAlert,
  Check,
  CheckCircle2,
  Palette,
  ExternalLink,
  Trash2,
  FileText,
  User,
  Phone,
  Tag,
  Layers,
  ArrowLeft,
} from 'lucide-react';

interface NewMockupViewProps {
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  timezone?: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export const NewMockupView: React.FC<NewMockupViewProps> = ({
  currentUser,
  allUsers = [],
  timezone,
  onComplete,
  onCancel,
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
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; url: string; size: number; type: string; uploadedAt: string }>
  >([]);

  const [availableDesigners, setAvailableDesigners] = useState<UserProfile[]>([]);

  // Keep available designers updated from props or query Firestore if empty
  useEffect(() => {
    const fromProps = allUsers.filter((u) => u.role === 'DESIGNER' && u.active && !u.deleted);
    if (fromProps.length > 0) {
      setAvailableDesigners(fromProps);
    } else {
      getDocs(query(collection(db, 'users'), where('role', '==', 'DESIGNER')))
        .then((snap) => {
          const list = snap.docs
            .map((d) => d.data() as UserProfile)
            .filter((u) => u.active && !u.deleted);
          setAvailableDesigners(list);
        })
        .catch((err) => console.warn('Failed to load designers in NewMockupView:', err));
    }
  }, [allUsers]);

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

  const selectedDesigner = useMemo(() => {
    return (
      availableDesigners.find((d) => d.userId === selectedDesignerId) ||
      allUsers.find((u) => u.userId === selectedDesignerId)
    );
  }, [availableDesigners, allUsers, selectedDesignerId]);

  const [capacity, setCapacity] = useState<DesignerCapacity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load Designer capacity
  useEffect(() => {
    const designerId = selectedDesignerId || currentUser.assignedDesignerId;
    if (designerId) {
      getDesignerCapacity(designerId, selectedDesigner?.name || currentUser.assignedDesignerName).then(
        (cap) => {
          setCapacity(cap);
        }
      );
    }
  }, [selectedDesignerId, currentUser.assignedDesignerId, selectedDesigner?.name]);

  const isGallabox = source === 'gallabox';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

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
    const designerNameToUse =
      selectedDesigner?.name || currentUser.assignedDesignerName || 'Assigned Designer';

    if (!designerIdToUse) {
      setErrorMessage(
        'Please select a Designer for this mockup request. If no designers are listed, contact an Administrator.'
      );
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

    // Capacity guardrails
    if (priority === 'SUPER_URGENT' && capacity && !capacity.canAcceptSuperUrgent) {
      setErrorMessage(
        'The assigned Designer currently has an active Super Urgent request (Max 1). Please wait or choose another priority.'
      );
      return;
    }

    if (priority === 'URGENT' && capacity && !capacity.canAcceptUrgent) {
      setErrorMessage(
        'The assigned Designer currently has maximum active Urgent requests (Max 2). Please wait or use Regular priority.'
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

      setSuccessMessage('Mockup Request created successfully! Assigned to Designer.');
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create mockup request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors mr-1"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <span className="p-2 rounded-xl bg-cyan-50 text-cyan-800">
              <FilePlus2 className="w-5 h-5 text-cyan-700" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0c192c] tracking-tight">
                Create New Mockup Request
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fill in the client brief and specifications. All inputs can be easily copied by designers.
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Designer Indicator */}
        <div className="p-3 bg-cyan-50/70 border border-cyan-200/80 rounded-xl flex items-center gap-3">
          <Palette className="w-5 h-5 text-cyan-700 flex-shrink-0" />
          <div className="text-left text-xs">
            <span className="text-[10px] text-cyan-700 font-semibold uppercase tracking-wider block">
              Assigned Designer
            </span>
            <span className="font-bold text-slate-900 block">
              {selectedDesigner?.name || currentUser.assignedDesignerName || 'None Assigned'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to submit request</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success!</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Designer Selector */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-700" />
              <span>Select Designer to Assign</span> <span className="text-rose-500">*</span>
            </label>
            {selectedDesigner && (
              <span className="text-[11px] text-slate-500 font-mono">
                ID: {selectedDesigner.loginId}
              </span>
            )}
          </div>
          <select
            value={selectedDesignerId}
            onChange={(e) => setSelectedDesignerId(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
          >
            <option value="">-- Choose Assigned Designer --</option>
            {availableDesigners.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name} (ID: {d.loginId})
              </option>
            ))}
          </select>
        </div>

        {/* 1. Request Source */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">
            Request Source <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'whatsapp', label: 'WhatsApp', color: 'hover:border-emerald-500 text-emerald-700' },
              { id: 'gallabox', label: 'Gallabox', color: 'hover:border-cyan-500 text-cyan-700' },
              { id: 'email', label: 'Email', color: 'hover:border-blue-500 text-blue-700' },
              { id: 'others', label: 'Others', color: 'hover:border-purple-500 text-purple-700' },
            ].map((s) => {
              const isSelected = source === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.id as RequestSource)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#0c192c] text-white border-[#0c192c] shadow-xs'
                      : `bg-slate-50/80 text-slate-700 border-slate-200 ${s.color}`
                  }`}
                >
                  <span>{s.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              );
            })}
          </div>
          {isGallabox && (
            <p className="text-[11px] text-cyan-700 mt-2 bg-cyan-50/80 p-2.5 rounded-lg border border-cyan-200">
              Gallabox orders only require Notes/Instructions and optional Client details. Title & Item Name are automated.
            </p>
          )}
        </div>

        {/* 2. Priority Selection & Live Capacity */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="block text-xs font-bold text-slate-800">
              Priority Level <span className="text-rose-500">*</span>
            </label>
            {capacity && (
              <div className="flex items-center gap-3 text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    capacity.canAcceptSuperUrgent
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Super Urgent: {capacity.superUrgentCount}/{capacity.superUrgentMax}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    capacity.canAcceptUrgent
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Urgent: {capacity.urgentCount}/{capacity.urgentMax}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Regular */}
            <button
              type="button"
              onClick={() => setPriority('REGULAR')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                priority === 'REGULAR'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Regular</span>
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className={`text-[10px] ${priority === 'REGULAR' ? 'text-slate-300' : 'text-slate-500'}`}>
                Standard queue workflow
              </p>
            </button>

            {/* Urgent */}
            <button
              type="button"
              disabled={capacity ? !capacity.canAcceptUrgent : false}
              onClick={() => setPriority('URGENT')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                priority === 'URGENT'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Urgent</span>
                <Zap className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className={`text-[10px] ${priority === 'URGENT' ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                Max 2 per designer
              </p>
            </button>

            {/* Super Urgent */}
            <button
              type="button"
              disabled={capacity ? !capacity.canAcceptSuperUrgent : false}
              onClick={() => setPriority('SUPER_URGENT')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                priority === 'SUPER_URGENT'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-rose-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Super Urgent</span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <p className={`text-[10px] ${priority === 'SUPER_URGENT' ? 'text-rose-100 font-medium' : 'text-slate-500'}`}>
                Max 1 per designer
              </p>
            </button>
          </div>
        </div>

        {/* 3. Client Specifications (Title, Item, Client Name, Mobile, Contact By) */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Client & Order Details
          </h3>

          {!isGallabox && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mockup Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={mockupTitle}
                  onChange={(e) => setMockupTitle(e.target.value)}
                  placeholder="e.g. Corporate Polo Branding"
                  required={!isGallabox}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Item / Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Black Dry-Fit Polo Shirt"
                  required={!isGallabox}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp / John"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client Mobile Number
              </label>
              <input
                type="text"
                value={clientMobileNumber}
                onChange={(e) => setClientMobileNumber(e.target.value)}
                placeholder="e.g. +971 50 123 4567"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-mono focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
              />
            </div>

            {!isGallabox && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contact By
                </label>
                <input
                  type="text"
                  value={contactBy}
                  onChange={(e) => setContactBy(e.target.value)}
                  placeholder="e.g. WhatsApp / Phone / Email"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* 4. Notes / Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Notes / Design Instructions <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required
            placeholder="Detailed instructions: logo placement, dimensions, pantone colors, mock specs..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none leading-relaxed"
          />
        </div>

        {/* 5. Reference Links */}
        {!isGallabox && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reference Link (Drive / Dropbox)
              </label>
              <input
                type="url"
                value={referenceLinks}
                onChange={(e) => setReferenceLinks(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Additional Reference Link
              </label>
              <input
                type="url"
                value={additionalLinks}
                onChange={(e) => setAdditionalLinks(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* 6. File Attachments */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-2">
            File Attachments (Logos, Vectors, References)
          </label>
          <div className="border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-xl p-4 text-center bg-slate-50 transition-colors">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="page-file-upload"
            />
            <label
              htmlFor="page-file-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <Upload className="w-6 h-6 text-cyan-600 mb-1.5" />
              <span className="text-xs font-semibold text-slate-700">Click to upload files</span>
              <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, PDF, AI, EPS up to 15MB each</span>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-2.5 rounded-lg bg-slate-100 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{att.name}</span>
                    <span className="text-slate-400 text-[10px]">
                      ({(att.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-[#0c192c] text-white font-bold text-xs hover:bg-cyan-800 transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>Submitting Request...</span>
            ) : (
              <>
                <FilePlus2 className="w-4 h-4 text-cyan-400" />
                <span>Submit Mockup Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
