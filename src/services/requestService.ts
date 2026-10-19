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
  RequestAttachment,
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

/**
 * Returns the currently active designer for a Sales Representative,
 * taking into account active temporary assignments and automatic expiry.
 */
export function getActiveDesignerForSalesUser(
  user: UserProfile,
  now = new Date()
): {
  designerId: string;
  designerName: string;
  isTemporary: boolean;
  temporaryAssignment?: UserProfile['temporaryDesigner'];
  startDate?: string;
  endDate?: string;
  originalDesignerName?: string;
  previousDesignerName?: string;
} {
  if (user.role !== 'SALES_REPRESENTATIVE') {
    return {
      designerId: user.assignedDesignerId || '',
      designerName: user.assignedDesignerName || '',
      isTemporary: false,
    };
  }

  const temp = user.temporaryDesigner;
  if (temp && temp.designerId && temp.startDate && temp.endDate) {
    const todayStr = now.toISOString().slice(0, 10);
    // Check if within the temporary window
    if (todayStr >= temp.startDate && todayStr <= temp.endDate) {
      return {
        designerId: temp.designerId,
        designerName: temp.designerName,
        isTemporary: true,
        temporaryAssignment: temp,
        startDate: temp.startDate,
        endDate: temp.endDate,
        originalDesignerName: temp.previousDesignerName,
        previousDesignerName: temp.previousDesignerName,
      };
    }
    // Expired temporary assignment - automatically reverts to original/permanent designer!
  }

  return {
    designerId: user.assignedDesignerId || '',
    designerName: user.assignedDesignerName || '',
    isTemporary: false,
  };
}

/**
 * Checks queue of selected designer for priority warning popup (Requirement 19).
 */
export async function getDesignerPriorityWarning(
  designerId: string,
  _priority?: RequestPriority | string
): Promise<{
  showWarning: boolean;
  hasWarning: boolean;
  superUrgentCount: number;
  urgentCount: number;
  message: string;
  warningMessage: string;
}> {
  try {
    const q = query(collection(db, 'mockupRequests'), where('designerId', '==', designerId));
    const snap = await getDocs(q);

    let superUrgentCount = 0;
    let urgentCount = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data() as MockupRequest;
      if (data.deleted) return;
      if (data.status !== 'PENDING') return;

      if (data.priority === 'SUPER_URGENT') superUrgentCount++;
      else if (data.priority === 'URGENT') urgentCount++;
    });

    if (superUrgentCount === 0 && urgentCount === 0) {
      return {
        showWarning: false,
        hasWarning: false,
        superUrgentCount: 0,
        urgentCount: 0,
        message: '',
        warningMessage: '',
      };
    }

    let detailText = '';
    if (superUrgentCount > 0 && urgentCount > 0) {
      const suLabel = `${superUrgentCount} Super Urgent request${superUrgentCount > 1 ? 's' : ''}`;
      const uLabel = `${urgentCount} Urgent request${urgentCount > 1 ? 's' : ''}`;
      detailText = `${suLabel} and ${uLabel}`;
    } else if (superUrgentCount > 0) {
      detailText = `${superUrgentCount} Super Urgent request${superUrgentCount > 1 ? 's' : ''}`;
    } else {
      detailText = `${urgentCount} Urgent request${urgentCount > 1 ? 's' : ''}`;
    }

    const message = `Your mockup may take a little longer to complete because the selected designer currently has ${detailText} in the queue. These priority requests will be completed first in sequence before the designer proceeds with the remaining requests. Thank you for your understanding.`;

    return {
      showWarning: true,
      hasWarning: true,
      superUrgentCount,
      urgentCount,
      message,
      warningMessage: message,
    };
  } catch (err) {
    console.warn('Failed to calculate priority warning:', err);
    return {
      showWarning: false,
      hasWarning: false,
      superUrgentCount: 0,
      urgentCount: 0,
      message: '',
      warningMessage: '',
    };
  }
}

/**
 * Automatically transfers ALL pending/incomplete mockup requests belonging to a sales user
 * to the new designer (Requirement 8). Preserves historical IDs, audit trail, and completed requests.
 */
