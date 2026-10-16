import React, { useState, useEffect } from 'react';
import { MerchlistLogo } from '../brand/MerchlistLogo';
import { PRIMARY_APP_ICON_DATA_URL, WORDMARK_LOGO_DATA_URL } from '../brand/logoData';
import {
  loginWithLoginId,
  checkInitialAdminStatus,
  bootstrapInitialAdmin,
  INITIAL_ADMIN_LOGIN_ID,
  isValidLoginId,
} from '../../services/authService';
import { UserProfile } from '../../types';
import { ShieldCheck, Lock, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
  customLogoUrl?: string | null;
  applicationName?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  customLogoUrl,
  applicationName = 'Marchlist Mockup Request',
}) => {
  const [loginId, setLoginId] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('marchlist_remember_login_id') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Initial Admin Bootstrap State
  const [canBootstrapAdmin, setCanBootstrapAdmin] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [adminInitialPassword, setAdminInitialPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [bootstrapSuccessMessage, setBootstrapSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    checkInitialAdminStatus().then((status) => {
      setCanBootstrapAdmin(status.canBootstrap);
    });
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedLoginId = loginId.trim();

    // Strict validation
    if (!trimmedLoginId) {
      setErrorMessage('Please enter your 9-digit Login ID.');
      return;
    }

    if (!isValidLoginId(trimmedLoginId)) {
      setErrorMessage('Login ID must contain exactly 9 digits.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithLoginId(trimmedLoginId, password);
      if (rememberMe) {
        localStorage.setItem('marchlist_remember_login_id', trimmedLoginId);
      } else {
        localStorage.removeItem('marchlist_remember_login_id');
      }
      onLoginSuccess(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (adminInitialPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (adminInitialPassword !== adminConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const adminUser = await bootstrapInitialAdmin(adminInitialPassword);
      setCanBootstrapAdmin(false);
      setIsBootstrapping(false);
      setBootstrapSuccessMessage('Admin account successfully initialized. Logging you in...');
      setTimeout(() => {
        onLoginSuccess(adminUser);
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#f8fafc] px-4 py-8">
      {/* Container Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Header Section with Official Logos */}
        <div className="bg-white pt-8 pb-6 px-8 text-center flex flex-col items-center border-b border-slate-100">
          <div className="mb-3">
            <img
              src={PRIMARY_APP_ICON_DATA_URL || '/IMG_8904.png'}
              alt="Merchlist Icon"
              loading="eager"
              decoding="sync"
              className="w-16 h-16 object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="mb-2">
            <img
              src={WORDMARK_LOGO_DATA_URL || '/IMG_8905.png'}
              alt="Merchlist"
              loading="eager"
              decoding="sync"
              className="h-7 w-auto object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-sm font-semibold text-slate-600 tracking-tight">{applicationName}</h2>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {bootstrapSuccessMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{bootstrapSuccessMessage}</span>
            </div>
          )}

          {/* First Time Initial Admin Setup Mode */}
          {canBootstrapAdmin && isBootstrapping ? (
            <form onSubmit={handleBootstrapAdmin} className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Initial Administrator Setup:</span> Setting up credentials for Initial Admin (Login ID:{' '}
                <span className="font-mono font-bold">{INITIAL_ADMIN_LOGIN_ID}</span>).
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Initial Admin Login ID
                </label>
                <input
                  type="text"
                  value={INITIAL_ADMIN_LOGIN_ID}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Initial Admin Password
                </label>
                <input
                  type="password"
                  value={adminInitialPassword}
                  onChange={(e) => setAdminInitialPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c192c] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c192c] focus:border-transparent"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBootstrapping(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? 'Setting Up...' : 'Initialize Admin'}
                </button>
              </div>
            </form>
          ) : (
            /* Standard 9-digit Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="loginIdInput"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Login ID
                </label>
                <div className="relative">
                  <input
                    id="loginIdInput"
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    pattern="[0-9]*"
                    value={loginId}
                    onChange={(e) => {
                      const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setLoginId(numericOnly);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-[#0c192c] focus:border-transparent"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Must be exactly 9 numeric digits
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="passwordInput"
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Password
                  </label>
                </div>
                <input
                  id="passwordInput"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0c192c] focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#0c192c] focus:ring-[#0c192c] w-3.5 h-3.5"
                  />
                  <span>Remember Me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-cyan-700 hover:text-cyan-900 font-semibold cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-[#0c192c] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Password Reset</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              To reset your password, please contact the Merchlist System Administrator with your 9-digit Login ID. For security compliance, password resets are processed directly by Administrators.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0c192c] text-white hover:bg-slate-800 transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Merchlist. All rights reserved.
      </footer>
    </div>
  );
};
