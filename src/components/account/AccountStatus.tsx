import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  MailCheck,
  RefreshCw,
  Shield,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { resendVerificationEmail } from '../../services/authentication/authService';
import { mapAuthError } from '../../utils/errorHandler';
import type { AuthErrorInfo } from '../../types/auth';
import { AuthError } from '../authentication/AuthError';

interface AccountStatusProps {
  onNavigateToUpgrade: () => void;
}

function formatTimestamp(ts: { toDate?: () => Date } | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Pending server timestamp';
  return ts.toDate().toLocaleString();
}

export function AccountStatus({ onNavigateToUpgrade }: AccountStatusProps) {
  const { user, profile, backendSession, appCheckStatus, refreshBackendSession, refreshUserSession } =
    useAuth();
  const [copiedUid, setCopiedUid] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);

  if (!user) return null;

  const isGuest = user.isAnonymous;
  const linkedProviders = profile?.linkedProviders || [];

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1800);
    } catch {
      // Clipboard unavailable in restricted iframe
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setBusy(true);
    try {
      await resendVerificationEmail(user);
      setVerificationSent(true);
    } catch (err) {
      setError(mapAuthError(err, 'Email Verification'));
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshSession = async () => {
    setError(null);
    setBusy(true);
    try {
      await refreshUserSession();
    } catch (err) {
      setError(mapAuthError(err, 'Session Refresh'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Identity &amp; Session Overview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Verified Firebase Authentication identity, UID-scoped data ownership, and backend token attestation.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRefreshSession}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Refresh Token
          </button>
          {isGuest && (
            <button
              type="button"
              onClick={onNavigateToUpgrade}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Upgrade Guest Account
            </button>
          )}
        </div>
      </div>

      {error && <AuthError error={error} onDismiss={() => setError(null)} />}

      {/* Identity Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Account Mode</span>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-display text-lg font-semibold text-slate-900">
            {isGuest ? 'Anonymous Guest' : 'Registered Account'}
          </p>
          <p className="text-xs text-slate-600">
            accountType: <span className="font-mono">{profile?.accountType || (isGuest ? 'guest' : 'registered')}</span> · isAnonymous:{' '}
            <span className="font-mono">{String(user.isAnonymous)}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Backend Token Verification</span>
            <Shield className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            {backendSession?.verified ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Verified by Server</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pending Check</span>
              </>
            )}
          </p>
          <p className="text-xs text-slate-600">
            Provider claim:{' '}
            <span className="font-mono">{backendSession?.signInProvider || 'checking'}</span>
            {' · '}
            <button
              type="button"
              onClick={() => void refreshBackendSession()}
              className="text-indigo-700 hover:text-indigo-900 underline underline-offset-4 cursor-pointer"
            >
              Re-verify
            </button>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Linked Credentials</span>
            <KeyRound className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-display text-lg font-semibold text-slate-900 tabular-nums">
            {linkedProviders.length} {linkedProviders.length === 1 ? 'Provider' : 'Providers'}
          </p>
          <p className="text-xs text-slate-600 truncate">
            {linkedProviders.length > 0 ? linkedProviders.join(' · ') : 'None yet (Anonymous UID)'}
          </p>
        </div>
      </div>

      {/* Primary UID & Record Details */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Firebase Authentication UID (Immutable Owner Key)</p>
            <p className="font-mono text-sm sm:text-base font-medium text-slate-900 break-all">
              {user.uid}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyUid}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            {copiedUid ? 'Copied UID' : 'Copy UID'}
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Display Name</p>
            <p className="font-medium text-slate-900">
              {profile?.displayName || user.displayName || 'Not set'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Email &amp; Verification Status</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-slate-900">
                {user.email || profile?.email || 'No email linked (Anonymous Guest)'}
              </span>
              {user.email && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    user.emailVerified ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {user.emailVerified ? (
                    <>
                      <MailCheck className="w-3.5 h-3.5" />
                      Verified
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Unverified
                    </>
                  )}
                </span>
              )}
              {user.email && !user.emailVerified && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={busy}
                  className="text-xs font-medium text-indigo-700 hover:text-indigo-900 underline underline-offset-4 cursor-pointer"
                >
                  {verificationSent ? 'Verification Email Sent' : 'Send Verification Email'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Database Namespace</p>
            <p className="font-mono text-xs text-slate-800 break-all">
              users/{user.uid}/**
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Account Status</p>
            <p className="font-medium text-slate-900">
              {profile?.accountStatus || 'active'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Created At (Server Timestamp)</p>
            <p className="font-mono text-xs text-slate-700 tabular-nums">
              {formatTimestamp(profile?.createdAt)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Last Updated (Server Timestamp)</p>
            <p className="font-mono text-xs text-slate-700 tabular-nums">
              {formatTimestamp(profile?.updatedAt)}
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50/70 space-y-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">
            Session Persistence, App Check &amp; Guest Data Retention Policy
          </p>
          <p className="leading-relaxed">
            {appCheckStatus.message}
          </p>
          <p className="leading-relaxed">
            {isGuest
              ? 'Guest Persistence Policy: Your anonymous session is persisted locally in this browser so returning restores the same UID. However, clearing browser storage, switching devices, or signing out without linking a permanent provider may prevent recovering this anonymous UID. Inactive guest records are subject to a transparent 90-day server retention window; active guest data is never deleted automatically.'
              : 'Registered Account Recovery: Your UID is permanently backed by your linked authentication provider(s). Signing out preserves your private cloud records and allows full recovery on any device.'}
          </p>
        </div>
      </div>
    </div>
  );
}
