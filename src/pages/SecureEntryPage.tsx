import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AccountStatus } from '../components/account/AccountStatus';
import { AccountSettings } from '../components/account/AccountSettings';
import { DataIsolationLab } from '../components/account/DataIsolationLab';
import { SignOut } from '../components/account/SignOut';

type ActiveTab = 'identity' | 'settings' | 'isolation' | 'security';

export function SecureEntryPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('identity');

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            MISSION AI
          </button>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                activeTab === 'identity'
                  ? 'text-slate-950 underline underline-offset-8 decoration-indigo-700 decoration-2'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Identity
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'text-slate-950 underline underline-offset-8 decoration-indigo-700 decoration-2'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Account Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('isolation')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                activeTab === 'isolation'
                  ? 'text-slate-950 underline underline-offset-8 decoration-indigo-700 decoration-2'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Data Isolation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                activeTab === 'security'
                  ? 'text-slate-950 underline underline-offset-8 decoration-indigo-700 decoration-2'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Security Checks
            </button>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <SignOut
              variant="header"
              onNavigateToUpgrade={() => setActiveTab('settings')}
            />
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeTab === 'identity' ? 'text-indigo-700 font-semibold' : 'text-slate-600'
            }`}
          >
            Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeTab === 'settings' ? 'text-indigo-700 font-semibold' : 'text-slate-600'
            }`}
          >
            Account Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('isolation')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeTab === 'isolation' ? 'text-indigo-700 font-semibold' : 'text-slate-600'
            }`}
          >
            Data Isolation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeTab === 'security' ? 'text-indigo-700 font-semibold' : 'text-slate-600'
            }`}
          >
            Security Checks
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {activeTab === 'identity' && (
          <AccountStatus onNavigateToUpgrade={() => setActiveTab('settings')} />
        )}
        {activeTab === 'settings' && <AccountSettings />}
        {activeTab === 'isolation' && <DataIsolationLab activeSection="isolation" />}
        {activeTab === 'security' && <DataIsolationLab activeSection="security" />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>MISSION AI · Learn Smarter, Achieve More.</span>
          <span className="font-mono">
            Authorized Session ({profile?.accountType || (user.isAnonymous ? 'guest' : 'registered')}) · {user.uid}
          </span>
        </div>
      </footer>
    </div>
  );
}
