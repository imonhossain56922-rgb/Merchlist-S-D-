import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword as fbUpdatePassword,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { logAuditEvent } from './auditService';
import { transferPendingRequestsForSalesUser } from './requestService';

export const INITIAL_ADMIN_LOGIN_ID = '564302533';
export const INITIAL_ADMIN_DEFAULT_PASSWORD = 'Uae@@120890';
export const SESSION_STORAGE_KEY = 'marchlist_session_user';

export function getInternalEmail(loginId: string): string {
  return `${loginId.trim()}@internal.merchlist.app`;
}

export function isValidLoginId(loginId: string): boolean {
  return /^\d{9}$/.test(loginId.trim());
}

/**
 * Ensures the primary Admin account exists in Firestore
 */
export async function ensureDefaultAdminAccount(): Promise<UserProfile> {
  const adminDocRef = doc(db, 'users', `admin_${INITIAL_ADMIN_LOGIN_ID}`);
  try {
    const snap = await getDoc(adminDocRef);
    const nowIso = new Date().toISOString();
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      return data;
    }

    const adminProfile: UserProfile = {
      userId: `admin_${INITIAL_ADMIN_LOGIN_ID}`,
      name: 'Administrator',
      loginId: INITIAL_ADMIN_LOGIN_ID,
      role: 'ADMIN',
      active: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
    };

    await setDoc(adminDocRef, {
      ...adminProfile,
      password: INITIAL_ADMIN_DEFAULT_PASSWORD,
    });
    return adminProfile;
  } catch (error) {
    console.warn('Could not verify admin account document:', error);
    return {
      userId: `admin_${INITIAL_ADMIN_LOGIN_ID}`,
      name: 'Administrator',
      loginId: INITIAL_ADMIN_LOGIN_ID,
      role: 'ADMIN',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function loginWithLoginId(
  loginId: string,
  pass: string
): Promise<UserProfile> {
  const cleanId = loginId.trim();

  if (!isValidLoginId(cleanId)) {
    throw new Error('Login ID must contain exactly 9 digits.');
  }
  if (!pass || pass.length < 6) {
    throw new Error('Please enter a valid password.');
  }

  // 1. Primary Admin Authentication (Login ID: 564302533 & Password: Uae@@120890)
  if (cleanId === INITIAL_ADMIN_LOGIN_ID) {
    // Check if custom password was saved in Firestore or matches default
    const adminDocRef = doc(db, 'users', `admin_${INITIAL_ADMIN_LOGIN_ID}`);
    let adminProfile: UserProfile;

    try {
      const snap = await getDoc(adminDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile & { password?: string };
        const validPassword = data.password || INITIAL_ADMIN_DEFAULT_PASSWORD;
        if (pass !== validPassword && pass !== INITIAL_ADMIN_DEFAULT_PASSWORD) {
          throw new Error('Invalid Login ID or password. Please verify your credentials.');
        }
        adminProfile = data;
      } else {
        if (pass !== INITIAL_ADMIN_DEFAULT_PASSWORD) {
          throw new Error('Invalid Login ID or password. Please verify your credentials.');
        }
        adminProfile = await ensureDefaultAdminAccount();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Invalid Login ID or password')) {
        throw err;
      }
      if (pass !== INITIAL_ADMIN_DEFAULT_PASSWORD) {
        throw new Error('Invalid Login ID or password. Please verify your credentials.');
      }
      adminProfile = await ensureDefaultAdminAccount();
    }

    // Update last activity
    const nowIso = new Date().toISOString();
    updateDoc(adminDocRef, { lastActivityAt: nowIso }).catch(() => {});

    // Try optional background Firebase Auth sign-in if enabled
    const internalEmail = getInternalEmail(cleanId);
    signInWithEmailAndPassword(auth, internalEmail, pass)
      .catch(() => {
        createUserWithEmailAndPassword(auth, internalEmail, pass).catch(() => {});
      });

    // Save session
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(adminProfile));
    }
    return adminProfile;
  }

  // 2. Standard Users (Sales Reps, Designers, Head of Sales, other Admins)
  try {
    const q = query(
      collection(db, 'users'),
      where('loginId', '==', cleanId)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('User account not found. Please contact an Administrator.');
    }

    const userDoc = snap.docs[0];
    const data = userDoc.data() as UserProfile & { password?: string };

    if (data.password && data.password !== pass) {
      throw new Error('Invalid Login ID or password. Please verify your credentials.');
    }

    if (!data.active || data.deleted) {
      throw new Error('Your account is currently disabled. Please contact an Administrator.');
    }

    const nowIso = new Date().toISOString();
    updateDoc(userDoc.ref, { lastActivityAt: nowIso }).catch(() => {});

    // Optional background Firebase Auth sign-in
    const internalEmail = getInternalEmail(cleanId);
    signInWithEmailAndPassword(auth, internalEmail, pass).catch(() => {});

    // Save session
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found') || message.includes('disabled') || message.includes('Invalid Login ID')) {
      throw error;
    }
    throw new Error('Authentication failed. Please verify your credentials.');
  }
}

