import { Loader2 } from 'lucide-react';

interface AppleLoginProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}

export function AppleLogin({
  onClick,
  disabled,
  loading,
  label = 'Continue with Apple'
}: AppleLoginProps) {
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
        <svg className="w-4 h-4 shrink-0 fill-current text-slate-900" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43Zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45Z" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
