import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Link2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  linkEmailPasswordAccount,
  linkProviderPopup
} from '../../services/authentication/accountLinkingService';
import { signOutUser } from '../../services/authentication/sessionService';
import { validateEmail, validatePasswordStrength } from '../../services/security/validation';
import { mapAuthError } from '../../utils/errorHandler';
import type { AuthErrorInfo, LinkingConflictState, SupportedProviderId } from '../../types/auth';
import { GoogleLogin } from '../authentication/GoogleLogin';
import { AppleLogin } from '../authentication/AppleLogin';
import { MicrosoftLogin } from '../authentication/MicrosoftLogin';
import { AuthError } from '../authentication/AuthError';

export function LinkAccount() {
  const { user, profile, refreshUserSession } = useAuth();
  const [busyProvider, setBusyProvider] = useState<SupportedProviderId | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [conflict, setConflict] = useState<LinkingConflictState | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    originalUid: string;
    finalUid: string;
    providers: SupportedProviderId[];
  } | null>(null);

  if (!user) return null;

  const isGuest = user.isAnonymous;
  const linkedProviders = profile?.linkedProviders || [];
  const strength = validatePasswordStrength(password);

  const handlePopupLink = async (providerId: 'google.com' | 'apple.com' | 'microsoft.com') => {
    setError(null);
    setConflict(null);
    setSuccessInfo(null);
    setBusyProvider(providerId);
    try {
      const outcome = await linkProviderPopup(user, providerId);
      if (outcome.status === 'conflict' && outcome.conflict) {
        setConflict(outcome.conflict);
      } else if (outcome.status === 'linked') {
        await refreshUserSession();
        setSuccessInfo({
          originalUid: outcome.originalUid,
          finalUid: outcome.finalUid,
          providers: outcome.linkedProviders || []
        });
      }
    } catch (err) {
      const label =
        providerId === 'google.com'
          ? 'Google'
          : providerId === 'apple.com'
            ? 'Apple'
            : 'Microsoft';
      setError(mapAuthError(err, label));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflict(null);
    setSuccessInfo(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError({
        code: 'auth/invalid-email',
        title: 'Invalid Email Address',
        message: emailCheck.error || 'Enter a valid email address.',
        recoverable: true
      });
      return;
    }
    if (!strength.valid) {
      setError({
        code: 'auth/weak-password',
        title: 'Password Requirements',
        message: `Password needs: ${strength.errors.join(', ')}.`,
        recoverable: true
      });
      return;
    }
    if (password !== confirmPassword) {
      setError({
        code: 'auth/password-mismatch',
        title: 'Passwords Do Not Match',
        message: 'Confirm password must match your chosen password.',
        recoverable: true
      });
      return;
    }

    setBusyProvider('password');
    try {
      const outcome = await linkEmailPasswordAccount(user, {
        email: emailCheck.normalized,
        password,
        confirmPassword,
        displayName
      });
      if (outcome.status === 'conflict' && outcome.conflict) {
        setConflict(outcome.conflict);
      } else if (outcome.status === 'linked') {
        await refreshUserSession();
        setSuccessInfo({
          originalUid: outcome.originalUid,
          finalUid: outcome.finalUid,
          providers: outcome.linkedProviders || []
        });
        setShowEmailForm(false);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(mapAuthError(err, 'Email & Password'));
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-slate-900">
          <Link2 className="w-4 h-4 text-indigo-700 shrink-0" />
          <h2 className="font-display text-lg font-semibold">
            {isGuest ? 'Upgrade Your Guest Account' : 'Connected Sign-In Providers'}
          </h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          {isGuest
            ? 'Connect an account to improve account recovery while keeping your existing data. Your Firebase UID and all private records remain completely unchanged.'
            : 'Link additional authentication methods to the same Firebase UID for flexible account recovery.'}
        </p>
      </div>

      {error && <AuthError error={error} onDismiss={() => setError(null)} />}

      {successInfo && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-950 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Credential Linked Successfully</span>
          </div>
          <p className="text-xs text-emerald-900">
            Your original UID (<span className="font-mono">{successInfo.finalUid}</span>) remained identical
            ({successInfo.originalUid === successInfo.finalUid ? 'UID preserved' : 'verified'}), and all existing isolated records remain accessible.
          </p>
        </div>
      )}

      {conflict && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-950 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Account Conflict Handled Safely</p>
              <p className="text-xs text-amber-900 leading-relaxed">{conflict.message}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-950 rounded-lg hover:bg-amber-100/60 transition-colors cursor-pointer"
            >
              Keep Current Guest Account ({conflict.currentGuestUid.slice(0, 8)}...)
            </button>
            <button
              type="button"
              onClick={() => void signOutUser(user)}
              className="px-3 py-1.5 text-xs font-medium bg-amber-900 text-white rounded-lg hover:bg-amber-950 transition-colors cursor-pointer"
            >
              Sign Out &amp; Sign Into Existing {conflict.providerLabel} Account
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GoogleLogin
          label={linkedProviders.includes('google.com') ? 'Google Linked' : 'Link Google Account'}
          onClick={() => void handlePopupLink('google.com')}
          loading={busyProvider === 'google.com'}
          disabled={busyProvider !== null || linkedProviders.includes('google.com')}
        />
        <AppleLogin
          label={linkedProviders.includes('apple.com') ? 'Apple Linked' : 'Link Apple Account'}
          onClick={() => void handlePopupLink('apple.com')}
          loading={busyProvider === 'apple.com'}
          disabled={busyProvider !== null || linkedProviders.includes('apple.com')}
        />
        <MicrosoftLogin
          label={linkedProviders.includes('microsoft.com') ? 'Microsoft Linked' : 'Link Microsoft Account'}
          onClick={() => void handlePopupLink('microsoft.com')}
          loading={busyProvider === 'microsoft.com'}
          disabled={busyProvider !== null || linkedProviders.includes('microsoft.com')}
        />
        <button
          type="button"
          onClick={() => {
            setShowEmailForm((prev) => !prev);
            setError(null);
            setConflict(null);
          }}
          disabled={busyProvider !== null || linkedProviders.includes('password')}
          className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Mail className="w-4 h-4 text-slate-600 shrink-0" />
          <span>{linkedProviders.includes('password') ? 'Email Linked' : 'Link Email & Password'}</span>
        </button>
      </div>

      {showEmailForm && !linkedProviders.includes('password') && (
        <form onSubmit={handleEmailLink} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Link Email &amp; Password to Current UID</h3>
            <span className="font-mono text-xs text-slate-500">{user.uid.slice(0, 10)}...</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="link-display-name" className="block text-xs font-medium text-slate-700 mb-1">
                Display Name (optional)
              </label>
              <input
                id="link-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                placeholder="Your Name"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label htmlFor="link-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="link-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                placeholder="you@example.com"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="link-password" className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="link-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full h-10 pl-3 pr-10 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="link-confirm-password" className="block text-xs font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <input
                id="link-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          {password.length > 0 && (
            <p className="text-xs text-slate-600">
              {strength.valid
                ? 'Password meets complexity requirements.'
                : `Missing: ${strength.errors.join(' · ')}`}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busyProvider === 'password'}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {busyProvider === 'password' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Link Email &amp; Upgrade Account
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Linking preserves your existing UID (<span className="font-mono">{user.uid}</span>) without duplicating accounts or overwriting data.
        </span>
      </div>
    </div>
  );
}