export async function checkInitialAdminStatus(): Promise<{
  adminExists: boolean;
  canBootstrap: boolean;
}> {
  try {
    const adminDoc = await getDoc(doc(db, 'users', `admin_${INITIAL_ADMIN_LOGIN_ID}`));
    if (adminDoc.exists()) {
      return { adminExists: true, canBootstrap: false };
    }
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'ADMIN'),
      where('active', '==', true)
    );
    const snap = await getDocs(q);
    const adminExists = !snap.empty;
    return { adminExists, canBootstrap: !adminExists };
  } catch {
    return { adminExists: true, canBootstrap: false };
  }
}

export async function bootstrapInitialAdmin(initialPassword: string): Promise<UserProfile> {
  if (!initialPassword || initialPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const nowIso = new Date().toISOString();
  const profile: UserProfile = {
    userId: `admin_${INITIAL_ADMIN_LOGIN_ID}`,
    name: 'Administrator',
    loginId: INITIAL_ADMIN_LOGIN_ID,
    role: 'ADMIN',
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastActivityAt: nowIso,
  };

  const adminDocRef = doc(db, 'users', `admin_${INITIAL_ADMIN_LOGIN_ID}`);
  await setDoc(adminDocRef, {
    ...profile,
    password: initialPassword,
  });

  // Try creating in Firebase Auth too
  const internalEmail = getInternalEmail(INITIAL_ADMIN_LOGIN_ID);
  createUserWithEmailAndPassword(auth, internalEmail, initialPassword).catch(() => {});

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
  }

  await logAuditEvent({
    action: 'INITIAL_ADMIN_INITIALIZED',
    performedBy: profile.userId,
    performedByName: 'Administrator',
    performedByRole: 'ADMIN',
    targetId: profile.userId,
    targetType: 'User',
    newValue: `Login ID: ${INITIAL_ADMIN_LOGIN_ID}`,
  }).catch(() => {});

  return profile;
}

export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    let userList = snap.docs
      .map((d) => {
        const u = d.data() as UserProfile;
        if (u.loginId === INITIAL_ADMIN_LOGIN_ID && !u.password) {
          u.password = INITIAL_ADMIN_DEFAULT_PASSWORD;
        }
        return u;
      })
      .filter((u) => !u.deleted);

    // If no admin user exists in userList, ensure default admin is created and included
    if (!userList.some((u) => u.loginId === INITIAL_ADMIN_LOGIN_ID)) {
      const adminProfile = await ensureDefaultAdminAccount();
      userList.unshift({
        ...adminProfile,
        password: INITIAL_ADMIN_DEFAULT_PASSWORD,
      });
    }

    return userList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

