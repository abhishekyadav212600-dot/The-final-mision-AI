import { Loader2, UserCheck } from 'lucide-react';

interface GuestAccessProps {
  onContinueAsGuest: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function GuestAccess({ onContinueAsGuest, loading, disabled }: GuestAccessProps) {
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onContinueAsGuest}
        disabled={disabled || loading}
        className="w-full h-11 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserCheck className="w-4 h-4 shrink-0" />
        )}
        <span>Continue as Guest</span>
      </button>
      <p className="text-xs text-slate-500 leading-relaxed">
        Starts an isolated anonymous Firebase session with your own private UID. No registration required; you can link Google, Apple, Microsoft, or Email later without losing data.
      </p>
    </div>
  );
}
