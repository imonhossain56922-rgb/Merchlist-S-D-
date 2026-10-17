import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  MockupRequest,
  RequestPriority,
  RequestSource,
  DesignerCapacity,
  UserProfile,
} from '../types';
import { logAuditEvent } from './auditService';
import { createNotification } from './notificationService';
import { formatDateInTimezone, getTimeOnlyInTimezone } from '../utils/dateUtils';

const COUNTER_DOC_REF = doc(db, 'counters', 'mockupRequests');

export async function getNextRequestId(): Promise<string> {
  try {
    const nextId = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(COUNTER_DOC_REF);
      let count = 1;
      if (counterSnap.exists()) {
        count = (counterSnap.data()?.lastCount || 0) + 1;
      }
      transaction.set(
        COUNTER_DOC_REF,
        {
          lastCount: count,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return `M${String(count).padStart(6, '0')}`;
    });
    return nextId;
  } catch (error) {
    console.warn('Transaction on counter failed, falling back to direct setDoc:', error);
    try {
      const counterSnap = await getDoc(COUNTER_DOC_REF);
      let count = 1;
      if (counterSnap.exists()) {
        count = (counterSnap.data()?.lastCount || 0) + 1;
      }
      await setDoc(COUNTER_DOC_REF, { lastCount: count, updatedAt: new Date().toISOString() }, { merge: true });
      return `M${String(count).padStart(6, '0')}`;
    } catch {
      // Safe fallback to timestamp-based sequential ID
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      return `M${Date.now().toString().slice(-6)}`;
    }
  }
}

export async function getDesignerCapacity(designerId: string, designerName = ''): Promise<DesignerCapacity> {
  try {
    // Query by designerId only to prevent composite index requirement in Firestore
    const q = query(
      collection(db, 'mockupRequests'),
      where('designerId', '==', designerId)
    );
    const snap = await getDocs(q);

    let superUrgentCount = 0;
    let urgentCount = 0;
    let regularCount = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data() as MockupRequest;
      if (data.deleted) return;
      if (data.status !== 'PENDING') return;

      if (data.priority === 'SUPER_URGENT') superUrgentCount++;
      else if (data.priority === 'URGENT') urgentCount++;
      else regularCount++;
    });

    return {
      designerId,
      designerName,
      superUrgentCount,
      superUrgentMax: 1,
      urgentCount,
      urgentMax: 2,
      regularCount,
      canAcceptSuperUrgent: superUrgentCount < 1,
      canAcceptUrgent: urgentCount < 2,
    };
  } catch (error) {
    console.warn('getDesignerCapacity error:', error);
    return {
      designerId,
      designerName,
      superUrgentCount: 0,
      superUrgentMax: 1,
      urgentCount: 0,
      urgentMax: 2,
      regularCount: 0,
      canAcceptSuperUrgent: true,
      canAcceptUrgent: true,
    };
  }
}

