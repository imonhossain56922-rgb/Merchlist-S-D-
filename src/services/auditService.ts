import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AuditLog } from '../types';

export async function logAuditEvent(params: {
  action: string;
  performedBy: string;
  performedByName: string;
  performedByRole?: string;
  targetId?: string;
  targetType?: string;
  previousValue?: string;
  newValue?: string;
}): Promise<void> {
  const logId = `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const auditDoc: AuditLog = {
    logId,
    action: params.action,
    performedBy: params.performedBy,
    performedByName: params.performedByName,
    performedByRole: params.performedByRole || 'SYSTEM',
    targetId: params.targetId || '',
    targetType: params.targetType || 'SYSTEM',
    timestamp: new Date().toISOString(),
    previousValue: params.previousValue || '',
    newValue: params.newValue || '',
  };

  try {
    await setDoc(doc(db, 'auditLogs', logId), auditDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `auditLogs/${logId}`);
  }
}

export async function fetchAuditLogs(limitCount = 100): Promise<AuditLog[]> {
  try {
    const q = query(
      collection(db, 'auditLogs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as AuditLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    return [];
  }
}
