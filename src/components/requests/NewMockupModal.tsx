import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, RequestSource, RequestPriority, DesignerCapacity } from '../../types';
import {
  createMockupRequest,
  getDesignerCapacity,
  getActiveDesignerForSalesUser,
  getDesignerPriorityWarning,
} from '../../services/requestService';
import {
  X,
  Upload,
  AlertCircle,
  Zap,
  Clock,
  Palette,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
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

// Requirement 5: Request Source dropdown must show exactly:
// 1. Gallabox
// 2. WhatsApp
// 3. E-mail
// 4. Others
const REQUEST_SOURCE_OPTIONS: Array<{ id: RequestSource; label: string }> = [
  { id: 'gallabox', label: 'Gallabox' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-mail' },
  { id: 'others', label: 'Others' },
];

export const NewMockupModal: React.FC<NewMockupModalProps> = ({
  currentUser,
  allUsers = [],
  timezone,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const activeAssignment = useMemo(() => {
    return getActiveDesignerForSalesUser(currentUser);
  }, [currentUser]);

  // Requirement 5: default starts at Gallabox
  const [source, setSource] = useState<RequestSource>('gallabox');
  const [priority, setPriority] = useState<RequestPriority>('REGULAR');
  const [priorityWarning, setPriorityWarning] = useState<string | null>(null);

  // Form input states (Mockup Title removed per Requirement 4)
  const [items, setItems] = useState<string[]>(['']);
  const [clientName, setClientName] = useState('');
  const [clientMobileNumber, setClientMobileNumber] = useState('');
  const [contactBy, setContactBy] = useState('Gallabox');
  const [notes, setNotes] = useState('');
  const [refLinks, setRefLinks] = useState<string[]>(['']);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; url: string; size: number; type: string; uploadedAt: string }>
  >([]);

  const [availableDesigners, setAvailableDesigners] = useState<UserProfile[]>([]);
  const [capacity, setCapacity] = useState<DesignerCapacity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch active designers if not available from props
  useEffect(() => {
    const fromProps = allUsers.filter((u) => u.role === 'DESIGNER' && u.active && !u.deleted);
    if (fromProps.length > 0) {
      setAvailableDesigners(fromProps);
    } else if (isOpen) {
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

  // Requirement 1: Each Sales User must only be able to create/request mockups from Designer(s) assigned/authorized
  const authorizedDesigners = useMemo(() => {
    if (currentUser.role === 'SALES_REPRESENTATIVE') {
      const activeId = activeAssignment.designerId || currentUser.assignedDesignerId;
      if (activeId) {
        const found = availableDesigners.find((d) => d.userId === activeId);
        if (found) return [found];
        return [
          {
            userId: activeId,
            name: activeAssignment.designerName || currentUser.assignedDesignerName || 'Assigned Designer',
            role: 'DESIGNER' as const,
            active: true,
            loginId: '',
            createdAt: '',
            updatedAt: '',
          },
        ];
      }
      return [];
    }
    return availableDesigners;
  }, [currentUser.role, activeAssignment, currentUser.assignedDesignerId, currentUser.assignedDesignerName, availableDesigners]);

  const [selectedDesignerId, setSelectedDesignerId] = useState<string>(() => {
    return activeAssignment.designerId || currentUser.assignedDesignerId || '';
  });

  // Automatically select active assigned designer
  useEffect(() => {
    const targetId = activeAssignment.designerId || currentUser.assignedDesignerId;
    if (currentUser.role === 'SALES_REPRESENTATIVE') {
      if (targetId) setSelectedDesignerId(targetId);
    } else if (!selectedDesignerId && availableDesigners.length > 0) {
      const match = availableDesigners.find((d) => d.userId === targetId);
      setSelectedDesignerId(match ? match.userId : availableDesigners[0].userId);
    }
  }, [availableDesigners, currentUser.assignedDesignerId, currentUser.role, selectedDesignerId, activeAssignment]);

  const selectedDesigner = useMemo(() => {
    return (
      authorizedDesigners.find((d) => d.userId === selectedDesignerId) ||
      availableDesigners.find((d) => d.userId === selectedDesignerId) ||
      allUsers.find((u) => u.userId === selectedDesignerId)
    );
  }, [authorizedDesigners, availableDesigners, allUsers, selectedDesignerId]);

  // Load Designer capacity
  useEffect(() => {
    const designerId = selectedDesignerId || activeAssignment.designerId || currentUser.assignedDesignerId;
    if (designerId) {
      getDesignerCapacity(
        designerId,
        selectedDesigner?.name || activeAssignment.designerName || currentUser.assignedDesignerName
      ).then((cap) => {
        setCapacity(cap);
      });
    }
  }, [selectedDesignerId, currentUser.assignedDesignerId, activeAssignment, selectedDesigner?.name, isOpen]);

  // Check priority warning for urgent requests
  useEffect(() => {
    const designerId = selectedDesignerId || activeAssignment.designerId;
    if (designerId && (priority === 'URGENT' || priority === 'SUPER_URGENT')) {
      getDesignerPriorityWarning(designerId, priority).then((warn) => {
        if (warn.hasWarning && warn.warningMessage) {
          setPriorityWarning(warn.warningMessage);
        } else {
          setPriorityWarning(null);
        }
      });
    } else {
      setPriorityWarning(null);
    }
  }, [selectedDesignerId, activeAssignment.designerId, priority, isOpen]);

  if (!isOpen) return null;

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

    const designerIdToUse =
      selectedDesignerId || activeAssignment.designerId || currentUser.assignedDesignerId || authorizedDesigners[0]?.userId;
    const designerNameToUse =
      selectedDesigner?.name ||
      activeAssignment.designerName ||
      currentUser.assignedDesignerName ||
      authorizedDesigners[0]?.name ||
      'Assigned Designer';

    if (!designerIdToUse) {
      setErrorMessage('Please select an authorized Designer for this mockup request.');
      return;
    }

    const validItems = items.map((i) => i.trim()).filter(Boolean);
    const validLinks = refLinks.map((l) => l.trim()).filter(Boolean);

    // Requirement 9: Item / Product Name required only when source is WhatsApp, E-mail, or Others
    if (!isGallabox && validItems.length === 0) {
      setErrorMessage('Please provide at least one Item / Product Name.');
      return;
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
      const finalItem = validItems.length > 0 ? validItems.join(', ') : (isGallabox ? null : 'Custom Merchandise');
      await createMockupRequest({
        source,
        priority,
        mockupTitle: null, // Requirement 4: Mockup Title removed
        itemName: finalItem,
        itemNames: validItems.length > 0 ? validItems : (finalItem ? [finalItem] : []),
        clientName: clientName.trim() || null,
        clientMobileNumber: clientMobileNumber.trim() || null,
        contactBy: isGallabox ? null : contactBy.trim() || null,
        notes: notes.trim(), // Requirement 10: Optional notes
        referenceLinks: isGallabox ? null : validLinks[0] || null,
        additionalLinks: isGallabox ? null : validLinks[1] || null,
        additionalReferenceLinks: isGallabox ? [] : validLinks,
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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

          {/* Designer Selection (Requirement 1: Authorized only; Requirement 2: NO Login IDs shown) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-700" />
                <span>Assigned Designer</span>
                <span className="text-rose-500">*</span>
              </label>
              {activeAssignment.isTemporary && (
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded">
                  Temporary Coverage Active
                </span>
              )}
            </div>
            <select
              value={selectedDesignerId}
              onChange={(e) => setSelectedDesignerId(e.target.value)}
              required
              disabled={currentUser.role === 'SALES_REPRESENTATIVE' && authorizedDesigners.length <= 1}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold focus:ring-2 focus:ring-[#0c192c] focus:outline-none disabled:bg-slate-100 disabled:text-slate-800"
            >
              {authorizedDesigners.length === 0 && <option value="">-- No Authorized Designer Assigned --</option>}
              {authorizedDesigners.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.name}
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

          {/* Requirement 5: Request Source (Gallabox, WhatsApp, E-mail, Others) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Request Source <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {REQUEST_SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSource(opt.id)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                    source === opt.id
                      ? 'bg-[#0c192c] text-white border-[#0c192c] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
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
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

            {/* Turnaround Advisory Notice */}
            {priorityWarning && (
              <div className="mt-2.5 p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Notice: </span>
                  <span>{priorityWarning}</span>
                </div>
              </div>
            )}
          </div>

          {/* Temporary Coverage Alert Banner */}
          {activeAssignment.isTemporary && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider text-[11px] text-amber-900 block">Temporary Coverage Active</span>
                <span className="text-amber-800">
                  Routing to <strong>{activeAssignment.designerName}</strong> until <strong>{activeAssignment.endDate}</strong> (covering for <strong>{activeAssignment.originalDesignerName}</strong>).
                </span>
              </div>
            </div>
          )}

          {/* Form Fields: DYNAMIC BASED ON SOURCE */}
          {isGallabox ? (
            /* GALLABOX SOURCE ONLY: Client Name, Client Mobile Number, Optional Notes */
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
                    placeholder="Client or Company Name"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
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
                    placeholder="+971 50 123 4567"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Notes / Design Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Design instructions, dimensions, color codes, placement details..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          ) : (
            /* WHATSAPP / E-MAIL / OTHERS: Multiple Item / Product Names, Client Info, Optional Notes, Multiple Additional Reference Links */
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Requirement 9: Multiple Item / Product Name entries with + Add Item/Product */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Item / Product Name <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Item/Product</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-bold text-slate-400 font-mono">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = e.target.value;
                          setItems(next);
                        }}
                        placeholder={`Product ${idx + 1} name`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
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
                    placeholder="Client or Company Name"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
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
                    placeholder="+971 50 123 4567"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
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
                    placeholder="WhatsApp, E-mail, Phone..."
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Requirement 10: Notes / Design Instructions (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Notes / Design Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Design details, pantone colors, placements..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Requirement 3: Additional Reference Link (Figma / Canva / WeTransfer) with + Add New Link */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Additional Reference Link (Figma / Canva / WeTransfer)
                  </label>
                  <button
                    type="button"
                    onClick={() => setRefLinks((prev) => [...prev, ''])}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add New Link</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {refLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => {
                          const next = [...refLinks];
                          next[idx] = e.target.value;
                          setRefLinks(next);
                        }}
                        placeholder="https://..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-[#0c192c] focus:outline-none placeholder:text-slate-400"
                      />
                      {refLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRefLinks((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Attachments Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Attachments (Images / Reference files)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative">
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
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
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
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating Request...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
