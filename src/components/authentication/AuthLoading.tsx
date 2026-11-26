import { Loader2 } from 'lucide-react';

export function AuthLoading({ message = 'Verifying authentication session...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-11 h-11 rounded-lg bg-indigo-950 text-white flex items-center justify-center font-display font-bold text-lg tracking-tight">
          M
        </div>
        <div className="flex items-center gap-2.5 text-slate-700 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
