/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, MockupRequest, AppNotification, CompanySettings, UserRole } from './types';
import { fetchCompanySettings, DEFAULT_COMPANY_SETTINGS } from './services/settingsService';
import { fetchAllUsers, logoutUser, SESSION_STORAGE_KEY } from './services/authService';
import { subscribeToUserNotifications } from './services/notificationService';
import { LoginView } from './components/auth/LoginView';
import { Sidebar } from './components/navigation/Sidebar';
import { TopBar } from './components/navigation/TopBar';
import { SalesDashboard } from './components/dashboard/SalesDashboard';
import { DesignerDashboard } from './components/dashboard/DesignerDashboard';
import { HeadOfSalesDashboard } from './components/dashboard/HeadOfSalesDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { NewMockupModal } from './components/requests/NewMockupModal';
import { NewMockupView } from './components/requests/NewMockupView';
import { RequestDetailsModal } from './components/requests/RequestDetailsModal';
import { RevisionModal } from './components/requests/RevisionModal';
import { RequestList } from './components/requests/RequestList';
import { UserManagementView } from './components/admin/UserManagementView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { CompanySettingsView } from './components/admin/CompanySettingsView';
import { UserProfileView } from './components/profile/UserProfileView';
import { NotificationPanel } from './components/notifications/NotificationPanel';
import { MerchlistLogo } from './components/brand/MerchlistLogo';
import { completeMockupRequest } from './services/requestService';
import { Plus } from 'lucide-react';