export async function createSystemUser(
  creator: UserProfile,
  params: {
    name: string;
    loginId: string;
    password: string;
    role: UserRole;
    active: boolean;
    assignedDesignerId?: string;
    assignedDesignerName?: string;
    avatarUrl?: string | null;
  }
): Promise<UserProfile> {
  if (creator.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only administrators can create users.');
  }

  if (!isValidLoginId(params.loginId)) {
    throw new Error('Login ID must contain exactly 9 digits.');
  }

  if (!params.name.trim()) {
    throw new Error('Full Name is required.');
  }

  if (!params.password || params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  if (params.role === 'SALES_REPRESENTATIVE' && !params.assignedDesignerId) {
    throw new Error('An Assigned Designer is required for Sales Representatives.');
  }

  const cleanId = params.loginId.trim();

  // Check loginId uniqueness in Firestore
  const q = query(collection(db, 'users'), where('loginId', '==', cleanId));
  const existing = await getDocs(q);
  if (!existing.empty && existing.docs.some((d) => !d.data().deleted)) {
    throw new Error('A user with this 9-digit Login ID already exists.');
  }

  const uid = `user_${cleanId}`;
  const nowIso = new Date().toISOString();
  const newUser: UserProfile = {
    userId: uid,
    name: params.name.trim(),
    loginId: cleanId,
    role: params.role,
    active: params.active,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (params.role === 'SALES_REPRESENTATIVE' && params.assignedDesignerId) {
    newUser.assignedDesignerId = params.assignedDesignerId;
    if (params.assignedDesignerName) {
      newUser.assignedDesignerName = params.assignedDesignerName;
    }
  }

  if (params.avatarUrl) {
    newUser.avatarUrl = params.avatarUrl;
  }

  const docPayload: Record<string, any> = {
    ...newUser,
    password: params.password,
  };

  await setDoc(doc(db, 'users', uid), docPayload);

  // Try creating in Firebase Auth as well
  const internalEmail = getInternalEmail(cleanId);
  createUserWithEmailAndPassword(auth, internalEmail, params.password).catch(() => {});

  await logAuditEvent({
    action: 'USER_CREATED',
    performedBy: creator.userId,
    performedByName: creator.name,
    performedByRole: creator.role,
    targetId: uid,
    targetType: 'User',
    newValue: `Name: ${newUser.name}, LoginID: ${newUser.loginId}, Role: ${newUser.role}`,
  }).catch(() => {});

  return newUser;
}

export async function updateSystemUser(
  admin: UserProfile,
  userId: string,
  updates: Partial<UserProfile> & { password?: string }
): Promise<void> {
  if (admin.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only administrators can update users.');
  }

  // Protect the last active admin
  if (updates.active === false || (updates.role && updates.role !== 'ADMIN')) {
    const targetSnap = await getDoc(doc(db, 'users', userId));
    const targetUser = targetSnap.data() as UserProfile | undefined;
    if (targetUser?.role === 'ADMIN') {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'ADMIN'),
        where('active', '==', true)
      );
      const activeAdmins = await getDocs(q);
      const activeCount = activeAdmins.docs.filter((d) => !d.data().deleted).length;
      if (activeCount <= 1 && activeAdmins.docs[0]?.id === userId) {
        throw new Error('You cannot disable or delete the last active Admin account.');
      }
    }
  }

  const nowIso = new Date().toISOString();
  const cleanedUpdates: Record<string, any> = {
    updatedAt: nowIso,
  };
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      cleanedUpdates[k] = v;
    }
  }

  await updateDoc(doc(db, 'users', userId), cleanedUpdates);

  await logAuditEvent({
    action: 'USER_UPDATED',
    performedBy: admin.userId,
    performedByName: admin.name,
    performedByRole: 'ADMIN',
    targetId: userId,
    targetType: 'User',
    newValue: JSON.stringify(updates),
  }).catch(() => {});
}

