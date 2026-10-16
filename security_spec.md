# Security Specification & Invariants: Marchlist Mockup Request

## 1. Data Invariants
1. **User Identity & Role Integrity**: A user cannot modify their own `role`, `active` status, or `assignedDesignerId`. Only ADMIN can manage users. The last active ADMIN can never be deleted or disabled.
2. **Sales Representative Request Isolation**: A Sales Representative can only create requests where `salesRepresentativeId == request.auth.uid`. They can only read their own requests.
3. **Automatic Designer Assignment**: A Sales Representative cannot alter the `designerId` or assign work to unassigned designers. Requests must be assigned strictly to the Admin-assigned designer on their user document.
4. **Designer Workload & Completion Integrity**: A Designer can only read requests assigned to them (`designerId == request.auth.uid`) or complete/reject requests assigned to them.
5. **High Priority Capacity Guard**: Maximum active unfinished requests per designer: SUPER_URGENT = 1, URGENT = 2. Submissions exceeding capacity are blocked.
6. **Immutable Request IDs & Timestamps**: Request IDs (`M000001`...) cannot be modified once set. `createdAt` is immutable.
7. **Rejection & Resubmission State Machine**:
   - Status transitions strictly follow: `PENDING` -> `COMPLETED`, or `PENDING` -> `REJECTED` (with required reason), or `REJECTED` -> `PENDING` (resubmission by original sales rep).
8. **Audit Trail**: Audit logs are append-only. No updates or deletions allowed by non-admins.
9. **Settings Security**: Company settings can only be modified by ADMIN.

## 2. Dirty Dozen Payloads (Designed to Break Identity, Integrity, and State)
1. **Self-Promote Role**: Regular sales rep attempts to update `/users/{uid}` with `role: "ADMIN"`. (FAIL: PERMISSION_DENIED)
2. **Steal Request Ownership**: Sales Rep B attempts to update `salesRepresentativeId` of Sales Rep A's request. (FAIL: PERMISSION_DENIED)
3. **Bypass Designer Assignment**: Sales Rep assigns a request directly to Designer X when assigned Designer is Y. (FAIL: PERMISSION_DENIED)
4. **Overwriting Creation Timestamp**: Attacker attempts to forge `createdAt` on an existing request. (FAIL: PERMISSION_DENIED)
5. **Unauthorized Request Completion**: Unauthorized user or Sales Rep attempts to mark request status as `COMPLETED`. (FAIL: PERMISSION_DENIED)
6. **Reject without Reason**: Designer attempts to set status `REJECTED` without providing `rejectionReason`. (FAIL: PERMISSION_DENIED)
7. **Cross-Designer Read**: Designer A queries or reads requests assigned to Designer B. (FAIL: PERMISSION_DENIED)
8. **Cross-Sales Read**: Sales Rep A queries or reads requests belonging to Sales Rep B. (FAIL: PERMISSION_DENIED)
9. **Tampering with Audit Logs**: Non-admin attempts to delete or alter an audit log document. (FAIL: PERMISSION_DENIED)
10. **Disable Last Admin**: Admin attempts to update their own active status to `false` when they are the sole active Admin. (FAIL: PERMISSION_DENIED)
11. **Inject Giant Payloads**: Attacker attempts to write a 2MB string into `mockupTitle` or `notes`. (FAIL: PERMISSION_DENIED)
12. **Tamper Request ID**: Sales Rep attempts to overwrite `requestId` with an arbitrary string. (FAIL: PERMISSION_DENIED)