export async function transferPendingRequestsForSalesUser(params: {
  salesUserId: string;
  salesUserName: string;
  newDesignerId: string;
  newDesignerName: string;
  actorId: string;
  actorName: string;
  reason: string;
}): Promise<number> {
  const { salesUserId, newDesignerId, newDesignerName, actorName, reason } = params;
  try {
    const q = query(
      collection(db, 'mockupRequests'),
      where('salesRepresentativeId', '==', salesUserId)
    );
    const snap = await getDocs(q);

    let movedCount = 0;
    const nowIso = new Date().toISOString();

    for (const docSnap of snap.docs) {
      const reqData = docSnap.data() as MockupRequest;
      // Do NOT move completed or soft-deleted requests
      if (reqData.deleted) continue;
      if (reqData.status === 'COMPLETED') continue;

      const updatedTimeline = [
        ...(reqData.timeline || []),
        {
          action: 'Designer Reassigned',
          timestamp: nowIso,
          performedBy: params.actorId,
          performedByName: actorName,
          note: `Transferred to ${newDesignerName} — ${reason}`,
        },
      ];

      await updateDoc(docSnap.ref, {
        designerId: newDesignerId,
        designerName: newDesignerName,
        updatedAt: nowIso,
        timeline: updatedTimeline,
      });

      movedCount++;
    }

    if (movedCount > 0) {
      await createNotification({
        userId: newDesignerId,
        title: 'Pending Requests Transferred',
        message: `${movedCount} pending request(s) from ${params.salesUserName} were transferred to your queue.`,
        type: 'REQUEST_ASSIGNED',
      });
    }

    return movedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'mockupRequests');
    return 0;
  }
}

/**
 * Permanent Designer Reassignment (Admin Only - Requirement 7)
 */
export async function reassignSalesUserDesignerPermanent(params: {
  admin: UserProfile;
  salesUser: UserProfile;
  newDesigner: UserProfile;
}): Promise<void> {
  if (params.admin.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only administrators can permanently change Designer assignments.');
  }

  const nowIso = new Date().toISOString();
  const prevDesignerId = params.salesUser.assignedDesignerId || 'None';
  const prevDesignerName = params.salesUser.assignedDesignerName || 'Unassigned';

  await updateDoc(doc(db, 'users', params.salesUser.userId), {
    assignedDesignerId: params.newDesigner.userId,
    assignedDesignerName: params.newDesigner.name,
    temporaryDesigner: null, // Clear any active temporary override
    updatedAt: nowIso,
  });

  await logAuditEvent({
    action: 'PERMANENT_DESIGNER_CHANGE',
    performedBy: params.admin.userId,
    performedByName: params.admin.name,
    performedByRole: 'ADMIN',
    targetId: params.salesUser.userId,
    targetType: 'User',
    previousValue: `Previous Designer: ${prevDesignerName} (${prevDesignerId})`,
    newValue: `New Permanent Designer: ${params.newDesigner.name} (${params.newDesigner.userId})`,
  });

  // Transfer all existing pending requests
  await transferPendingRequestsForSalesUser({
    salesUserId: params.salesUser.userId,
    salesUserName: params.salesUser.name,
    newDesignerId: params.newDesigner.userId,
    newDesignerName: params.newDesigner.name,
    actorId: params.admin.userId,
    actorName: params.admin.name,
    reason: `Permanent assignment to ${params.newDesigner.name} by Administrator`,
  });
}

/**
 * Temporary Designer Reassignment (Head of Sales / Admin - Requirement 6)
 * Min duration: 1 Day, Max duration: 2 Months
 */
export async function reassignSalesUserDesignerTemporary(params: {
  actor: UserProfile;
  salesUser: UserProfile;
  newDesigner: UserProfile;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}): Promise<void> {
  if (params.actor.role !== 'HEAD_OF_SALES' && params.actor.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only Head of Sales or Administrators can assign temporary Designers.');
  }

  if (!params.startDate || !params.endDate) {
    throw new Error('Start date and end date are required.');
  }

  const startMs = new Date(params.startDate).getTime();
  const endMs = new Date(params.endDate).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Please select valid start and end dates.');
  }

  if (endMs < startMs) {
    throw new Error('End date must be on or after the start date.');
  }

  const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays < 1) {
    throw new Error('Minimum temporary assignment duration is 1 Day.');
  }
  if (diffDays > 62) {
    throw new Error('Maximum temporary assignment duration is 2 Months.');
  }

  const nowIso = new Date().toISOString();
  const prevDesignerId = params.salesUser.assignedDesignerId || '';
  const prevDesignerName = params.salesUser.assignedDesignerName || 'Unassigned';

  const tempAssignment = {
    designerId: params.newDesigner.userId,
    designerName: params.newDesigner.name,
    startDate: params.startDate,
    endDate: params.endDate,
    assignedAt: nowIso,
    assignedBy: params.actor.userId,
    assignedByName: params.actor.name,
    previousDesignerId: prevDesignerId,
    previousDesignerName: prevDesignerName,
  };

  await updateDoc(doc(db, 'users', params.salesUser.userId), {
    temporaryDesigner: tempAssignment,
    updatedAt: nowIso,
  });

  await logAuditEvent({
    action: 'TEMPORARY_DESIGNER_CHANGE',
    performedBy: params.actor.userId,
    performedByName: params.actor.name,
    performedByRole: params.actor.role,
    targetId: params.salesUser.userId,
    targetType: 'User',
    previousValue: `Original Designer: ${prevDesignerName}`,
    newValue: `Temporary Designer: ${params.newDesigner.name} (${params.startDate} to ${params.endDate})`,
  });

  // Transfer all pending requests to the temporary designer
  await transferPendingRequestsForSalesUser({
    salesUserId: params.salesUser.userId,
    salesUserName: params.salesUser.name,
    newDesignerId: params.newDesigner.userId,
    newDesignerName: params.newDesigner.name,
    actorId: params.actor.userId,
    actorName: params.actor.name,
    reason: `Temporary reassignment from ${params.startDate} to ${params.endDate} (${diffDays} days)`,
  });
}