export async function createMockupRequest(params: {
  source: RequestSource;
  mockupTitle?: string | null;
  itemName?: string | null;
  clientName?: string | null;
  clientMobileNumber?: string | null;
  contactBy?: string | null;
  notes: string;
  referenceLinks?: string | null;
  additionalLinks?: string | null;
  attachments?: MockupRequest['attachments'];
  salesRepresentativeId: string;
  salesRepresentativeName: string;
  designerId: string;
  designerName: string;
  priority: RequestPriority;
  timezone?: string;
}): Promise<MockupRequest> {
  let targetDesignerId = params.designerId;
  let targetDesignerName = params.designerName;

  // Validate or auto-fallback designer assignment
  if (!targetDesignerId) {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'DESIGNER')));
      const activeDesigners = snap.docs
        .map((d) => d.data() as UserProfile)
        .filter((u) => u.active && !u.deleted);
      if (activeDesigners.length > 0) {
        targetDesignerId = activeDesigners[0].userId;
        targetDesignerName = activeDesigners[0].name;
      }
    } catch (err) {
      console.warn('Fallback designer lookup failed:', err);
    }
  }

  if (!targetDesignerId) {
    throw new Error('No active Designer found in the system. Please ensure an active Designer exists.');
  }

  // Atomically check priority capacity and allocate ID
  try {
    const capacity = await getDesignerCapacity(targetDesignerId, targetDesignerName);

    if (params.priority === 'SUPER_URGENT' && !capacity.canAcceptSuperUrgent) {
      throw new Error(
        'The assigned Designer currently has an active Super Urgent request. Please wait until it is completed before submitting another Super Urgent request.'
      );
    }

    if (params.priority === 'URGENT' && !capacity.canAcceptUrgent) {
      throw new Error(
        'The assigned Designer currently has the maximum number of active Urgent requests. Please wait until an Urgent request is completed or use Regular priority.'
      );
    }

    const requestId = await getNextRequestId();
    const now = new Date();
    const nowIso = now.toISOString();
    const createdDate = formatDateInTimezone(now, params.timezone, false);
    const createdTime = getTimeOnlyInTimezone(now, params.timezone);

    const docRef = doc(db, 'mockupRequests', requestId);

    const requestData: MockupRequest = {
      id: requestId,
      requestId,
      source: params.source,
      mockupTitle: params.source === 'gallabox' ? null : params.mockupTitle || null,
      itemName: params.source === 'gallabox' ? null : params.itemName || null,
      clientName: params.clientName || null,
      clientMobileNumber: params.clientMobileNumber || null,
      contactBy: params.source === 'gallabox' ? null : params.contactBy || null,
      notes: params.notes,
      referenceLinks: params.source === 'gallabox' ? null : params.referenceLinks || null,
      additionalLinks: params.source === 'gallabox' ? null : params.additionalLinks || null,
      attachments: params.attachments || [],
      salesRepresentativeId: params.salesRepresentativeId,
      salesRepresentativeName: params.salesRepresentativeName,
      designerId: targetDesignerId,
      designerName: targetDesignerName,
      status: 'PENDING',
      priority: params.priority,
      createdAt: nowIso,
      createdDate,
      createdTime,
      assignedAt: nowIso,
      assignedDate: createdDate,
      assignedTime: createdTime,
      updatedAt: nowIso,
      deleted: false,
      timeline: [
        {
          action: 'Request Created',
          timestamp: nowIso,
          performedBy: params.salesRepresentativeId,
          performedByName: params.salesRepresentativeName,
          performedByRole: 'SALES_REPRESENTATIVE',
          note: `Source: ${params.source.toUpperCase()} | Priority: ${params.priority}`,
        },
        {
          action: `Assigned to ${targetDesignerName}`,
          timestamp: nowIso,
          performedBy: 'SYSTEM',
          performedByName: 'Auto-Assignment',
        },
      ],
    };

    await setDoc(docRef, requestData);

    // Notify Designer
    await createNotification({
      userId: targetDesignerId,
      title: 'New Mockup Request Assigned',
      message: `${params.salesRepresentativeName} assigned request ${requestId} (${params.priority})`,
      type: 'REQUEST_ASSIGNED',
      requestId,
    });

    // Audit log
    await logAuditEvent({
      action: 'REQUEST_CREATED',
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      targetId: requestId,
      targetType: 'MockupRequest',
      newValue: `Source: ${params.source}, Priority: ${params.priority}, Designer: ${params.designerName}`,
    });

    return requestData;
  } catch (error) {
    if (error instanceof Error && error.message.includes('assigned Designer')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, 'mockupRequests');
    throw error;
  }
}

export async function completeMockupRequest(params: {
  request: MockupRequest;
  designerId: string;
  designerName: string;
  timezone?: string;
}): Promise<void> {
  const req = params.request;
  if (req.status === 'COMPLETED') {
    throw new Error('This request has already been marked as completed.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const completedDate = formatDateInTimezone(now, params.timezone, false);
  const completedTime = getTimeOnlyInTimezone(now, params.timezone);

  // Preserve original completion info if not already saved
  const originalCompletedAt = req.originalCompletedAt || req.completedAt || nowIso;
  const originalCompletedDate = req.originalCompletedDate || req.completedDate || completedDate;
  const originalCompletedTime = req.originalCompletedTime || req.completedTime || completedTime;
  const originalCompletedBy = req.originalCompletedBy || req.completedBy || params.designerId;
  const originalCompletedByName = req.originalCompletedByName || req.completedByName || params.designerName;

  // If this was a revision, mark that revision completed
  let updatedRevisions = req.revisions ? [...req.revisions] : undefined;
  if (updatedRevisions && updatedRevisions.length > 0) {
    const lastIdx = updatedRevisions.length - 1;
    if (!updatedRevisions[lastIdx].completedAt) {
      updatedRevisions[lastIdx] = {
        ...updatedRevisions[lastIdx],
        completedAt: nowIso,
        completedDate,
        completedTime,
        completedBy: params.designerId,
        completedByName: params.designerName,
      };
    }
  }

  const isRevision = req.currentRevision && req.currentRevision > 0;
  const actionLabel = isRevision
    ? `Revision #${req.currentRevision} Completed by Designer`
    : 'Completed by Designer';

  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: actionLabel,
      timestamp: nowIso,
      performedBy: params.designerId,
      performedByName: params.designerName,
      performedByRole: 'DESIGNER',
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      status: 'COMPLETED',
      completedAt: nowIso,
      completedDate,
      completedTime,
      completedBy: params.designerId,
      completedByName: params.designerName,
      originalCompletedAt,
      originalCompletedDate,
      originalCompletedTime,
      originalCompletedBy,
      originalCompletedByName,
      updatedAt: nowIso,
      revisions: updatedRevisions || null,
      timeline: updatedTimeline,
    });

    // Notify Sales Representative
    await createNotification({
      userId: req.salesRepresentativeId,
      title: isRevision
        ? `Revision #${req.currentRevision} Completed for ${req.requestId}`
        : 'Your Mockup Request Has Been Completed',
      message: `Designer ${params.designerName} completed ${
        isRevision ? `Revision #${req.currentRevision}` : 'request'
      } ${req.requestId}`,
      type: 'REQUEST_COMPLETED',
      requestId: req.requestId,
    });

    // Audit log
    await logAuditEvent({
      action: isRevision ? 'REQUEST_REVISION_COMPLETED' : 'REQUEST_COMPLETED',
      performedBy: params.designerId,
      performedByName: params.designerName,
      performedByRole: 'DESIGNER',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: 'PENDING',
      newValue: 'COMPLETED',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mockupRequests/${req.id}`);
  }
}

