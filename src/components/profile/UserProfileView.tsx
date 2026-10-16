import React, { useState, useRef } from 'react';
import { UserProfile } from '../../types';
import { RoleBadge } from '../common/Badges';
import { UserAvatar } from '../common/UserAvatar';
import { formatDateInTimezone } from '../../utils/dateUtils';
import { changeUserPassword, updateUserProfilePicture } from '../../services/authService';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Palette,
  Lock,
  Camera,
  Trash2,
  Upload,
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

interface UserProfileViewProps {
  currentUser: UserProfile;
  timezone?: string;
  onUserUpdated?: (updatedUser: UserProfile) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  timezone,
  onUserUpdated,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Profile Picture states
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminUser = currentUser.role === 'ADMIN' || currentUser.loginId === '564302533';

  // Helper function to resize and compress image to high-efficiency base64
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const maxDim = 360;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoMessage({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WebP).' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoMessage({ type: 'error', text: 'Image file size must be under 10MB.' });
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoMessage(null);
    try {
      const compressedDataUrl = await compressImage(file);
      const updatedUser = await updateUserProfilePicture(currentUser, compressedDataUrl);
      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }
      setPhotoMessage({
        type: 'success',
        text: 'Profile picture updated successfully! It is now visible to all users.',
      });
      // reset input value so re-selecting same file triggers change
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      setPhotoMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile picture.',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveUrlPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPhotoUrl.trim()) return;

    setIsUploadingPhoto(true);
    setPhotoMessage(null);
    try {
      const updatedUser = await updateUserProfilePicture(currentUser, customPhotoUrl.trim());
      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }
      setPhotoMessage({
        type: 'success',
        text: 'Profile picture updated successfully! It is now visible to all users.',
      });
      setShowUrlInput(false);
      setCustomPhotoUrl('');
    } catch (err: unknown) {
      setPhotoMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile picture.',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) return;
    setIsUploadingPhoto(true);
    setPhotoMessage(null);
    try {
      const updatedUser = await updateUserProfilePicture(currentUser, null);
      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }
      setPhotoMessage({
        type: 'success',
        text: 'Profile picture removed successfully.',
      });
    } catch (err: unknown) {
      setPhotoMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove profile picture.',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (isAdminUser) {
      setPasswordMessage({
        type: 'error',
        text: 'Master Administrator credentials cannot be changed from this view.',
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: 'error',
        text: 'New password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changeUserPassword(currentUser, newPassword);
      setPasswordMessage({
        type: 'success',
        text: 'Your password has been changed successfully. It has been updated in the system.',
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">User Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          View your account parameters, 9-digit Login ID, profile picture, and security credentials.
        </p>
      </div>

      {/* Account Info Card & Profile Picture Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 text-xs">
        {/* Profile Picture & User Identity Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            {/* Avatar with Camera Overlay */}
            <div className="relative group flex-shrink-0">
              <div className="ring-2 ring-slate-200 ring-offset-2 rounded-full overflow-hidden shadow-sm">
                <UserAvatar
                  name={currentUser.name}
                  avatarUrl={currentUser.avatarUrl}
                  role={currentUser.role}
                  size="2xl"
                />
              </div>

              {/* Upload trigger button on avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                title="Change Profile Picture"
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#0c192c] text-white hover:bg-cyan-700 transition-colors shadow-md border-2 border-white cursor-pointer"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">{currentUser.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <RoleBadge role={currentUser.role} />
                <span className="text-slate-300 hidden sm:inline">&bull;</span>
                <span className="font-mono text-slate-600 font-semibold tracking-wider">
                  ID: {currentUser.loginId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {currentUser.avatarUrl
                  ? 'Custom profile picture active & visible to all team members'
                  : 'Initial avatar displayed (Upload a photo to set your picture)'}
              </p>
            </div>
          </div>

          {/* Profile Picture Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="px-3.5 py-2 rounded-xl bg-[#0c192c] text-white hover:bg-slate-800 transition-colors font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isUploadingPhoto ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{currentUser.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
            </button>

            {currentUser.avatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isUploadingPhoto}
                className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Remove current photo"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden xs:inline">Remove</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Set photo via image URL"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* URL Photo input dropdown */}
        {showUrlInput && (
          <form
            onSubmit={handleSaveUrlPhoto}
            className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 animate-in fade-in"
          >
            <label className="block text-[11px] font-semibold text-slate-700">
              Paste Image URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={customPhotoUrl}
                onChange={(e) => setCustomPhotoUrl(e.target.value)}
                placeholder="https://example.com/my-photo.jpg"
                required
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-900"
              />
              <button
                type="submit"
                disabled={isUploadingPhoto}
                className="px-4 py-2 rounded-lg bg-[#0c192c] text-white font-semibold hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Photo Status Feedback */}
        {photoMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
              photoMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {photoMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <span>{photoMessage.text}</span>
          </div>
        )}

        {/* Account Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold block uppercase text-[10px]">
              Full Name
            </span>
            <span className="text-slate-900 font-bold text-sm mt-0.5 block">{currentUser.name}</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold block uppercase text-[10px]">
              9-Digit Login ID
            </span>
            <span className="font-mono text-slate-900 font-bold text-sm mt-0.5 block">
              {currentUser.loginId}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold block uppercase text-[10px]">
              Account Role
            </span>
            <span className="text-slate-900 font-bold text-sm mt-0.5 block">
              {currentUser.role.replace(/_/g, ' ')}
            </span>
          </div>

          {currentUser.role === 'SALES_REPRESENTATIVE' && (
            <div className="p-3.5 bg-cyan-50/70 border border-cyan-200/80 rounded-xl">
              <span className="text-cyan-800 font-semibold block uppercase text-[10px]">
                Assigned Designer
              </span>
              <span className="text-slate-900 font-bold text-sm mt-0.5 block">
                {currentUser.assignedDesignerName || 'No Designer Assigned'}
              </span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold block uppercase text-[10px]">
              Account Status
            </span>
            <span className="text-emerald-700 font-bold text-sm mt-0.5 block">
              {currentUser.active ? 'Active & Authorized' : 'Disabled'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-semibold block uppercase text-[10px]">
              Member Since
            </span>
            <span className="text-slate-900 font-medium text-sm mt-0.5 block">
              {formatDateInTimezone(currentUser.createdAt, timezone, false)}
            </span>
          </div>
        </div>
      </div>

      {/* Password Change Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <KeyRound className="w-4 h-4 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-sm">Security & Password Update</h3>
        </div>

        {passwordMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
              passwordMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {passwordMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <span>{passwordMessage.text}</span>
          </div>
        )}

        {isAdminUser ? (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
            <Lock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Master Administrator Credentials Protected</p>
              <p className="mt-1 text-slate-500 leading-relaxed">
                The Master Administrator account (Login ID:{' '}
                <span className="font-mono font-bold text-slate-700">564302533</span>) is secured and
                configured as the root administrator. Non-admin team members (Sales Representatives,
                Designers, Head of Sales) can update their passwords from their accounts, and
                administrators can monitor or reset credentials from the User Directory.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter at least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-type your new password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="px-4 py-2.5 rounded-xl bg-[#0c192c] text-white font-semibold hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isUpdatingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
