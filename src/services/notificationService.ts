import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AppNotification } from '../types';

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: AppNotification['type'];
  requestId?: string;
}): Promise<void> {
  const notificationId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const notif: AppNotification = {
    notificationId,
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    requestId: params.requestId || '',
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'notifications', notificationId), notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notificationId}`);
  }
}

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as AppNotification);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    }
  );
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'notifications');
  }
}
