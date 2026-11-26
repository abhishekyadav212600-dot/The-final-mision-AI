import React, { useState } from 'react';
import { AlertOctagon, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteCurrentAccount,
  reauthenticateWithPassword,
  reauthenticateWithProviderPopup
} from '../../services/authentication/sessionService';
import { mapAuthError } from '../../utils/errorHandler';
import type { AuthErrorInfo } from '../../types/auth';
import { AuthError } from '../authentication/AuthError';

export function DeleteAccount() {
  const { user, profile } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);

  if (!user) return null;

  const linkedProviders = profile?.linkedProviders || [];

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (confirmationText.trim() !== 'DELETE') {
      setError({
        code: 'delete/confirmation-required',
        title: 'Confirmation Required',
        message: 'Type DELETE exactly to confirm permanent deletion of your account and all private data.',
        recoverable: true
      });
      return;
    }

    setDeleting(true);
    try {
      await deleteCurrentAccount(user);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
      }
      setError(mapAuthError(err, 'Account Deletion'));
    } finally {
      setDeleting(false);
    }
  };

  const handleReauthPassword = async () => {
    setError(null);
    setDeleting(true);
    try {
      await reauthenticateWithPassword(user, reauthPassword);
      setNeedsReauth(false);
      await deleteCurrentAccount(user);
    } catch (err) {
      setError(mapAuthError(err, 'Reauthentication'));
    } finally {
      setDeleting(false);
    }
  };

  const handleReauthProvider = async (providerId: 'google.com' | 'apple.com' | 'microsoft.com') => {
    setError(null);
    setDeleting(true);
    try {
      await reauthenticateWithProviderPopup(user, providerId);
      setNeedsReauth(false);
      await deleteCurrentAccount(user);
    } catch (err) {
      setError(mapAuthError(err, 'Reauthentication'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white border border-red-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-red-900">
            <AlertOctagon className="w-4 h-4 text-red-700 shrink-0" />
            <h3 className="font-display text-base font-semibold">Delete Account &amp; Private Data</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
            Unlike signing out (which preserves your data), deleting your account permanently removes your Firebase Authentication identity, profile, private settings, and all UID-isolated records. Only an anonymized non-PII deletion receipt is kept for audit compliance.
          </p>
        </div>

        {!expanded && (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              setError(null);
            }}
            className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        )}
      </div>

      {error && <AuthError error={error} onDismiss={() => setError(null)} />}

      {expanded && (
        <form onSubmit={handleDeleteAccount} className="bg-red-50/60 border border-red-200 rounded-lg p-4 space-y-4">
          <div className="text-xs text-red-950 space-y-1">
            <p className="font-semibold">What will be permanently deleted for UID {user.uid}:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-red-900">
              <li>Profile document (<span className="font-mono">users/{user.uid}</span>)</li>
              <li>Private settings (<span className="font-mono">users/{user.uid}/private/settings</span>)</li>
              <li>All isolation verification records (<span className="font-mono">users/{user.uid}/isolation_probes/*</span>)</li>
              <li>Firebase Authentication credentials and active session tokens</li>
            </ul>
          </div>

          {needsReauth && (
            <div className="bg-white border border-amber-200 rounded-lg p-3.5 space-y-3">
              <p className="text-xs font-semibold text-amber-950">
                Reauthentication Required to Delete Account
              </p>
              {linkedProviders.includes('password') && user.email && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="flex-1 h-9 px-3 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void handleReauthPassword()}
                    disabled={deleting || !reauthPassword}
                    className="px-3 h-9 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Verify Password &amp; Delete
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {linkedProviders.includes('google.com') && (
                  <button
                    type="button"
                    onClick={() => void handleReauthProvider('google.com')}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Reauthenticate with Google
                  </button>
                )}
                {linkedProviders.includes('apple.com') && (
                  <button
                    type="button"
                    onClick={() => void handleReauthProvider('apple.com')}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Reauthenticate with Apple
                  </button>
                )}
                {linkedProviders.includes('microsoft.com') && (
                  <button
                    type="button"
                    onClick={() => void handleReauthProvider('microsoft.com')}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Reauthenticate with Microsoft
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="confirm-delete-input" className="block text-xs font-medium text-red-950 mb-1">
              Type <span className="font-mono font-semibold">DELETE</span> to permanently delete your account
            </label>
            <input
              id="confirm-delete-input"
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE"
              className="w-full sm:w-64 h-10 px-3 bg-white border border-red-300 rounded-lg text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={deleting || confirmationText.trim() !== 'DELETE'}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Permanent Deletion
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setConfirmationText('');
                setNeedsReauth(false);
                setError(null);
              }}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