export async function deleteSystemUser(
  admin: UserProfile,
  userId: string
): Promise<void> {
  if (admin.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only administrators can delete users.');
  }

  const targetSnap = await getDoc(doc(db, 'users', userId));
  const targetUser = targetSnap.data() as UserProfile | undefined;

  if (targetUser?.role === 'ADMIN') {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'ADMIN'),
      where('active', '==', true)
    );
    const activeAdmins = await getDocs(q);
    const activeCount = activeAdmins.docs.filter((d) => !d.data().deleted).length;
    if (activeCount <= 1 && activeAdmins.docs[0]?.id === userId) {
      throw new Error('You cannot disable or delete the last active Admin account.');
    }
  }

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', userId), {
    active: false,
    deleted: true,
    deletedAt: nowIso,
    deletedBy: admin.userId,
    updatedAt: nowIso,
  });

  await logAuditEvent({
    action: 'USER_DELETED',
    performedBy: admin.userId,
    performedByName: admin.name,
    performedByRole: 'ADMIN',
    targetId: userId,
    targetType: 'User',
    newValue: `Deleted user: ${targetUser?.name || userId}`,
  }).catch(() => {});
}

export async function logoutUser(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  await fbSignOut(auth).catch(() => {});
}

/**
 * Non-Admin users change their own password.
 * Master Admin account credentials (564302533) are protected.
 */
export async function changeUserPassword(
  user: UserProfile,
  newPass: string
): Promise<void> {
  if (user.role === 'ADMIN' || user.loginId === INITIAL_ADMIN_LOGIN_ID) {
    throw new Error('Master Administrator credentials cannot be modified from user profile.');
  }

  if (!newPass || newPass.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', user.userId), {
    password: newPass,
    updatedAt: nowIso,
  });

  // Try updating in Firebase Auth if available
  if (auth.currentUser) {
    fbUpdatePassword(auth.currentUser, newPass).catch(() => {});
  }

  // Update local session storage
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.password = newPass;
        parsed.updatedAt = nowIso;
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
    }
  }

  await logAuditEvent({
    action: 'USER_PASSWORD_CHANGED',
    performedBy: user.userId,
    performedByName: user.name,
    performedByRole: user.role,
    targetId: user.userId,
    targetType: 'User',
    newValue: `User ${user.name} (${user.loginId}) changed their own password`,
  }).catch(() => {});
}

/**
 * Admin resets or sets a new password for any user.
 */
export async function adminResetUserPassword(
  admin: UserProfile,
  targetUserId: string,
  newPass: string
): Promise<void> {
  if (admin.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only administrators can reset user passwords.');
  }

  if (!newPass || newPass.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const targetSnap = await getDoc(doc(db, 'users', targetUserId));
  if (!targetSnap.exists()) {
    throw new Error('User not found.');
  }
  const targetUser = targetSnap.data() as UserProfile;

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', targetUserId), {
    password: newPass,
    updatedAt: nowIso,
  });

  await logAuditEvent({
    action: 'ADMIN_RESET_PASSWORD',
    performedBy: admin.userId,
    performedByName: admin.name,
    performedByRole: 'ADMIN',
    targetId: targetUserId,
    targetType: 'User',
    newValue: `Admin reset password for ${targetUser.name} (${targetUser.loginId})`,
  }).catch(() => {});
}

/**
 * Updates a user's profile picture.
 * Persists to Firestore, updates localStorage session, and logs audit event.
 */
export async function updateUserProfilePicture(
  user: UserProfile,
  avatarUrl: string | null
): Promise<UserProfile> {
  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', user.userId), {
    avatarUrl: avatarUrl || null,
    updatedAt: nowIso,
  });

  const updatedProfile: UserProfile = {
    ...user,
    avatarUrl: avatarUrl || null,
    updatedAt: nowIso,
  };

  // Update local session storage
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.avatarUrl = avatarUrl || null;
        parsed.updatedAt = nowIso;
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
    }
  }

  await logAuditEvent({
    action: 'USER_AVATAR_UPDATED',
    performedBy: user.userId,
    performedByName: user.name,
    performedByRole: user.role,
    targetId: user.userId,
    targetType: 'User',
    newValue: avatarUrl ? 'Updated profile picture' : 'Removed profile picture',
  }).catch(() => {});

  return updatedProfile;
}