export default function App() {
  // Persistent session: Initialize directly from device storage so the user is never logged out automatically
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed && parsed.userId && parsed.role && parsed.loginId) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed && parsed.userId && parsed.role && parsed.loginId) {
          return false;
        }
      }
    } catch {}
    return true;
  });

  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Business records (strictly real data from Firestore)
  const [requests, setRequests] = useState<MockupRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Modals & Drawers
  const [selectedRequest, setSelectedRequest] = useState<MockupRequest | null>(null);
  const [revisionModalRequest, setRevisionModalRequest] = useState<MockupRequest | null>(null);
  const [openRevisionOnDetails, setOpenRevisionOnDetails] = useState(false);
  const [isNewMockupOpen, setIsNewMockupOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Synchronize document title with configured official app name
  useEffect(() => {
    document.title = settings.applicationName || 'Marchlist Mockup Request';
  }, [settings.applicationName]);

  // Load Global Company Settings
  useEffect(() => {
    fetchCompanySettings().then((res) => {
      setSettings(res);
    });
  }, []);

  // Multi-tab synchronization: keep login state synced across tabs on the device
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_STORAGE_KEY) {
        if (!e.newValue) {
          // Explicit logout in another tab
          setCurrentUser(null);
        } else {
          try {
            const updated = JSON.parse(e.newValue) as UserProfile;
            if (updated && updated.userId) {
              setCurrentUser(updated);
            }
          } catch {}
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen to Auth State and validate active session in background without disrupting logged-in state
  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      // 1. Check local session storage
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        let parsed: UserProfile | null = null;
        try {
          parsed = JSON.parse(savedSession) as UserProfile;
        } catch {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }

        if (parsed && parsed.userId) {
          if (!isCancelled) {
            setCurrentUser((prev) => prev || parsed);
            setIsAuthLoading(false);
          }

          // Background verification: check if an admin explicitly disabled or deleted this user account
          try {
            const userSnap = await getDoc(doc(db, 'users', parsed.userId));
            if (userSnap.exists()) {
              const freshProfile = userSnap.data() as UserProfile;
              // ONLY log out if the account was explicitly deactivated or deleted by an administrator
              if (freshProfile.active === false || freshProfile.deleted === true) {
                await logoutUser();
                if (!isCancelled) {
                  setCurrentUser(null);
                  setIsAuthLoading(false);
                }
                return;
              } else {
                // Keep local session updated with fresh profile data (e.g., role updates, name changes)
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(freshProfile));
                }
                if (!isCancelled) {
                  setCurrentUser(freshProfile);
                }
              }
            }
          } catch (err) {
            // CRITICAL: Network errors, offline state, or latency MUST NOT log out the user!
            console.warn('Background profile sync deferred (offline/network latency):', err);
          }
        }
      }

      // 2. Also listen to Firebase Auth state if signed in via Auth
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
            if (userDoc.exists()) {
              const profile = userDoc.data() as UserProfile;
              if (profile.active === false || profile.deleted === true) {
                await logoutUser();
                if (!isCancelled) setCurrentUser(null);
              } else {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
                }
                if (!isCancelled) setCurrentUser(profile);
              }
            }
          } catch {
            // Network or transient error - do not disrupt existing session
          }
        }
        if (!isCancelled) setIsAuthLoading(false);
      });

      if (!isCancelled) setIsAuthLoading(false);

      return () => {
        unsubscribe();
      };
    };

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Load and Listen to Requests according to RBAC
  useEffect(() => {
    if (!currentUser) {
      setRequests([]);
      return;
    }

    let q = query(collection(db, 'mockupRequests'));

    // Data Isolation by Role (Single equality condition to prevent composite index errors):
    if (currentUser.role === 'SALES_REPRESENTATIVE') {
      q = query(
        collection(db, 'mockupRequests'),
        where('salesRepresentativeId', '==', currentUser.userId)
      );
    } else if (currentUser.role === 'DESIGNER') {
      q = query(
        collection(db, 'mockupRequests'),
        where('designerId', '==', currentUser.userId)
      );
    }

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Filter out deleted items in memory (compatible with all legacy documents)
        const reqList = snapshot.docs
          .map((d) => d.data() as MockupRequest)
          .filter((r) => r && !r.deleted);
        // Sort descending by created date
        reqList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRequests(reqList);

        // Update selected request if currently open in modal
        if (selectedRequest) {
          const updated = reqList.find((r) => r.id === selectedRequest.id);
          if (updated) setSelectedRequest(updated);
        }
      },
      (error) => {
        console.error('Firestore listener error:', error);
      }
    );

    return () => unsub();
  }, [currentUser?.userId, currentUser?.role]);

  // Load User Directory for Admin & Head of Sales (or designer assignment lookup)
  const refreshUsersList = async () => {
    if (!currentUser) return;
    const users = await fetchAllUsers();
    setAllUsers(users);

    // Keep currentUser's assigned designer refreshed if admin changed it
    if (currentUser.role === 'SALES_REPRESENTATIVE') {
      const refreshedMe = users.find((u) => u.userId === currentUser.userId);
      if (refreshedMe) setCurrentUser(refreshedMe);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshUsersList();
    }
  }, [currentUser?.userId]);

  // Real-time In-App Notifications for Current User
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeToUserNotifications(currentUser.userId, (list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, [currentUser?.userId]);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0c192c] flex flex-col items-center justify-center text-white px-4">
        <div className="bg-white px-6 py-5 rounded-2xl shadow-xl flex flex-col items-center gap-3">
          <img
            src="/IMG_8904.png"
            alt="Merchlist Icon"
            className="w-14 h-14 object-contain select-none"
            referrerPolicy="no-referrer"
          />
          <img
            src="/IMG_8905.png"
            alt="Merchlist"
            className="h-6 w-auto object-contain select-none"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="mt-8 flex items-center gap-2 text-cyan-400 text-xs font-semibold tracking-wider uppercase">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          Initializing Secure Session...
        </div>
      </div>
    );
  }

  // Login Screen if not authenticated
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentTab('dashboard');
        }}
        customLogoUrl={settings.logo}
        applicationName={settings.applicationName}
      />
    );
  }

  const handleOpenRevisionModal = (req: MockupRequest) => {
    setRevisionModalRequest(req);
  };

  const handleCompleteRequest = async (req: MockupRequest) => {
    if (!currentUser) return;
    try {
      await completeMockupRequest({
        request: req,
        designerId: currentUser.userId,
        designerName: currentUser.name,
        timezone: settings.timezone,
      });
    } catch (err) {
      console.error('Failed to complete request:', err);
    }
  };

  // Main App Content Renderer based on selectedTab and user role
  const renderMainContent = () => {
    // 1. Dashboard Tab
    if (currentTab === 'dashboard') {
      switch (currentUser.role) {
        case 'ADMIN':
          return (
            <AdminDashboard
              currentUser={currentUser}
              requests={requests}
              allUsers={allUsers}
              timezone={settings.timezone}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onSelectRequest={(req) => setSelectedRequest(req)}
              onOpenRevisionRequest={handleOpenRevisionModal}
            />
          );
        case 'HEAD_OF_SALES':
          return (
            <HeadOfSalesDashboard
              currentUser={currentUser}
              requests={requests}
              allUsers={allUsers}
              timezone={settings.timezone}
              onSelectRequest={(req) => setSelectedRequest(req)}
              onOpenRevisionRequest={handleOpenRevisionModal}
            />
          );
        case 'SALES_REPRESENTATIVE':
          return (
            <SalesDashboard
              currentUser={currentUser}
              requests={requests}
              timezone={settings.timezone}
              onOpenNewModal={() => setIsNewMockupOpen(true)}
              onSelectRequest={(req) => setSelectedRequest(req)}
              onOpenRevisionRequest={handleOpenRevisionModal}
            />
          );
        case 'DESIGNER':
          return (
            <DesignerDashboard
              currentUser={currentUser}
              requests={requests}
              timezone={settings.timezone}
              onSelectRequest={(req) => setSelectedRequest(req)}
              onCompleteRequest={handleCompleteRequest}
              onOpenRevisionRequest={handleOpenRevisionModal}
            />
          );
      }
    }

    // 2. Dedicated New Mockup Request Page
    if (currentTab === 'new_mockup') {
      return (
        <NewMockupView
          currentUser={currentUser}
          allUsers={allUsers}
          timezone={settings.timezone}
          onComplete={() => {
            setCurrentTab(currentUser.role === 'SALES_REPRESENTATIVE' ? 'my_requests' : 'mockup_requests');
          }}
          onCancel={() => setCurrentTab('dashboard')}
        />
      );
    }

    // 3. User Management Tabs (Admin Only)
    if (currentUser.role === 'ADMIN') {
      if (currentTab === 'users') {
        return (
          <UserManagementView
            currentUser={currentUser}
            users={allUsers}
            timezone={settings.timezone}
            onRefreshUsers={refreshUsersList}
          />
        );
      }
      if (currentTab === 'sales_reps') {
        return (
          <UserManagementView
            currentUser={currentUser}
            users={allUsers}
            timezone={settings.timezone}
            onRefreshUsers={refreshUsersList}
            roleFilter="SALES_REPRESENTATIVE"
          />
        );
      }
      if (currentTab === 'designers') {
        return (
          <UserManagementView
            currentUser={currentUser}
            users={allUsers}
            timezone={settings.timezone}
            onRefreshUsers={refreshUsersList}
            roleFilter="DESIGNER"
          />
        );
      }
      if (currentTab === 'head_of_sales') {
        return (
          <UserManagementView
            currentUser={currentUser}
            users={allUsers}
            timezone={settings.timezone}
            onRefreshUsers={refreshUsersList}
            roleFilter="HEAD_OF_SALES"
          />
        );
      }
      if (currentTab === 'audit_logs') {
        return <AuditLogsView timezone={settings.timezone} />;
      }
      if (currentTab === 'company_settings') {
        return (
          <CompanySettingsView
            currentUser={currentUser}
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings(newSettings)}
          />
        );
      }
    }

    // 4. Head of Sales Specific Tabs
    if (currentUser.role === 'HEAD_OF_SALES') {
      if (currentTab === 'sales_team' || currentTab === 'design_team') {
        return (
          <HeadOfSalesDashboard
            currentUser={currentUser}
            requests={requests}
            allUsers={allUsers}
            timezone={settings.timezone}
            onSelectRequest={(req) => setSelectedRequest(req)}
          />
        );
      }
    }

    // 5. Filtered Request Views
    if (
      currentTab === 'my_requests' ||
      currentTab === 'all_requests' ||
      currentTab === 'mockup_requests' ||
      currentTab === 'mockup_request'
    ) {
      return (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">Mockup Requests</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage and track client specifications, design status, and revision history.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                Total: {requests.length}
              </span>
              {(currentUser.role === 'SALES_REPRESENTATIVE' || currentUser.role === 'ADMIN' || currentUser.role === 'HEAD_OF_SALES') && (
                <button
                  type="button"
                  onClick={() => setIsNewMockupOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>New Mockup Request</span>
                </button>
              )}
            </div>
          </div>
          <RequestList
            requests={requests}
            currentUser={currentUser}
            timezone={settings.timezone}
            onSelectRequest={(req) => setSelectedRequest(req)}
            onOpenRevisionRequest={handleOpenRevisionModal}
            onCompleteRequest={handleCompleteRequest}
          />
        </div>
      );
    }

    if (currentTab === 'pending' || currentTab === 'pending_requests') {
      const pendingList = requests.filter((r) => r.status === 'PENDING');
      return (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">Pending Requests</h2>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
              {pendingList.length} Incomplete
            </span>
          </div>
          <RequestList
            requests={pendingList}
            currentUser={currentUser}
            timezone={settings.timezone}
            onSelectRequest={(req) => setSelectedRequest(req)}
            onOpenRevisionRequest={handleOpenRevisionModal}
            onCompleteRequest={handleCompleteRequest}
            emptyTitle="No pending requests."
          />
        </div>
      );
    }

    if (currentTab === 'rejected') {
      const rejectedList = requests.filter((r) => r.status === 'REJECTED');
      return (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">Rejected Requests</h2>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
              {rejectedList.length} Need Attention
            </span>
          </div>
          <RequestList
            requests={rejectedList}
            currentUser={currentUser}
            timezone={settings.timezone}
            onSelectRequest={(req) => setSelectedRequest(req)}
            onOpenRevisionRequest={handleOpenRevisionModal}
            onCompleteRequest={handleCompleteRequest}
            emptyTitle="No rejected requests."
          />
        </div>
      );
    }

    if (currentTab === 'completed') {
      const completedList = requests.filter((r) => r.status === 'COMPLETED');
      return (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">Completed Requests</h2>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              {completedList.length} Finished
            </span>
          </div>
          <RequestList
            requests={completedList}
            currentUser={currentUser}
            timezone={settings.timezone}
            onSelectRequest={(req) => setSelectedRequest(req)}
            onOpenRevisionRequest={handleOpenRevisionModal}
            onCompleteRequest={handleCompleteRequest}
            emptyTitle="No completed requests."
          />
        </div>
      );
    }

    // 6. Reports Tab
    if (currentTab === 'reports') {
      return (
        <ReportsView
          currentUser={currentUser}
          requests={requests}
          allUsers={allUsers}
          timezone={settings.timezone}
          onSelectRequest={(req) => setSelectedRequest(req)}
          companyName={settings.companyName}
          applicationName={settings.applicationName}
        />
      );
    }

    // 7. Profile Tab
    if (currentTab === 'profile') {
      return (
        <UserProfileView
          currentUser={currentUser}
          timezone={settings.timezone}
          onUserUpdated={(updated) => {
            setCurrentUser(updated);
            refreshUsersList();
          }}
        />
      );
    }

    // 8. Notifications Tab
    if (currentTab === 'notifications') {
      setIsNotificationsOpen(true);
      setCurrentTab('dashboard');
      return null;
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentUser={currentUser}
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onLogout={handleLogout}
        unreadCount={unreadNotificationCount}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        customLogoUrl={settings.logo}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <TopBar
          currentUser={currentUser}
          applicationName={settings.applicationName}
          onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenProfile={() => setCurrentTab('profile')}
          unreadCount={unreadNotificationCount}
          assignedDesignerName={currentUser.assignedDesignerName}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {renderMainContent()}
        </main>
      </div>

      {/* New Mockup Modal (Opens from quick action buttons) */}
      <NewMockupModal
        currentUser={currentUser}
        allUsers={allUsers}
        timezone={settings.timezone}
        isOpen={isNewMockupOpen}
        onClose={() => setIsNewMockupOpen(false)}
        onSuccess={() => {
          setIsNewMockupOpen(false);
        }}
      />

      {/* Request Details & Action Modal */}
      <RequestDetailsModal
        request={selectedRequest}
        currentUser={currentUser}
        timezone={settings.timezone}
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onUpdate={() => {
          // Handled via onSnapshot
        }}
      />

      {/* Revision Request Modal (Single Changes Details Input Box) */}
      <RevisionModal
        request={revisionModalRequest}
        currentUser={currentUser}
        timezone={settings.timezone}
        isOpen={!!revisionModalRequest}
        onClose={() => setRevisionModalRequest(null)}
      />

      {/* In-App Notifications Drawer */}
      <NotificationPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        userId={currentUser.userId}
        timezone={settings.timezone}
        onSelectRequestId={(reqId) => {
          const req = requests.find((r) => r.requestId === reqId || r.id === reqId);
          if (req) setSelectedRequest(req);
        }}
      />
    </div>
  );
}
