import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, RequestSource, RequestPriority, DesignerCapacity } from '../../types';
import {
  createMockupRequest,
  getDesignerCapacity,
  getActiveDesignerForSalesUser,
  getDesignerPriorityWarning,
} from '../../services/requestService';
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
  ArrowLeft,
  Loader2,
  Plus,
  Calendar,
  AlertTriangle,
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
  // Active designer considering temporary assignment
  const activeAssignment = useMemo(() => {
    return getActiveDesignerForSalesUser(currentUser);
  }, [currentUser]);

  // Form input state variables (Requirement 4: Mockup Title removed)
  const [items, setItems] = useState<string[]>(['']);
  const [clientName, setClientName] = useState('');
  const [clientMobileNumber, setClientMobileNumber] = useState('');
  const [contactBy, setContactBy] = useState('Gallabox');
  const [notes, setNotes] = useState('');
  const [refLinks, setRefLinks] = useState<string[]>(['']);
  const [source, setSource] = useState<RequestSource>('gallabox');
  const [priority, setPriority] = useState<RequestPriority>('REGULAR');
  const [priorityWarning, setPriorityWarning] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; url: string; size: number; type: string; uploadedAt: string }>
  >([]);

  // Designer loading state
  const [availableDesigners, setAvailableDesigners] = useState<UserProfile[]>([]);
  const [selectedDesignerId, setSelectedDesignerId] = useState<string>(() => {
    return activeAssignment.designerId || currentUser.assignedDesignerId || '';
  });
  const [capacity, setCapacity] = useState<DesignerCapacity | null>(null);

  // Submission feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Load active designers reliably (from props or direct Firestore query)
  useEffect(() => {
    let isMounted = true;
    const fromProps = allUsers.filter((u) => u.role === 'DESIGNER' && u.active && !u.deleted);
    if (fromProps.length > 0) {
      setAvailableDesigners(fromProps);
    } else {
      getDocs(query(collection(db, 'users'), where('role', '==', 'DESIGNER')))
        .then((snap) => {
          if (!isMounted) return;
          const list = snap.docs
            .map((d) => d.data() as UserProfile)
            .filter((u) => u.active && !u.deleted);
          setAvailableDesigners(list);
        })
        .catch((err) => console.warn('Designer fetch warning:', err));
    }
    return () => {
      isMounted = false;
    };
  }, [allUsers]);

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

  // 2. Default to active assigned designer once loaded
  useEffect(() => {
    const targetId = activeAssignment.designerId || currentUser.assignedDesignerId;
    if (currentUser.role === 'SALES_REPRESENTATIVE') {
      if (targetId) setSelectedDesignerId(targetId);
    } else if (!selectedDesignerId && availableDesigners.length > 0) {
      const match = availableDesigners.find((d) => d.userId === targetId);
      setSelectedDesignerId(match ? match.userId : availableDesigners[0].userId);
    }
  }, [availableDesigners, currentUser.assignedDesignerId, currentUser.role, selectedDesignerId, activeAssignment]);

  // Find currently selected designer profile
  const selectedDesigner = useMemo(() => {
    return (
      authorizedDesigners.find((d) => d.userId === selectedDesignerId) ||
      availableDesigners.find((d) => d.userId === selectedDesignerId) ||
      allUsers.find((u) => u.userId === selectedDesignerId) ||
      null
    );
  }, [authorizedDesigners, availableDesigners, allUsers, selectedDesignerId]);

  // 3. Load designer workload capacity
  useEffect(() => {
    const designerId = selectedDesignerId || activeAssignment.designerId || currentUser.assignedDesignerId;
    if (designerId) {
      getDesignerCapacity(designerId, selectedDesigner?.name || activeAssignment.designerName || currentUser.assignedDesignerName || '')
        .then((cap) => {
          setCapacity(cap);
        })
        .catch(() => {});
    }
  }, [selectedDesignerId, activeAssignment, currentUser.assignedDesignerName, selectedDesigner?.name]);

  // 4. Check priority warning for urgent requests
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
  }, [selectedDesignerId, activeAssignment.designerId, priority]);

  // Handle file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage('Each attachment file must be under 15MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

    if (e.target) {
      e.target.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const isGallabox = source === 'gallabox';
    const validItems = items.map((i) => i.trim()).filter(Boolean);
    const validLinks = refLinks.map((l) => l.trim()).filter(Boolean);

    // Validation (Requirement 9: Item / Product Name required only for WhatsApp / E-mail / Others)
    if (!isGallabox && validItems.length === 0) {
      setErrorMessage('Please enter at least one Item / Product Name.');
      return;
    }

    const designerIdToUse = selectedDesignerId || activeAssignment.designerId || currentUser.assignedDesignerId || authorizedDesigners[0]?.userId;
    const designerNameToUse =
      selectedDesigner?.name || activeAssignment.designerName || currentUser.assignedDesignerName || authorizedDesigners[0]?.name || 'Assigned Designer';

    if (!designerIdToUse) {
      setErrorMessage('No designer found or authorized. Please ensure an active designer exists.');
      return;
    }

    // Capacity checks
    if (priority === 'SUPER_URGENT' && capacity && !capacity.canAcceptSuperUrgent) {
      setErrorMessage(
        'The assigned Designer currently has an active Super Urgent request. Please wait until completed or choose Urgent / Regular.'
      );
      return;
    }

    if (priority === 'URGENT' && capacity && !capacity.canAcceptUrgent) {
      setErrorMessage(
        'The assigned Designer currently has the maximum (2) active Urgent requests. Please select Regular priority or wait until completed.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const finalItem = validItems.length > 0
        ? validItems.join(', ')
        : (isGallabox ? null : 'Custom Merchandise');

      await createMockupRequest({
        source,
        priority,
        mockupTitle: null, // Requirement 4: Mockup Title removed
        itemName: finalItem,
        itemNames: validItems.length > 0 ? validItems : (finalItem ? [finalItem] : []),
        clientName: clientName.trim() || null,
        clientMobileNumber: clientMobileNumber.trim() || null,
        contactBy: contactBy.trim() || null,
        notes: notes.trim(), // Requirement 10: Optional
        referenceLinks: validLinks[0] || null,
        additionalLinks: validLinks[1] || null,
        additionalReferenceLinks: validLinks, // Requirement 3: Multi-links
        attachments,
        salesRepresentativeId: currentUser.userId,
        salesRepresentativeName: currentUser.name,
        designerId: designerIdToUse,
        designerName: designerNameToUse,
        timezone,
      });

      setSuccessMessage('Mockup Request created successfully! Redirecting...');
      setTimeout(() => {
        onComplete();
      }, 700);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create mockup request.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <span className="p-2.5 rounded-xl bg-cyan-50 text-cyan-800">
            <FilePlus2 className="w-6 h-6 text-cyan-700" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0c192c] tracking-tight">
              New Mockup Request
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in the client brief and specifications for the design team.
            </p>
          </div>
        </div>

        {/* Sales Rep Identity Badge */}
        <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 self-start sm:self-auto text-xs">
          <User className="w-4 h-4 text-cyan-700 flex-shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
              Sales Representative
            </span>
            <span className="font-bold text-slate-900 block truncate max-w-[180px]">
              {currentUser.name}
            </span>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Required Information Missing</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Success notification */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-800 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Success!</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Temporary Coverage Banner if active */}
        {activeAssignment.isTemporary && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-2xs">
            <Calendar className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                Temporary Designer Coverage Active
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Your requests are temporarily being routed to <strong>{activeAssignment.designerName}</strong> until <strong>{activeAssignment.endDate}</strong> (covering for your primary designer, <strong>{activeAssignment.originalDesignerName}</strong>).
              </p>
            </div>
          </div>
        )}

        {/* ================= SECTION 1: ORDER SPECIFICATIONS ================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Tag className="w-4 h-4 text-cyan-700" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              1. Order Specifications
            </h2>
          </div>

          <div className="space-y-5">
            {/* Requirement 5: Request Source Selector with EXACT order: 1. Gallabox, 2. WhatsApp, 3. E-mail, 4. Others */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Request Source <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'gallabox', label: '1. Gallabox', color: 'hover:border-cyan-500 text-cyan-700' },
                  { id: 'whatsapp', label: '2. WhatsApp', color: 'hover:border-emerald-500 text-emerald-700' },
                  { id: 'email', label: '3. E-mail', color: 'hover:border-blue-500 text-blue-700' },
                  { id: 'others', label: '4. Others', color: 'hover:border-purple-500 text-purple-700' },
                ].map((s) => {
                  const isSelected = source === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSource(s.id as RequestSource);
                        if (s.id === 'gallabox') setContactBy('Gallabox');
                        else if (s.id === 'whatsapp') setContactBy('WhatsApp');
                        else if (s.id === 'email') setContactBy('Email');
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#0c192c] text-white border-[#0c192c] shadow-xs'
                          : `bg-slate-50 text-slate-700 border-slate-200 ${s.color}`
                      }`}
                    >
                      <span>{s.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Requirement 9: Item / Product Name must ONLY be displayed when Request Source is WhatsApp, E-mail, Others. DO NOT display for Gallabox. */}
            {source !== 'gallabox' && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
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

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-7 text-center text-xs font-bold text-slate-400 font-mono">
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
                        placeholder={`Item / Product Name ${idx + 1}`}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-[#0c192c] focus:outline-none transition-all placeholder:text-slate-400 bg-white"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Specify each product or merchandise article included in this mockup order.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ================= SECTION 2: CLIENT & CONTACT ================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-4 h-4 text-cyan-700" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              2. Client & Contact Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Client Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Client Name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client or company name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-[#0c192c] focus:outline-none transition-all placeholder:text-slate-400 bg-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Company name or contact person.
              </span>
            </div>

            {/* Client Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Client Mobile Number
              </label>
              <input
                type="text"
                value={clientMobileNumber}
                onChange={(e) => setClientMobileNumber(e.target.value)}
                placeholder="Mobile phone number with country code"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-mono focus:ring-2 focus:ring-[#0c192c] focus:outline-none transition-all placeholder:text-slate-400 bg-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Phone with country code for designer reference.
              </span>
            </div>

            {/* Contact Method */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Preferred Contact Method
              </label>
              <input
                type="text"
                value={contactBy}
                onChange={(e) => setContactBy(e.target.value)}
                placeholder="WhatsApp, Phone, or Email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-[#0c192c] focus:outline-none transition-all placeholder:text-slate-400 bg-white"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                How client was contacted.
              </span>
            </div>
          </div>
        </div>

        {/* ================= SECTION 3: PRIORITY & DESIGNER ASSIGNMENT ================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Palette className="w-4 h-4 text-cyan-700" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              3. Priority & Designer Assignment
            </h2>
          </div>

          {/* Priority Selection Cards */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              {capacity && (
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <span className="text-slate-500">Active Queue:</span>
                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Super Urgent: {capacity.superUrgentCount}/{capacity.superUrgentMax}
                  </span>
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
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
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  priority === 'REGULAR'
                    ? 'bg-[#0c192c] text-white border-[#0c192c] shadow-xs ring-2 ring-[#0c192c]/20'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Regular Priority</span>
                  <Clock className={`w-4 h-4 ${priority === 'REGULAR' ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <p className={`text-[11px] ${priority === 'REGULAR' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Standard production queue workflow.
                </p>
              </button>

              {/* Urgent */}
              <button
                type="button"
                onClick={() => setPriority('URGENT')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  priority === 'URGENT'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Urgent (Max 2)</span>
                  <Zap className={`w-4 h-4 ${priority === 'URGENT' ? 'text-slate-950' : 'text-amber-600'}`} />
                </div>
                <p className={`text-[11px] ${priority === 'URGENT' ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                  Fast-track queue for confirmed priority orders.
                </p>
              </button>

              {/* Super Urgent */}
              <button
                type="button"
                onClick={() => setPriority('SUPER_URGENT')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  priority === 'SUPER_URGENT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-400/40'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Super Urgent (Max 1)</span>
                  <ShieldAlert className={`w-4 h-4 ${priority === 'SUPER_URGENT' ? 'text-white' : 'text-rose-600'}`} />
                </div>
                <p className={`text-[11px] ${priority === 'SUPER_URGENT' ? 'text-rose-100 font-medium' : 'text-slate-500'}`}>
                  Immediate top-of-queue priority execution.
                </p>
              </button>
            </div>

            {/* Inline Turnaround Advisory / Priority Warning */}
            {priorityWarning && (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block text-amber-950">Turnaround Advisory</span>
                  <span className="mt-0.5 block">{priorityWarning}</span>
                </div>
              </div>
            )}
          </div>

          {/* Designer Selector (Requirement 1: Sales User only sees authorized Designer. Requirement 2: No Login ID displayed) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-cyan-700" />
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-[#0c192c] focus:outline-none disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed"
            >
              {authorizedDesigners.length === 0 && <option value="">-- No Authorized Designer Assigned --</option>}
              {authorizedDesigners.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              The mockup request will be added directly to this designer's priority queue and they will receive an in-app notification.
            </p>
          </div>
        </div>

        {/* ================= SECTION 4: INSTRUCTIONS & LINKS ================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileText className="w-4 h-4 text-cyan-700" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              4. Design Instructions & Reference Links
            </h2>
          </div>

          {/* Notes / Instructions (Optional - Requirement 10) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Notes / Design Instructions <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Design instructions, dimensions, color codes, placement details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-[#0c192c] focus:outline-none transition-all placeholder:text-slate-400 leading-relaxed font-sans bg-white"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Designers can copy these instructions with a single click.
            </span>
          </div>

          {/* Requirement 3: Additional Reference Link (Figma / Canva / WeTransfer) with + Add New Link */}
          <div className="space-y-2.5">
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

            <div className="space-y-2">
              {refLinks.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-7 text-center text-xs font-bold text-slate-400 font-mono">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => {
                      const next = [...refLinks];
                      next[idx] = e.target.value;
                      setRefLinks(next);
                    }}
                    placeholder="https://www.figma.com/... or https://we.tl/..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-[#0c192c] focus:outline-none transition-all placeholder:text-slate-400 bg-white"
                  />
                  {refLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRefLinks((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Remove link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-slate-400 block">
              Paste URLs for artwork, vector files, moodboards, or mockups.
            </span>
          </div>
        </div>

        {/* ================= SECTION 5: ATTACHMENTS ================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Upload className="w-4 h-4 text-cyan-700" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              5. File Attachments (Logos, Vectors, Sample Photos)
            </h2>
          </div>

          <div className="border-2 border-dashed border-slate-300 hover:border-cyan-600 rounded-2xl p-6 text-center bg-slate-50/60 transition-colors">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="view-file-upload-input"
            />
            <label
              htmlFor="view-file-upload-input"
              className="flex flex-col items-center justify-center cursor-pointer select-none"
            >
              <div className="p-3 bg-cyan-100/70 rounded-full text-cyan-800 mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-slate-800">
                Click here or drag files to upload
              </span>
              <span className="text-xs text-slate-400 mt-1">
                Supports PNG, JPG, PDF, AI, EPS up to 15MB each
              </span>
            </label>
          </div>

          {/* List of attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-700 block">
                Attached Files ({attachments.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{att.name}</span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        ({(att.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100/70 transition-colors cursor-pointer flex-shrink-0"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl bg-[#0c192c] hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2.5 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Submitting Mockup Request...</span>
              </>
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