export async function requestMockupRevision(params: {
  request: MockupRequest;
  salesRepresentativeId: string;
  salesRepresentativeName: string;
  changesDetails: string;
  timezone?: string;
}): Promise<void> {
  const req = params.request;
  if (!params.changesDetails || !params.changesDetails.trim()) {
    throw new Error('Please enter Changes Details.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const requestedDate = formatDateInTimezone(now, params.timezone, false);
  const requestedTime = getTimeOnlyInTimezone(now, params.timezone);

  // Preserve original completion info if not already saved
  const originalCompletedAt = req.originalCompletedAt || req.completedAt || nowIso;
  const originalCompletedDate = req.originalCompletedDate || req.completedDate || requestedDate;
  const originalCompletedTime = req.originalCompletedTime || req.completedTime || requestedTime;
  const originalCompletedBy = req.originalCompletedBy || req.completedBy || null;
  const originalCompletedByName = req.originalCompletedByName || req.completedByName || null;

  const nextRevNumber = (req.revisions?.length || 0) + 1;

  const newRevision: import('../types').RequestRevision = {
    revisionNumber: nextRevNumber,
    changesDetails: params.changesDetails.trim(),
    requestedAt: nowIso,
    requestedDate,
    requestedTime,
    requestedBy: params.salesRepresentativeId,
    requestedByName: params.salesRepresentativeName,
    completedAt: null,
    completedDate: null,
    completedTime: null,
    completedBy: null,
    completedByName: null,
  };

  const updatedRevisions = [...(req.revisions || []), newRevision];

  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: `Revision #${nextRevNumber} Requested`,
      timestamp: nowIso,
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      note: params.changesDetails.trim(),
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      status: 'PENDING',
      currentRevision: nextRevNumber,
      latestChangesDetails: params.changesDetails.trim(),
      completedAt: null,
      completedDate: null,
      completedTime: null,
      completedBy: null,
      completedByName: null,
      originalCompletedAt,
      originalCompletedDate,
      originalCompletedTime,
      originalCompletedBy,
      originalCompletedByName,
      revisions: updatedRevisions,
      timeline: updatedTimeline,
      updatedAt: nowIso,
    });

    // Notify Designer
    await createNotification({
      userId: req.designerId,
      title: `Revision Request for ${req.requestId}`,
      message: `${params.salesRepresentativeName} submitted Revision #${nextRevNumber} for ${req.requestId}. Changes Details: ${params.changesDetails.trim()}`,
      type: 'REQUEST_RESUBMITTED',
      requestId: req.requestId,
    });

    // Audit log
    await logAuditEvent({
      action: 'REQUEST_REVISION_SUBMITTED',
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: `COMPLETED (Rev ${nextRevNumber - 1})`,
      newValue: `PENDING (Rev ${nextRevNumber}): ${params.changesDetails.trim()}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mockupRequests/${req.id}`);
  }
}

