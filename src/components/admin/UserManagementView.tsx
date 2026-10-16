import React, { useState, useMemo } from 'react';
import { UserProfile, UserRole } from '../../types';
import {
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  adminResetUserPassword,
  INITIAL_ADMIN_DEFAULT_PASSWORD,
  INITIAL_ADMIN_LOGIN_ID,
} from '../../services/authService';
import { formatDateInTimezone } from '../../utils/dateUtils';
import { RoleBadge } from '../common/Badges';
import {
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Lock,
  X,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  User,
  Camera,
} from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { UserProfileModal } from '../profile/UserProfileModal';

interface UserManagementViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  timezone?: string;
  onRefreshUsers: () => void;
  roleFilter?: UserRole;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  users,
  timezone,
  onRefreshUsers,
  roleFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ALL' | UserRole>(roleFilter || 'ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password visibility & reset states
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formLoginId, setFormLoginId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('SALES_REPRESENTATIVE');
  const [formActive, setFormActive] = useState(true);
  const [formAssignedDesignerId, setFormAssignedDesignerId] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available Designers for assignment dropdown
  const designers = useMemo(() => {
    return users.filter((u) => u.role === 'DESIGNER' && u.active && !u.deleted);
  }, [users]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.deleted) return false;
      if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = u.name.toLowerCase().includes(query);
        const matchId = u.loginId.includes(query);
        return matchName || matchId;
      }
      return true;
    });
  }, [users, selectedRole, searchQuery]);

  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleOpenAdd = () => {
    setErrorMessage(null);
    setFormName('');
    setFormLoginId('');
    setFormPassword('');
    setFormRole(roleFilter || 'SALES_REPRESENTATIVE');
    setFormActive(true);
    setFormAssignedDesignerId(designers[0]?.userId || '');
    setFormAvatarUrl(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setErrorMessage(null);
    setEditingUser(user);
    setFormName(user.name);
    setFormLoginId(user.loginId);
    setFormPassword(user.password || (user.loginId === INITIAL_ADMIN_LOGIN_ID ? INITIAL_ADMIN_DEFAULT_PASSWORD : ''));
    setFormRole(user.role);
    setFormActive(user.active);
    setFormAssignedDesignerId(user.assignedDesignerId || '');
    setFormAvatarUrl(user.avatarUrl || null);
  };

  const handleOpenResetPassword = (user: UserProfile) => {
    setErrorMessage(null);
    setResettingUser(user);
    setResetPasswordInput('');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Edit existing user
        const assignedDes = designers.find((d) => d.userId === formAssignedDesignerId);
        await updateSystemUser(currentUser, editingUser.userId, {
          name: formName.trim(),
          role: formRole,
          active: formActive,
          avatarUrl: formAvatarUrl,
          assignedDesignerId: formRole === 'SALES_REPRESENTATIVE' ? formAssignedDesignerId : undefined,
          assignedDesignerName: formRole === 'SALES_REPRESENTATIVE' ? assignedDes?.name : undefined,
          ...(formPassword && formPassword.length >= 6 ? { password: formPassword } : {}),
        });
        setSuccessMessage(`User ${formName} updated successfully.`);
        setEditingUser(null);
      } else {
        // Create new user
        const assignedDes = designers.find((d) => d.userId === formAssignedDesignerId);
        await createSystemUser(currentUser, {
          name: formName.trim(),
          loginId: formLoginId.trim(),
          password: formPassword,
          role: formRole,
          active: formActive,
          avatarUrl: formAvatarUrl,
          assignedDesignerId: formRole === 'SALES_REPRESENTATIVE' ? formAssignedDesignerId : undefined,
          assignedDesignerName: formRole === 'SALES_REPRESENTATIVE' ? assignedDes?.name : undefined,
        });
        setSuccessMessage(`User ${formName} created successfully.`);
        setShowAddModal(false);
      }
      onRefreshUsers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (resetPasswordInput.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    setIsResettingPassword(true);
    setErrorMessage(null);
    try {
      await adminResetUserPassword(currentUser, resettingUser.userId, resetPasswordInput);
      setSuccessMessage(`Password for ${resettingUser.name} (${resettingUser.loginId}) successfully changed to "${resetPasswordInput}".`);
      setResettingUser(null);
      setResetPasswordInput('');
      onRefreshUsers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    setErrorMessage(null);
    try {
      await updateSystemUser(currentUser, user.userId, {
        active: !user.active,
      });
      setSuccessMessage(`User ${user.name} is now ${!user.active ? 'active' : 'disabled'}.`);
      onRefreshUsers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update user status.');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!confirm(`Are you sure you want to delete user ${user.name}? This will disable the account while preserving all historical requests.`)) {
      return;
    }
    setErrorMessage(null);
    try {
      await deleteSystemUser(currentUser, user.userId);
      setSuccessMessage(`User ${user.name} deleted successfully.`);
      onRefreshUsers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">User Management & Security</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage company personnel, 9-digit Login IDs, role privileges, passwords, and designer assignments.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search & Filters & Password Visibility Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name or 9-digit ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Show / Hide All Passwords Toggle */}
          <button
            type="button"
            onClick={() => setShowAllPasswords(!showAllPasswords)}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showAllPasswords
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {showAllPasswords ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
            <span>{showAllPasswords ? 'Hide Passwords' : 'View All Passwords'}</span>
          </button>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
            >
              <option value="ALL">All Roles</option>
              <option value="SALES_REPRESENTATIVE">Sales Representatives</option>
              <option value="DESIGNER">Designers</option>
              <option value="HEAD_OF_SALES">Head of Sales</option>
              <option value="ADMIN">Administrators</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Login ID</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Assigned Designer</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Password</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => {
              const isVisible = showAllPasswords || revealedPasswords[user.userId];
              const rawPass = user.loginId === INITIAL_ADMIN_LOGIN_ID
                ? INITIAL_ADMIN_DEFAULT_PASSWORD
                : (user.password || '••••••');

              return (
                <tr key={user.userId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={user.name}
                        avatarUrl={user.avatarUrl}
                        role={user.role}
                        size="md"
                        onClick={() => setSelectedUserProfile(user)}
                        className="cursor-pointer hover:ring-2 hover:ring-cyan-500 transition-all"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUserProfile(user)}
                            className="font-semibold text-slate-900 hover:text-cyan-700 transition-colors cursor-pointer text-left"
                            title="Click to view full profile"
                          >
                            {user.name}
                          </button>
                          {user.loginId === INITIAL_ADMIN_LOGIN_ID && (
                            <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded">
                              Master Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-700 tracking-wider">
                    {user.loginId}
                  </td>
                  <td className="py-3 px-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="py-3 px-4 text-cyan-800 font-medium">
                    {user.role === 'SALES_REPRESENTATIVE'
                      ? user.assignedDesignerName || (
                          <span className="text-rose-500 font-semibold">Missing Designer</span>
                        )
                      : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {user.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        Disabled
                      </span>
                    )}
                  </td>
                  {/* Password Column with Reveal Toggle */}
                  <td className="py-3 px-4 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded font-bold tracking-wider select-all transition-colors ${
                          isVisible
                            ? 'bg-amber-100 text-amber-950 border border-amber-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isVisible ? rawPass : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRevealPassword(user.userId)}
                        title={isVisible ? 'Hide password' : 'View password'}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {formatDateInTimezone(user.lastActivityAt, timezone, true)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Full Profile */}
                      <button
                        onClick={() => setSelectedUserProfile(user)}
                        title="View Full Profile with Picture"
                        className="p-1.5 rounded text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5" />
                      </button>
                      {/* Reset / Set Password Button */}
                      <button
                        onClick={() => handleOpenResetPassword(user)}
                        title="Reset / Set New Password"
                        className="p-1.5 rounded text-cyan-700 hover:text-cyan-900 hover:bg-cyan-50 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(user)}
                        title="Edit User"
                        className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user.loginId !== INITIAL_ADMIN_LOGIN_ID && (
                        <>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            title={user.active ? 'Disable User' : 'Enable User'}
                            className={`p-1.5 rounded transition-colors cursor-pointer ${
                              user.active
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {user.active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            title="Delete User"
                            className="p-1.5 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Reset Password */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-50 text-cyan-800">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset User Password</h3>
                  <p className="text-[11px] text-slate-500">
                    {resettingUser.name} &bull; ID: <span className="font-mono font-semibold">{resettingUser.loginId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setResettingUser(null);
                  setResetPasswordInput('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Current Password:</span>
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {resettingUser.loginId === INITIAL_ADMIN_LOGIN_ID
                    ? INITIAL_ADMIN_DEFAULT_PASSWORD
                    : (resettingUser.password || 'Not Set')}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Enter at least 6 characters"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setResettingUser(null);
                    setResetPasswordInput('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-2 rounded-lg bg-[#0c192c] text-white font-semibold hover:bg-slate-800 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isResettingPassword ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit User */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUser ? 'Edit User Profile' : 'Add New User'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Login ID (9 Digits) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={9}
                  inputMode="numeric"
                  value={formLoginId}
                  disabled={!!editingUser}
                  onChange={(e) => setFormLoginId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono tracking-wider text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must be exactly 9 numeric digits</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {editingUser ? 'Password (Leave blank to keep existing)' : 'Initial Password'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required={!editingUser}
                  placeholder={editingUser ? 'Keep existing password' : 'Enter at least 6 characters'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
                >
                  <option value="SALES_REPRESENTATIVE">Sales Representative</option>
                  <option value="DESIGNER">Designer</option>
                  <option value="HEAD_OF_SALES">Head of Sales</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>

              {/* Assigned Designer if Sales Rep */}
              {formRole === 'SALES_REPRESENTATIVE' && (
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Assigned Designer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formAssignedDesignerId}
                    onChange={(e) => setFormAssignedDesignerId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
                  >
                    <option value="">-- Select Assigned Designer --</option>
                    {designers.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {d.name} (ID: {d.loginId})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    New requests created by this Sales Rep will automatically route to this Designer. Historical assignments will be preserved.
                  </p>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded border-slate-300 text-[#0c192c] focus:ring-[#0c192c]"
                  />
                  <span className="font-semibold text-slate-800">Account Active</span>
                </label>
              </div>

              {/* Profile Picture Option in Admin Modal */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-800 mb-2">Profile Picture (Optional)</label>
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={formName || 'User'}
                    avatarUrl={formAvatarUrl}
                    role={formRole}
                    size="lg"
                  />
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer text-xs inline-flex items-center gap-1.5 shadow-2xs">
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formAvatarUrl ? 'Change Image' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const img = new Image();
                            img.src = ev.target?.result as string;
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const maxDim = 320;
                              let w = img.width;
                              let h = img.height;
                              if (w > h) {
                                if (w > maxDim) {
                                  h = Math.round((h * maxDim) / w);
                                  w = maxDim;
                                }
                              } else {
                                if (h > maxDim) {
                                  w = Math.round((w * maxDim) / h);
                                  h = maxDim;
                                }
                              }
                              canvas.width = w;
                              canvas.height = h;
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.drawImage(img, 0, 0, w, h);
                                setFormAvatarUrl(canvas.toDataURL('image/jpeg', 0.85));
                              }
                            };
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {formAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setFormAvatarUrl(null)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#0c192c] text-white font-semibold hover:bg-slate-800 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Full User Profile with Picture */}
      <UserProfileModal
        user={selectedUserProfile}
        isOpen={!!selectedUserProfile}
        onClose={() => setSelectedUserProfile(null)}
        timezone={timezone}
        allUsers={users}
      />
    </div>
  );
};
