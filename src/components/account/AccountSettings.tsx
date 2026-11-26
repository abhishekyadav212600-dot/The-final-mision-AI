import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  updateDisplayName,
  updatePrivateSettings
} from '../../services/authentication/sessionService';
import type { SessionPersistenceMode } from '../../types/auth';
import { LinkAccount } from './LinkAccount';
import { SignOut } from './SignOut';
import { DeleteAccount } from './DeleteAccount';

export function AccountSettings() {
  const { user, profile, settings } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [persistence, setPersistence] = useState<SessionPersistenceMode>(
    settings?.sessionPersistence || 'local'
  );
  const [securityNotifications, setSecurityNotifications] = useState(
    settings?.securityNotifications ?? true
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || '');
  }, [profile?.displayName, user?.displayName]);

  useEffect(() => {
    if (settings) {
      setPersistence(settings.sessionPersistence);
      setSecurityNotifications(settings.securityNotifications);
    }
  }, [settings]);

  if (!user) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(null);
    try {
      await updateDisplayName(user, displayName);
      await updatePrivateSettings(user, {
        sessionPersistence: persistence,
        securityNotifications,
        dataRetentionNoticeSeen: true
      });
      setSavedNotice('Private profile and session preferences saved under your UID.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Account Settings &amp; Credential Linking
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your profile, session persistence, optional guest account upgrade, sign-out, and account deletion.
        </p>
      </div>

      {/* Optional Guest-to-Registered Linking Section */}
      <LinkAccount />

      {/* Profile & Private Preferences */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Private Profile &amp; Session Preferences
          </h2>
          <p className="text-xs text-slate-600">
            Stored strictly under <span className="font-mono">users/{user.uid}/private/settings</span>.
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="settings-display-name" className="block text-xs font-medium text-slate-700 mb-1.5">
              Display Name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
              placeholder={user.isAnonymous ? 'Optional guest display name' : 'Your display name'}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div>
            <label htmlFor="settings-persistence" className="block text-xs font-medium text-slate-700 mb-1.5">
              Session Persistence Mode
            </label>
            <select
              id="settings-persistence"
              value={persistence}
              onChange={(e) => setPersistence(e.target.value as SessionPersistenceMode)}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="local">Local Persistence (Restore across browser restarts)</option>
              <option value="session">Session Only (Clear when browser tab closes)</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={securityNotifications}
            onChange={(e) => setSecurityNotifications(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
          />
          <span>Record security audit events for sign-in, linking, and isolation checks</span>
        </label>

        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Private Preferences
          </button>
        </div>
      </form>

      <SignOut />
      <DeleteAccount />
    </div>
  );
}
