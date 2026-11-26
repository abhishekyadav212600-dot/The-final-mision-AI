import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  signInWithApple,
  signInWithGoogle,
  signInWithMicrosoft
} from '../../services/authentication/authService';
import { continueAsGuest } from '../../services/authentication/guestService';
import { mapAuthError } from '../../utils/errorHandler';
import type { AuthErrorInfo } from '../../types/auth';
import { AuthError } from './AuthError';
import { GoogleLogin } from './GoogleLogin';
import { AppleLogin } from './AppleLogin';
import { MicrosoftLogin } from './MicrosoftLogin';
import { EmailLogin } from './EmailLogin';
import { GuestAccess } from './GuestAccess';

type ActiveAction = 'google' | 'apple' | 'microsoft' | 'guest' | null;

export function AuthScreen() {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const runAction = async (
    action: ActiveAction,
    contextLabel: string,
    fn: () => Promise<unknown>
  ) => {
    setError(null);
    setActiveAction(action);
    try {
      await fn();
    } catch (err) {
      setError(mapAuthError(err, contextLabel));
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:grid lg:grid-cols-12 items-stretch">
      {/* Left Architectural Brand Column */}
      <div className="relative lg:col-span-6 bg-slate-900 text-white flex flex-col justify-between min-h-[320px] lg:min-h-screen overflow-hidden">
        {!imgFailed ? (
          <img
            src="/src/assets/images/mission_study_architecture_1795705221714.jpg"
            alt="Minimalist architectural study workspace representing focused learning"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/60" />

        <div className="relative z-10 p-8 lg:p-12 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white text-slate-950 flex items-center justify-center font-display font-bold text-base tracking-tight shrink-0">
            M
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap">
            MISSION AI
          </span>
        </div>

        <div className="relative z-10 p-8 lg:p-12 space-y-6 max-w-xl">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-wide text-slate-300">
              Identity &amp; Isolation Foundation
            </p>
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-white text-balance">
              Learn Smarter, Achieve More.
            </h1>
            <p className="text-sm lg:text-base text-slate-200 leading-relaxed">
              Every session—registered or anonymous guest—is backed by an independent Firebase UID, strict Firestore ownership rules, and seamless credential linking when you choose to upgrade.
            </p>
          </div>

          <div className="pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
            <div>
              <p className="font-semibold text-white">Private by UID</p>
              <p className="mt-0.5 text-slate-300">Isolated cloud database per user</p>
            </div>
            <div>
              <p className="font-semibold text-white">Zero Forced Sign-Up</p>
              <p className="mt-0.5 text-slate-300">Genuine anonymous access</p>
            </div>
            <div>
              <p className="font-semibold text-white">Lossless Upgrade</p>
              <p className="mt-0.5 text-slate-300">Link providers anytime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Options Column */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10 lg:p-16 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          {/* Header & Supporting Text */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-950 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
                M
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">
                  MISSION AI
                </h2>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-800">
              Learn Smarter, Achieve More.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Explore MISSION AI your way. Create an account or continue as a guest.
            </p>
          </div>

          {error && (
            <AuthError error={error} onDismiss={() => setError(null)} />
          )}

          {/* Primary OAuth Providers */}
          <div className="space-y-2.5">
            <GoogleLogin
              onClick={() => runAction('google', 'Google', signInWithGoogle)}
              loading={activeAction === 'google'}
              disabled={activeAction !== null && activeAction !== 'google'}
            />
            <AppleLogin
              onClick={() => runAction('apple', 'Apple', signInWithApple)}
              loading={activeAction === 'apple'}
              disabled={activeAction !== null && activeAction !== 'apple'}
            />
            <MicrosoftLogin
              onClick={() => runAction('microsoft', 'Microsoft', signInWithMicrosoft)}
              loading={activeAction === 'microsoft'}
              disabled={activeAction !== null && activeAction !== 'microsoft'}
            />
          </div>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">or</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Email & Password */}
          <EmailLogin
            onError={setError}
            disabled={activeAction !== null}
          />

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">guest access</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          {/* Guest Access (Always Visible) */}
          <GuestAccess
            onContinueAsGuest={() => runAction('guest', 'Anonymous Guest Access', continueAsGuest)}
            loading={activeAction === 'guest'}
            disabled={activeAction !== null && activeAction !== 'guest'}
          />

          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Protected by Firebase Authentication &amp; UID-isolated Firestore rules.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
