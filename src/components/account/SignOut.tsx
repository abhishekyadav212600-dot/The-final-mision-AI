import { useState } from 'react';
import { AlertTriangle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { signOutUser } from '../../services/authentication/sessionService';

interface SignOutProps {
  onNavigateToUpgrade?: () => void;
  variant?: 'header' | 'panel';
}

export function SignOut({ onNavigateToUpgrade, variant = 'panel' }: SignOutProps) {
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const isGuest = user.isAnonymous;

  const handleSignOutClick = async () => {
    if (isGuest && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }

    setSigningOut(true);
    try {
      await signOutUser(user);
      setConfirmOpen(false);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => void handleSignOutClick()}
          disabled={signingOut}
          className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {signingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          <span>Sign Out</span>
        </button>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-slate-900">Sign Out of Session</h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              Signing out ends your current authentication session and clears in-memory state. Your cloud Firestore records are NOT deleted when you sign out.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOutClick()}
            disabled={signingOut}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {signingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Guest Sign-Out Warning Dialog */}
      {confirmOpen && isGuest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-signout-title"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h3 id="guest-signout-title" className="font-display text-base font-bold text-slate-900">
                  Signing Out of an Unlinked Guest Account
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are currently signed in as an anonymous guest (<span className="font-mono">{user.uid}</span>). Signing out will not delete your Firestore records, but because no permanent provider is linked, you may not be able to recover or re-enter this exact anonymous account once signed out.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              {onNavigateToUpgrade && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmOpen(false);
                    onNavigateToUpgrade();
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 cursor-pointer"
                >
                  Link Account First
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSigningOut(true);
                  void signOutUser(user).finally(() => {
                    setSigningOut(false);
                    setConfirmOpen(false);
                  });
                }}
                disabled={signingOut}
                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {signingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sign Out Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
