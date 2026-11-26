import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  parsedDetail: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      parsedDetail: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsedDetail: string | null = null;
    try {
      const parsed = JSON.parse(error.message) as { operationType?: string; path?: string; error?: string };
      if (parsed && parsed.error) {
        parsedDetail = `${parsed.operationType || 'operation'} on ${parsed.path || 'resource'}: ${parsed.error}`;
      }
    } catch {
      parsedDetail = null;
    }

    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected security or rendering error occurred.',
      parsedDetail
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-4">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">
                Security Boundary Exception
              </h1>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {this.state.parsedDetail ||
                'A protected operation was halted to protect session integrity. You can reset the view to continue.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '', parsedDetail: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
