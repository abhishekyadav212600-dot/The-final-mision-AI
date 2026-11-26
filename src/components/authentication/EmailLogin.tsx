import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import {
  registerWithEmail,
  requestPasswordReset,
  signInWithEmail
} from '../../services/authentication/authService';
import { validateEmail, validatePasswordStrength } from '../../services/security/validation';
import { mapAuthError } from '../../utils/errorHandler';
import type { AuthErrorInfo } from '../../types/auth';

type EmailMode = 'signin' | 'register' | 'reset';

interface EmailLoginProps {
  initialMode?: 'signin' | 'register';
  onError: (err: AuthErrorInfo | null) => void;
  disabled?: boolean;
}

export function EmailLogin({
  initialMode = 'register',
  onError,
  disabled
}: EmailLoginProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<EmailMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const strength = validatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setResetSent(false);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      onError({
        code: 'auth/invalid-email',
        title: 'Invalid Email Address',
        message: emailCheck.error || 'Enter a valid email address.',
        recoverable: true
      });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'reset') {
        await requestPasswordReset(emailCheck.normalized);
        setResetSent(true);
      } else if (mode === 'register') {
        if (!strength.valid) {
          onError({
            code: 'auth/weak-password',
            title: 'Password Requirements',
            message: `Password needs: ${strength.errors.join(', ')}.`,
            recoverable: true
          });
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          onError({
            code: 'auth/password-mismatch',
            title: 'Passwords Do Not Match',
            message: 'Confirm password must match your chosen password.',
            recoverable: true
          });
          setSubmitting(false);
          return;
        }
        await registerWithEmail({
          email: emailCheck.normalized,
          password,
          confirmPassword,
          displayName
        });
      } else {
        await signInWithEmail(emailCheck.normalized, password);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Password confirmation does not match.') {
        onError({
          code: 'auth/password-mismatch',
          title: 'Passwords Do Not Match',
          message: err.message,
          recoverable: true
        });
      } else {
        onError(mapAuthError(err, 'Email & Password'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setExpanded(true);
            onError(null);
          }}
          disabled={disabled}
          className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Mail className="w-4 h-4 text-slate-600 shrink-0" />
          <span>Continue with Email</span>
        </button>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setExpanded(true);
              onError(null);
            }}
            className="font-medium text-indigo-700 hover:text-indigo-900 underline underline-offset-4 cursor-pointer"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setExpanded(true);
              onError(null);
            }}
            className="font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Already have an account? Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setResetSent(false);
            onError(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All sign-in options
        </button>

        {mode !== 'reset' && (
          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                onError(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                onError(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {mode === 'reset' && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Reset Password</h3>
          <p className="text-xs text-slate-600">
            Enter your registered email address to receive a password reset link.
          </p>
        </div>
      )}

      {resetSent && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>Password reset link sent if an account exists for {email}. Check your inbox.</span>
        </div>
      )}

      {mode === 'register' && (
        <div>
          <label htmlFor="email-display-name" className="block text-xs font-medium text-slate-700 mb-1">
            Full Name (optional)
          </label>
          <input
            id="email-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            placeholder="Alex Rivera"
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
          />
        </div>
      )}

      <div>
        <label htmlFor="auth-email-input" className="block text-xs font-medium text-slate-700 mb-1">
          Email Address
        </label>
        <input
          id="auth-email-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
        />
      </div>

      {mode !== 'reset' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="auth-password-input" className="block text-xs font-medium text-slate-700">
              Password
            </label>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setResetSent(false);
                  onError(null);
                }}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="auth-password-input"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
              className="w-full h-10 pl-3 pr-10 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
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
          {mode === 'register' && password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-1 rounded-full ${
                      strength.score >= step
                        ? strength.valid
                          ? 'bg-emerald-600'
                          : 'bg-amber-500'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-600">
                {strength.valid
                  ? 'Strong password verified.'
                  : `Required: ${strength.errors.join(' · ')}`}
              </p>
            </div>
          )}
        </div>
      )}

      {mode === 'register' && (
        <div>
          <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-slate-700 mb-1">
            Confirm Password
          </label>
          <input
            id="auth-confirm-password"
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting || disabled}
          className="flex-1 h-10 px-4 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {mode === 'register'
              ? 'Create Account'
              : mode === 'signin'
                ? 'Sign In'
                : 'Send Reset Link'}
          </span>
        </button>

        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setResetSent(false);
              onError(null);
            }}
            className="h-10 px-3 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Back
          </button>
        )}
      </div>

      {mode !== 'reset' && (
        <p className="text-xs text-slate-600 text-center">
          {mode === 'register' ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  onError(null);
                }}
                className="font-medium text-indigo-700 hover:text-indigo-900 underline underline-offset-4 cursor-pointer"
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              Need a permanent account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  onError(null);
                }}
                className="font-medium text-indigo-700 hover:text-indigo-900 underline underline-offset-4 cursor-pointer"
              >
                Create Account
              </button>
            </>
          )}
        </p>
      )}
    </form>
  );
}
