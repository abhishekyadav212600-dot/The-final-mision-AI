import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type { AuthErrorInfo } from '../../types/auth';

interface AuthErrorProps {
  error: AuthErrorInfo | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function AuthError({ error, onDismiss, onRetry }: AuthErrorProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-950">{error.title}</p>
            <p className="text-red-800 leading-relaxed">{error.message}</p>
            {error.guidance && (
              <p className="text-xs text-red-700 leading-relaxed pt-1">
                {error.guidance}
              </p>
            )}
            {onRetry && error.recoverable && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-red-900 underline underline-offset-4 hover:text-red-950 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry operation
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-red-700 hover:text-red-950 p-1 rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