export async function rejectMockupRequest(params: {
  request: MockupRequest;
  designerId: string;
  designerName: string;
  rejectionReason: string;
}): Promise<void> {
  const req = params.request;
  if (!params.rejectionReason || !params.rejectionReason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: 'Rejected by Designer',
      timestamp: nowIso,
      performedBy: params.designerId,
      performedByName: params.designerName,
      performedByRole: 'DESIGNER',
      note: params.rejectionReason.trim(),
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      status: 'REJECTED',
      rejectedAt: nowIso,
      rejectedBy: params.designerId,
      rejectedByName: params.designerName,
      rejectionReason: params.rejectionReason.trim(),
      updatedAt: nowIso,
      timeline: updatedTimeline,
    });

    // Notify Sales Rep with reason
    await createNotification({
      userId: req.salesRepresentativeId,
      title: 'Your Mockup Request Was Rejected',
      message: `Request ${req.requestId} was rejected by ${params.designerName}. Reason: ${params.rejectionReason.trim()}`,
      type: 'REQUEST_REJECTED',
      requestId: req.requestId,
    });

    // Audit log
    await logAuditEvent({
      action: 'REQUEST_REJECTED',
      performedBy: params.designerId,
      performedByName: params.designerName,
      performedByRole: 'DESIGNER',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: 'PENDING',
      newValue: `REJECTED: ${params.rejectionReason.trim()}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mockupRequests/${req.id}`);
  }
}

export async function resubmitMockupRequest(params: {
  request: MockupRequest;
  salesRepresentativeId: string;
  salesRepresentativeName: string;
  updatedFields: Partial<MockupRequest>;
}): Promise<void> {
  const req = params.request;

  // Capacity check if priority is high
  const priorityToCheck = params.updatedFields.priority || req.priority;
  if (priorityToCheck === 'SUPER_URGENT' || priorityToCheck === 'URGENT') {
    const capacity = await getDesignerCapacity(req.designerId, req.designerName);
    if (priorityToCheck === 'SUPER_URGENT' && !capacity.canAcceptSuperUrgent) {
      throw new Error(
        'Your assigned Designer currently has an active Super Urgent request. Please wait until it is completed before submitting another Super Urgent request.'
      );
    }
    if (priorityToCheck === 'URGENT' && !capacity.canAcceptUrgent) {
      throw new Error(
        'Your assigned Designer currently has the maximum number of active Urgent requests. Please wait until an Urgent request is completed or use Regular priority.'
      );
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: 'Request Resubmitted',
      timestamp: nowIso,
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      note: 'Corrections provided following rejection review',
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      ...params.updatedFields,
      status: 'PENDING',
      updatedAt: nowIso,
      timeline: updatedTimeline,
    });

    // Notify Designer
    await createNotification({
      userId: req.designerId,
      title: 'Mockup Request Resubmitted',
      message: `${params.salesRepresentativeName} updated and resubmitted request ${req.requestId}`,
      type: 'REQUEST_RESUBMITTED',
      requestId: req.requestId,
    });

    // Audit log
    await logAuditEvent({
      action: 'REQUEST_RESUBMITTED',
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: 'REJECTED',
      newValue: 'PENDING',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mockupRequests/${req.id}`);
  }
}

export async function reopenMockupRequest(params: {
  request: MockupRequest;
  adminId: string;
  adminName: string;
}): Promise<void> {
  const req = params.request;
  const nowIso = new Date().toISOString();

  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: 'Reopened by Admin',
      timestamp: nowIso,
      performedBy: params.adminId,
      performedByName: params.adminName,
      performedByRole: 'ADMIN',
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      status: 'PENDING',
      completedAt: null,
      completedDate: null,
      completedTime: null,
      completedBy: null,
      completedByName: null,
      updatedAt: nowIso,
      timeline: updatedTimeline,
    });

    await logAuditEvent({
      action: 'REQUEST_REOPENED',
      performedBy: params.adminId,
      performedByName: params.adminName,
      performedByRole: 'ADMIN',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: 'COMPLETED',
      newValue: 'PENDING',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mockupRequests/${req.id}`);
  }
}

export async function softDeleteMockupRequest(params: {
  requestId: string;
  adminId: string;
  adminName: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'mockupRequests', params.requestId), {
      deleted: true,
      deletedAt: nowIso,
      deletedBy: params.adminId,
      updatedAt: nowIso,
    });

    await logAuditEvent({
      action: 'REQUEST_SOFT_DELETED',
      performedBy: params.adminId,
      performedByName: params.adminName,
      performedByRole: 'ADMIN',
      targetId: params.requestId,
      targetType: 'MockupRequest',
      newValue: 'DELETED',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `mockupRequests/${params.requestId}`);
  }
}

export function sortDesignerQueue(requests: MockupRequest[]): MockupRequest[] {
  const priorityRank: Record<RequestPriority, number> = {
    SUPER_URGENT: 1,
    URGENT: 2,
    REGULAR: 3,
  };

  return [...requests].sort((a, b) => {
    // 1. Priority rank (SUPER_URGENT = 1, URGENT = 2, REGULAR = 3)
    const rankDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (rankDiff !== 0) return rankDiff;

    // 2. Oldest waiting first (earliest createdAt first)
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  });
}
