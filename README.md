# Marchlist Mockup Request

Internal company system for **Merchlist** managing mockup and design requests between Sales Representatives and Designers.

## Official Brand & Naming
- **Company / Brand Name:** `Merchlist`
- **Official Application Name:** `Marchlist Mockup Request`
- **Default Timezone:** `Asia/Dubai` (GST, UTC+4)

---

## Production Architecture & Features

1. **Authentication System:**
   - Strict **9-digit numeric Login ID** (`^\d{9}$`) and password.
   - Zero email fields visible in UI.
   - Internal secure mapping to Firebase Authentication (`<9-digit-id>@internal.merchlist.app`).
   - Initial Admin account: `564302533`.
   - Dedicated initial Admin bootstrap flow for first launch with zero hardcoded passwords.

2. **User Roles (Strict RBAC):**
   - **ADMIN:** Full system control, user management, designer assignments, settings, audit trail, reports, reopening requests, soft delete.
   - **HEAD OF SALES:** Executive read-only monitoring dashboard, team performance, individual sales/designer drilldown, request source analytics, PDF reporting.
   - **SALES REPRESENTATIVE:** Submits mockup requests with dynamic form based on Source, auto-assigned to designated Designer, tracks pending, rejected (with reasons), completed, and live priority capacity indicator.
   - **DESIGNER:** Priority-sorted queue (`SUPER URGENT` oldest first -> `URGENT` oldest first -> `REGULAR` oldest first), one-click "Default Filter", mark as complete, reject with required reason dialog.

3. **Critical High-Priority Capacity Control:**
   - **SUPER URGENT:** Max 1 active unfinished request per Designer.
   - **URGENT:** Max 2 active unfinished requests per Designer.
   - **REGULAR:** Unlimited.
   - Incomplete active status: `PENDING`. (Rejected requests waiting for sales correction do not consume capacity).
   - Atomic Firestore transactions prevent concurrent bypass.

4. **Sequential Unique Request IDs:**
   - Format: `M000001`, `M000002`, `M000003`...
   - Atomically generated from `counters/mockupRequests`.
   - Never reused, even upon soft deletion.

5. **Dynamic Request Forms by Source:**
   - **Gallabox:** Shows ONLY Client Name, Client Mobile Number, Notes / Instructions, Priority, Attachments.
   - **WhatsApp / Email / Others:** Full standard fields (Mockup Title, Item, Client Name, Mobile, Contact By, Notes, Links, Attachments, Priority).

6. **Reporting & PDF Generation:**
   - Comprehensive multi-filter reporting (Date presets, Custom range, Sales Rep, Designer, Status, Priority, Source, Search).
   - Official multi-page corporate PDF export with repeated headers, summary KPIs, and official Merchlist branding.

7. **Zero Demo Data:**
   - Database starts completely clean with zero sample users, placeholder records, or fake statistics.
   - No "e.g." text anywhere in the application.

---

## Vercel & Firebase Deployment Guide

### 1. Firebase Project Setup
1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** in production mode.
3. Enable **Authentication** -> **Email/Password** provider (used internally for 9-digit Login ID mapping).
4. Enable **Firebase Storage** for mockup attachments.

### 2. Deploy Security Rules & Indexes
Deploy `firestore.rules` and `firestore.indexes.json`:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 3. Environment Variables & Client Config
Ensure `firebase-applet-config.json` (or `VITE_FIREBASE_*` environment variables) is present:
- `projectId`
- `appId`
- `apiKey`
- `authDomain`
- `firestoreDatabaseId`
- `storageBucket`
- `messagingSenderId`

### 4. Vercel Deployment
1. Connect your repository to [Vercel](https://vercel.com).
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. The included `vercel.json` ensures full SPA routing for client-side navigation.

### 5. Initial Admin Account Activation
1. Navigate to the deployed application URL.
2. The system detects that the initial Admin (`564302533`) is not yet initialized.
3. Click **"First Time? Set Up Initial Admin Account"**.
4. Enter the desired secure password (min 6 characters) and submit.
5. Log in with Login ID `564302533` to access the Admin dashboard and create additional users.
