export type UserRole = 'ADMIN' | 'HEAD_OF_SALES' | 'SALES_REPRESENTATIVE' | 'DESIGNER';

export type RequestSource = 'gallabox' | 'whatsapp' | 'email' | 'others';

export type RequestPriority = 'REGULAR' | 'URGENT' | 'SUPER_URGENT';

export type RequestStatus = 'PENDING' | 'REJECTED' | 'COMPLETED';

export interface UserProfile {
  userId: string;
  name: string;
  loginId: string; // Exactly 9 numeric digits
  role: UserRole;
  active: boolean;
  avatarUrl?: string | null;
  assignedDesignerId?: string;
  assignedDesignerName?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  password?: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface RequestAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface RequestRevision {
  revisionNumber: number;
  changesDetails: string;
  requestedAt: string;
  requestedDate?: string | null;
  requestedTime?: string | null;
  requestedBy: string;
  requestedByName: string;
  completedAt?: string | null;
  completedDate?: string | null;
  completedTime?: string | null;
  completedBy?: string | null;
  completedByName?: string | null;
  waitingTime?: string | null;
}

export interface TimelineEvent {
  action: string;
  timestamp: string;
  performedBy: string;
  performedByName: string;
  performedByRole?: string;
  note?: string;
}

export interface MockupRequest {
  id: string;
  requestId: string; // M000001 format
  source: RequestSource;
  mockupTitle: string | null;
  itemName: string | null;
  clientName?: string | null;
  clientMobileNumber?: string | null;
  contactBy?: string | null;
  notes: string;
  referenceLinks?: string | null;
  additionalLinks?: string | null;
  attachments?: RequestAttachment[];
  salesRepresentativeId: string;
  salesRepresentativeName: string;
  designerId: string;
  designerName: string;
  status: RequestStatus;
  priority: RequestPriority;
  createdAt: string; // ISO string
  createdDate?: string;
  createdTime?: string;
  assignedAt: string;
  assignedDate?: string;
  assignedTime?: string;
  completedAt?: string | null;
  completedDate?: string | null;
  completedTime?: string | null;
  completedBy?: string | null;
  completedByName?: string | null;
  originalCompletedAt?: string | null;
  originalCompletedDate?: string | null;
  originalCompletedTime?: string | null;
  originalCompletedBy?: string | null;
  originalCompletedByName?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedByName?: string | null;
  rejectionReason?: string | null;
  revisions?: RequestRevision[];
  currentRevision?: number;
  latestChangesDetails?: string | null;
  updatedAt: string;
  deleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  timeline?: TimelineEvent[];
}

export interface AppNotification {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: 'REQUEST_ASSIGNED' | 'REQUEST_COMPLETED' | 'REQUEST_REJECTED' | 'REQUEST_RESUBMITTED' | 'SYSTEM_ALERT';
  requestId?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  logId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  performedByRole?: string;
  targetId?: string;
  targetType?: string;
  timestamp: string;
  previousValue?: string;
  newValue?: string;
}

export interface CompanySettings {
  companyName: string;
  applicationName: string;
  timezone: string;
  dateFormat: string;
  logo?: string; // custom logo SVG/data URL if updated
  updatedAt: string;
  updatedBy?: string;
}

export interface DesignerCapacity {
  designerId: string;
  designerName: string;
  superUrgentCount: number;
  superUrgentMax: number;
  urgentCount: number;
  urgentMax: number;
  regularCount: number;
  canAcceptSuperUrgent: boolean;
  canAcceptUrgent: boolean;
}
