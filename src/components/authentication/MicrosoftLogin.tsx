import { Loader2 } from 'lucide-react';

interface MicrosoftLoginProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}

export function MicrosoftLogin({
  onClick,
  disabled,
  loading,
  label = 'Continue with Microsoft'
}: MicrosoftLoginProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
      ) : (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