/**
 * Reverts an expired or cancelled temporary assignment back to original designer.
 */
export async function revertTemporaryDesigner(params: {
  salesUser: UserProfile;
  actor: UserProfile;
}): Promise<void> {
  const temp = params.salesUser.temporaryDesigner;
  if (!temp) return;

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', params.salesUser.userId), {
    temporaryDesigner: null,
    updatedAt: nowIso,
  });

  const originalId = params.salesUser.assignedDesignerId || temp.previousDesignerId;
  const originalName = params.salesUser.assignedDesignerName || temp.previousDesignerName;

  if (originalId && originalName) {
    await transferPendingRequestsForSalesUser({
      salesUserId: params.salesUser.userId,
      salesUserName: params.salesUser.name,
      newDesignerId: originalId,
      newDesignerName: originalName,
      actorId: params.actor.userId,
      actorName: params.actor.name,
      reason: 'Temporary designer assignment expired; returned to original designer',
    });
  }
}

export async function createMockupRequest(params: {
  source: RequestSource;
  mockupTitle?: string | null;
  itemName?: string | null;
  itemNames?: string[];
  clientName?: string | null;
  clientMobileNumber?: string | null;
  contactBy?: string | null;
  notes?: string;
  referenceLinks?: string | null;
  additionalLinks?: string | null;
  additionalReferenceLinks?: string[];
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

    const isGallabox = params.source === 'gallabox';
    const rawItemNames = isGallabox
      ? []
      : params.itemNames && params.itemNames.length > 0
      ? params.itemNames.filter((n) => n && n.trim())
      : params.itemName ? [params.itemName.trim()] : [];

    const primaryItemName = rawItemNames.length > 0 ? rawItemNames[0] : (params.itemName || null);
    const rawRefLinks = params.additionalReferenceLinks && params.additionalReferenceLinks.length > 0
      ? params.additionalReferenceLinks.filter((l) => l && l.trim())
      : params.additionalLinks ? [params.additionalLinks.trim()] : [];

    const requestData: MockupRequest = {
      id: requestId,
      requestId,
      source: params.source,
      mockupTitle: isGallabox ? null : params.mockupTitle || null,
      itemName: isGallabox ? null : primaryItemName,
      itemNames: isGallabox ? [] : rawItemNames,
      clientName: params.clientName || null,
      clientMobileNumber: params.clientMobileNumber || null,
      contactBy: isGallabox ? null : params.contactBy || null,
      notes: params.notes || '',
      referenceLinks: isGallabox ? null : params.referenceLinks || null,
      additionalLinks: isGallabox ? null : (rawRefLinks.length > 0 ? rawRefLinks.join(' , ') : (params.additionalLinks || null)),
      additionalReferenceLinks: isGallabox ? [] : rawRefLinks,
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
  itemNames?: string[];
  additionalReferenceLinks?: string[];
  newAttachments?: MockupRequest['attachments'];
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

  const rawItemNames = params.itemNames && params.itemNames.length > 0
    ? params.itemNames.filter((n) => n && n.trim())
    : req.itemNames || (req.itemName ? [req.itemName] : []);

  const rawAddLinks = params.additionalReferenceLinks && params.additionalReferenceLinks.length > 0
    ? params.additionalReferenceLinks.filter((l) => l && l.trim())
    : req.additionalReferenceLinks || [];

  const newRevision: import('../types').RequestRevision = {
    revisionNumber: nextRevNumber,
    changesDetails: params.changesDetails.trim(),
    itemNames: rawItemNames,
    itemName: rawItemNames.length > 0 ? rawItemNames[0] : req.itemName,
    additionalReferenceLinks: rawAddLinks,
    attachments: params.newAttachments || [],
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

  // Merge any new attachments into the request's attachments list
  const combinedAttachments = [
    ...(req.attachments || []),
    ...(params.newAttachments || []),
  ];

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
      itemNames: rawItemNames,
      itemName: rawItemNames.length > 0 ? rawItemNames[0] : req.itemName,
      additionalReferenceLinks: rawAddLinks,
      additionalLinks: rawAddLinks.length > 0 ? rawAddLinks.join(' , ') : req.additionalLinks,
      attachments: combinedAttachments,
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

/**
 * Designer sends request back to Sales User for corrections/additional info (Requirement 14).
 * Retains exact same Request ID.
 */
export async function requestBackMockup(params: {
  request: MockupRequest;
  designerId: string;
  designerName: string;
  reason: string;
}): Promise<void> {
  const req = params.request;
  if (!params.reason || !params.reason.trim()) {
    throw new Error('Please provide the instructions / reason for requesting back.');
  }

  const nowIso = new Date().toISOString();
  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: 'Returned to Sales (Request Back)',
      timestamp: nowIso,
      performedBy: params.designerId,
      performedByName: params.designerName,
      performedByRole: 'DESIGNER',
      note: params.reason.trim(),
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      status: 'REQUEST_BACK',
      requestBackAt: nowIso,
      requestBackBy: params.designerId,
      requestBackByName: params.designerName,
      requestBackReason: params.reason.trim(),
      updatedAt: nowIso,
      timeline: updatedTimeline,
    });

    await createNotification({
      userId: req.salesRepresentativeId,
      title: `Request ${req.requestId} Returned for Updates`,
      message: `Designer ${params.designerName} requested corrections/updates on request ${req.requestId}. Reason: ${params.reason.trim()}`,
      type: 'REQUEST_BACK',
      requestId: req.requestId,
    });

    await logAuditEvent({
      action: 'REQUEST_BACK',
      performedBy: params.designerId,
      performedByName: params.designerName,
      performedByRole: 'DESIGNER',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: 'PENDING',
      newValue: `REQUEST_BACK: ${params.reason.trim()}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mockupRequests/${req.id}`);
  }
}

/**
 * Sales Representative edits and resubmits a returned request (Requirement 14).
 * Retains the exact same Request ID and audit history.
 */
export async function resubmitReturnedRequest(params: {
  request: MockupRequest;
  salesRepresentativeId: string;
  salesRepresentativeName: string;
  updatedNotes?: string;
  itemNames?: string[];
  additionalReferenceLinks?: string[];
  newAttachments?: RequestAttachment[];
  updatedFields?: {
    itemNames?: string[];
    notes?: string;
    additionalReferenceLinks?: string[];
    attachments?: MockupRequest['attachments'];
  };
  timezone?: string;
}): Promise<void> {
  const req = params.request;
  const nowIso = new Date().toISOString();

  const itemNames =
    params.itemNames ||
    params.updatedFields?.itemNames ||
    req.itemNames ||
    (req.itemName ? [req.itemName] : []);
  const itemName = itemNames.length > 0 ? itemNames[0] : req.itemName;
  const addLinks =
    params.additionalReferenceLinks ||
    params.updatedFields?.additionalReferenceLinks ||
    req.additionalReferenceLinks ||
    [];
  const additionalLinks = addLinks.length > 0 ? addLinks.join(' , ') : req.additionalLinks;

  const notesVal =
    params.updatedNotes !== undefined
      ? params.updatedNotes
      : params.updatedFields?.notes !== undefined
      ? params.updatedFields.notes
      : req.notes;

  const finalAttachments = [
    ...(req.attachments || []),
    ...(params.newAttachments || []),
    ...(params.updatedFields?.attachments || []),
  ];

  const updatedTimeline = [
    ...(req.timeline || []),
    {
      action: 'Corrected & Resubmitted by Sales',
      timestamp: nowIso,
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      note: 'Updated details provided by Sales Representative',
    },
  ];

  try {
    await updateDoc(doc(db, 'mockupRequests', req.id), {
      itemNames,
      itemName,
      notes: notesVal,
      additionalReferenceLinks: addLinks,
      additionalLinks,
      attachments: finalAttachments,
      status: 'PENDING',
      requestBackAt: null,
      requestBackReason: null,
      updatedAt: nowIso,
      timeline: updatedTimeline,
    });

    await createNotification({
      userId: req.designerId,
      title: 'Mockup Request Resubmitted',
      message: `${params.salesRepresentativeName} corrected and resubmitted request ${req.requestId}`,
      type: 'REQUEST_RESUBMITTED',
      requestId: req.requestId,
    });

    await logAuditEvent({
      action: 'REQUEST_RESUBMITTED_AFTER_BACK',
      performedBy: params.salesRepresentativeId,
      performedByName: params.salesRepresentativeName,
      performedByRole: 'SALES_REPRESENTATIVE',
      targetId: req.requestId,
      targetType: 'MockupRequest',
      previousValue: 'REQUEST_BACK',
      newValue: 'PENDING',
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