/**
 * Head of Sales or Admin assigns a temporary designer to a Sales Representative (Requirement 6 & 8).
 * Duration must be between 1 day and 2 months.
 * Automatically moves all pending/incomplete mockup requests to the new designer.
 */
export async function assignTemporaryDesigner(params: {
  actor: UserProfile;
  salesUserId: string;
  newDesignerId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
}): Promise<void> {
  const { actor, salesUserId, newDesignerId, startDate, endDate, reason } = params;

  if (actor.role !== 'HEAD_OF_SALES' && actor.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only Head of Sales or Administrators can assign a temporary designer.');
  }

  if (!startDate || !endDate) {
    throw new Error('Start date and End date are both required.');
  }

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (isNaN(start) || isNaN(end)) {
    throw new Error('Invalid start or end date format.');
  }

  const diffMs = end - start;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1; // Inclusive day count

  if (diffDays < 1) {
    throw new Error('The temporary assignment duration must be at least 1 day.');
  }

  // Maximum duration: 2 months (approx 62 days)
  if (diffDays > 62) {
    throw new Error('The temporary assignment duration cannot exceed 2 months (62 days).');
  }

  // Fetch sales user and new designer
  const [salesSnap, desSnap] = await Promise.all([
    getDoc(doc(db, 'users', salesUserId)),
    getDoc(doc(db, 'users', newDesignerId)),
  ]);

  if (!salesSnap.exists()) throw new Error('Sales User not found.');
  if (!desSnap.exists()) throw new Error('Selected Designer not found.');

  const salesUser = salesSnap.data() as UserProfile;
  const newDesigner = desSnap.data() as UserProfile;

  if (salesUser.role !== 'SALES_REPRESENTATIVE') {
    throw new Error('Target user must be a Sales Representative.');
  }
  if (newDesigner.role !== 'DESIGNER') {
    throw new Error('Target assigned user must be a Designer.');
  }

  const nowIso = new Date().toISOString();
  const tempAssignment: import('../types').TemporaryDesignerAssignment = {
    designerId: newDesigner.userId,
    designerName: newDesigner.name,
    startDate,
    endDate,
    assignedAt: nowIso,
    assignedBy: actor.userId,
    assignedByName: actor.name,
    previousDesignerId: salesUser.assignedDesignerId || '',
    previousDesignerName: salesUser.assignedDesignerName || '',
  };

  // Update Sales User document
  await updateDoc(doc(db, 'users', salesUserId), {
    temporaryDesigner: tempAssignment,
    updatedAt: nowIso,
  });

  // Transfer all existing pending/incomplete requests automatically (Requirement 8)
  const transferReason = reason || `Temporary assignment from ${startDate} to ${endDate} by ${actor.name}`;
  await transferPendingRequestsForSalesUser({
    salesUserId: salesUser.userId,
    salesUserName: salesUser.name,
    newDesignerId: newDesigner.userId,
    newDesignerName: newDesigner.name,
    actorId: actor.userId,
    actorName: actor.name,
    reason: transferReason,
  });

  // Audit log
  await logAuditEvent({
    action: 'TEMPORARY_DESIGNER_ASSIGNED',
    performedBy: actor.userId,
    performedByName: actor.name,
    performedByRole: actor.role,
    targetId: salesUser.userId,
    targetType: 'User',
    previousValue: salesUser.assignedDesignerName || 'None',
    newValue: `Temporary: ${newDesigner.name} (${startDate} to ${endDate})`,
  });
}

/**
 * Clears an active temporary designer assignment, restoring the original designer and transferring pending requests.
 */
