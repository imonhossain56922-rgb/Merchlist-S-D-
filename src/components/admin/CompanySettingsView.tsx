import React, { useState } from 'react';
import { CompanySettings, UserProfile } from '../../types';
import { updateCompanySettings } from '../../services/settingsService';
import { MerchlistLogo } from '../brand/MerchlistLogo';
import { Settings, Save, Upload, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

interface CompanySettingsViewProps {
  currentUser: UserProfile;
  settings: CompanySettings;
  onUpdateSettings: (newSettings: CompanySettings) => void;
}

export const CompanySettingsView: React.FC<CompanySettingsViewProps> = ({
  currentUser,
  settings,
  onUpdateSettings,
}) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [applicationName, setApplicationName] = useState(settings.applicationName);
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Dubai');
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || 'DD/MM/YYYY');
  const [customLogo, setCustomLogo] = useState<string | null>(settings.logo || null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Logo image exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const updated = await updateCompanySettings(
        {
          companyName: companyName.trim() || 'Merchlist',
          applicationName: applicationName.trim() || 'Marchlist Mockup Request',
          timezone,
          dateFormat,
          logo: customLogo || undefined,
        },
        currentUser.userId,
        currentUser.name
      );
      onUpdateSettings(updated);
      setSuccessMessage('Company settings updated successfully.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDefaults = () => {
    setCompanyName('Merchlist');
    setApplicationName('Marchlist Mockup Request');
    setTimezone('Asia/Dubai');
    setDateFormat('DD/MM/YYYY');
    setCustomLogo(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-[#0c192c] tracking-tight">Company Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure corporate branding, application title, regional timezone, and date format.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 text-xs">
        {/* Brand / Application Identity */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Brand & Application Identity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Company / Brand Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Official Application Name
              </label>
              <input
                type="text"
                value={applicationName}
                onChange={(e) => setApplicationName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
              />
            </div>
          </div>
        </div>

        {/* Corporate Logo Asset */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">
            Official Brand Logo Assets (Locked)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* Primary App Icon Logo */}
            <div className="p-4 bg-white rounded-xl border border-slate-200/80 flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-50 rounded-xl p-2 flex items-center justify-center border border-slate-100 flex-shrink-0">
                <img
                  src="/IMG_8904.png"
                  alt="Merchlist Icon Logo"
                  className="w-10 h-10 object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block">Primary App Icon Logo</span>
                <span className="text-[11px] text-slate-500 block truncate">Circular black badge with white lowercase 'ml'</span>
                <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded mt-1 inline-block">/IMG_8904.png</span>
              </div>
            </div>

            {/* Wordmark Logo */}
            <div className="p-4 bg-white rounded-xl border border-slate-200/80 flex items-center gap-4">
              <div className="h-14 w-28 bg-slate-50 rounded-xl p-2 flex items-center justify-center border border-slate-100 flex-shrink-0">
                <img
                  src="/IMG_8905.png"
                  alt="Merchlist Wordmark"
                  className="h-6 w-auto object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-900 block">Wordmark Logo</span>
                <span className="text-[11px] text-slate-500 block truncate">Official 'merchlist' typography</span>
                <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded mt-1 inline-block">/IMG_8905.png</span>
              </div>
            </div>
          </div>
        </div>

        {/* Regional & Timezone Configuration */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
            Regional & Timezone Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Default Company Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
              >
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4) - Default</option>
                <option value="Asia/Riyadh">Asia/Riyadh (AST, UTC+3)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                All daily metrics, previous pending cutoffs, and PDF exports use this timezone.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Display Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c192c]"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#0c192c] text-white font-semibold hover:bg-slate-800 shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving Settings...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
