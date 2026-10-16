import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CompanySettings } from '../types';
import { logAuditEvent } from './auditService';

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Merchlist',
  applicationName: 'Marchlist Mockup Request',
  timezone: 'Asia/Dubai',
  dateFormat: 'DD/MM/YYYY',
  updatedAt: new Date().toISOString(),
};

const SETTINGS_DOC_ID = 'global';

export async function fetchCompanySettings(): Promise<CompanySettings> {
  try {
    const ref = doc(db, 'companySettings', SETTINGS_DOC_ID);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...DEFAULT_COMPANY_SETTINGS, ...(snap.data() as Partial<CompanySettings>) };
    }
    return DEFAULT_COMPANY_SETTINGS;
  } catch {
    return DEFAULT_COMPANY_SETTINGS;
  }
}

export async function updateCompanySettings(
  newSettings: Partial<CompanySettings>,
  adminId: string,
  adminName: string
): Promise<CompanySettings> {
  const current = await fetchCompanySettings();
  const updated: CompanySettings = {
    ...current,
    ...newSettings,
    updatedAt: new Date().toISOString(),
    updatedBy: adminId,
  };

  try {
    await setDoc(doc(db, 'companySettings', SETTINGS_DOC_ID), updated);
    await logAuditEvent({
      action: 'COMPANY_SETTINGS_UPDATED',
      performedBy: adminId,
      performedByName: adminName,
      performedByRole: 'ADMIN',
      targetId: SETTINGS_DOC_ID,
      targetType: 'CompanySettings',
      previousValue: JSON.stringify(current),
      newValue: JSON.stringify(updated),
    });
    return updated;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companySettings/${SETTINGS_DOC_ID}`);
    return current;
  }
}