export async function clearTemporaryDesignerAssignment(params: {
  actor: UserProfile;
  salesUserId: string;
}): Promise<void> {
  const { actor, salesUserId } = params;
  if (actor.role !== 'HEAD_OF_SALES' && actor.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only Head of Sales or Administrators can clear temporary designer assignments.');
  }

  const salesSnap = await getDoc(doc(db, 'users', salesUserId));
  if (!salesSnap.exists()) throw new Error('Sales User not found.');
  const salesUser = salesSnap.data() as UserProfile;

  const temp = salesUser.temporaryDesigner;
  if (!temp) return; // Nothing to clear

  const originalDesignerId = temp.previousDesignerId || salesUser.assignedDesignerId;
  const originalDesignerName = temp.previousDesignerName || salesUser.assignedDesignerName;

  const nowIso = new Date().toISOString();
  await updateDoc(doc(db, 'users', salesUserId), {
    temporaryDesigner: null,
    updatedAt: nowIso,
  });

  if (originalDesignerId && originalDesignerName) {
    await transferPendingRequestsForSalesUser({
      salesUserId: salesUser.userId,
      salesUserName: salesUser.name,
      newDesignerId: originalDesignerId,
      newDesignerName: originalDesignerName,
      actorId: actor.userId,
      actorName: actor.name,
      reason: `Temporary assignment ended / reverted to permanent designer ${originalDesignerName}`,
    });
  }

  await logAuditEvent({
    action: 'TEMPORARY_DESIGNER_CLEARED',
    performedBy: actor.userId,
    performedByName: actor.name,
    performedByRole: actor.role,
    targetId: salesUser.userId,
    targetType: 'User',
    previousValue: `Temporary: ${temp.designerName}`,
    newValue: `Restored: ${originalDesignerName || 'Permanent Designer'}`,
  });
}

/**
 * Admin permanently reassigns a Sales User's designer (Requirement 7 & 8).
 * Head of Sales is strictly disallowed.
 * Automatically moves all pending/incomplete mockup requests to the new designer.
 */
export async function assignPermanentDesigner(params: {
  actor: UserProfile;
  salesUserId: string;
  newDesignerId: string;
  reason?: string;
}): Promise<void> {
  const { actor, salesUserId, newDesignerId, reason } = params;

  if (actor.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only an Administrator can permanently change designer assignments.');
  }

  const [salesSnap, desSnap] = await Promise.all([
    getDoc(doc(db, 'users', salesUserId)),
    getDoc(doc(db, 'users', newDesignerId)),
  ]);

  if (!salesSnap.exists()) throw new Error('Sales User not found.');
  if (!desSnap.exists()) throw new Error('Selected Designer not found.');

  const salesUser = salesSnap.data() as UserProfile;
  const newDesigner = desSnap.data() as UserProfile;

  if (salesUser.role !== 'SALES_REPRESENTATIVE') {
    throw new Error('Target user must be a Sales Representative.');
  }
  if (newDesigner.role !== 'DESIGNER') {
    throw new Error('Target assigned user must be a Designer.');
  }

  const prevDesignerName = salesUser.assignedDesignerName || 'None';
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, 'users', salesUserId), {
    assignedDesignerId: newDesigner.userId,
    assignedDesignerName: newDesigner.name,
    temporaryDesigner: null, // Clear any active temporary assignment
    updatedAt: nowIso,
  });

  // Transfer all pending/incomplete requests (Requirement 8)
  const transferReason = reason || `Permanent reassignment by Administrator ${actor.name}`;
  await transferPendingRequestsForSalesUser({
    salesUserId: salesUser.userId,
    salesUserName: salesUser.name,
    newDesignerId: newDesigner.userId,
    newDesignerName: newDesigner.name,
    actorId: actor.userId,
    actorName: actor.name,
    reason: transferReason,
  });

  // Audit log
  await logAuditEvent({
    action: 'PERMANENT_DESIGNER_ASSIGNED',
    performedBy: actor.userId,
    performedByName: actor.name,
    performedByRole: 'ADMIN',
    targetId: salesUser.userId,
    targetType: 'User',
    previousValue: prevDesignerName,
    newValue: `Permanent: ${newDesigner.name}`,
  });
}


