import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Loader2,
  Lock,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/firebaseConfig';
import { useAuth } from '../../hooks/useAuth';
import {
  createIsolationProbe,
  deleteIsolationProbe
} from '../../services/authentication/sessionService';
import {
  fetchUserAuditEvents,
  probeCrossUidBackendCall,
  probeUnauthenticatedBackendCall,
  verifySessionWithBackend
} from '../../services/security/authorization';
import type { IsolationScope, SecurityAuditEntry } from '../../types/auth';

interface VerificationTestResult {
  id: string;
  name: string;
  expected: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  detail: string;
}

const INITIAL_CHECKS: VerificationTestResult[] = [
  {
    id: 'backend_token_verify',
    name: 'Backend Firebase Admin Token Verification',
    expected: '200 OK with verified UID matching Firebase Auth',
    status: 'idle',
    detail: 'Not run yet'
  },
  {
    id: 'backend_unauth_reject',
    name: 'Protected Backend API Without Token',
    expected: '401 Unauthorized',
    status: 'idle',
    detail: 'Not run yet'
  },
  {
    id: 'backend_cross_uid_reject',
    name: 'Protected Backend API Cross-UID Request',
    expected: '403 Forbidden (UID ownership mismatch)',
    status: 'idle',
    detail: 'Not run yet'
  },
  {
    id: 'firestore_cross_uid_read',
    name: 'Firestore Cross-UID Profile Read Attempt',
    expected: 'PERMISSION_DENIED by Firestore Rules',
    status: 'idle',
    detail: 'Not run yet'
  },
  {
    id: 'firestore_cross_uid_write',
    name: 'Firestore Cross-UID Subcollection Write Attempt',
    expected: 'PERMISSION_DENIED by Firestore Rules',
    status: 'idle',
    detail: 'Not run yet'
  },
  {
    id: 'firestore_privilege_escalation',
    name: 'Profile Privilege Escalation (Shadow isAdmin Field)',
    expected: 'PERMISSION_DENIED by Firestore Rules',
    status: 'idle',
    detail: 'Not run yet'
  }
];

export function DataIsolationLab({ activeSection }: { activeSection: 'isolation' | 'security' }) {
  const { user, isolationProbes } = useAuth();
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<IsolationScope>('isolation_check');
  const [creating, setCreating] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [checks, setChecks] = useState<VerificationTestResult[]>(INITIAL_CHECKS);
  const [runningChecks, setRunningChecks] = useState(false);
  const [auditEvents, setAuditEvents] = useState<SecurityAuditEntry[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  const loadAudits = useCallback(async () => {
    if (!user) return;
    setLoadingAudits(true);
    try {
      const events = await fetchUserAuditEvents(user);
      setAuditEvents(events);
    } catch {
      setAuditEvents([]);
    } finally {
      setLoadingAudits(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeSection === 'security') {
      void loadAudits();
    }
  }, [activeSection, loadAudits]);

  if (!user) return null;

  const handleCreateProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    setProbeError(null);
    if (!label.trim()) {
      setProbeError('Enter a verification record label.');
      return;
    }
    setCreating(true);
    try {
      await createIsolationProbe(user, label, scope);
      setLabel('');
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : 'Unable to save isolated record.');
    } finally {
      setCreating(false);
    }
  };

  const runLiveSecurityChecks = async () => {
    setRunningChecks(true);
    const foreignUid = `foreign_isolation_target_${user.uid.slice(0, 6)}`;
    const nextResults: VerificationTestResult[] = [];

    // 1. Backend token verification
    try {
      const verified = await verifySessionWithBackend(user);
      const passed = verified.verified && verified.uid === user.uid;
      nextResults.push({
        ...INITIAL_CHECKS[0],
        status: passed ? 'passed' : 'failed',
        detail: passed
          ? `Server verified UID ${verified.uid} (provider: ${verified.signInProvider})`
          : 'UID mismatch during token verification.'
      });
    } catch (err) {
      nextResults.push({
        ...INITIAL_CHECKS[0],
        status: 'failed',
        detail: err instanceof Error ? err.message : 'Verification request failed.'
      });
    }

    // 2. Unauthenticated backend call
    try {
      const res = await probeUnauthenticatedBackendCall();
      nextResults.push({
        ...INITIAL_CHECKS[1],
        status: res.rejected ? 'passed' : 'failed',
        detail: `HTTP ${res.status}: ${res.message}`
      });
    } catch {
      nextResults.push({
        ...INITIAL_CHECKS[1],
        status: 'failed',
        detail: 'Request failed unexpectedly.'
      });
    }

    // 3. Cross-UID backend call
    try {
      const res = await probeCrossUidBackendCall(user, foreignUid);
      nextResults.push({
        ...INITIAL_CHECKS[2],
        status: res.rejected ? 'passed' : 'failed',
        detail: `HTTP ${res.status}: ${res.message}`
      });
    } catch {
      nextResults.push({
        ...INITIAL_CHECKS[2],
        status: 'failed',
        detail: 'Request failed unexpectedly.'
      });
    }

    // 4. Cross-UID Firestore Read
    try {
      await getDoc(doc(db, 'users', foreignUid));
      nextResults.push({
        ...INITIAL_CHECKS[3],
        status: 'failed',
        detail: 'Security failure: foreign UID read succeeded.'
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const denied = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
      nextResults.push({
        ...INITIAL_CHECKS[3],
        status: denied ? 'passed' : 'failed',
        detail: `Blocked by Firestore Rules (${msg})`
      });
    }

    // 5. Cross-UID Firestore Write
    try {
      await setDoc(doc(db, 'users', foreignUid, 'isolation_probes', 'attack_probe'), {
        uid: user.uid,
        label: 'Unauthorized write test',
        scope: 'isolation_check',
        createdUnderMode: user.isAnonymous ? 'guest' : 'registered',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      nextResults.push({
        ...INITIAL_CHECKS[4],
        status: 'failed',
        detail: 'Security failure: foreign UID write succeeded.'
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const denied = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
      nextResults.push({
        ...INITIAL_CHECKS[4],
        status: denied ? 'passed' : 'failed',
        detail: `Blocked by Firestore Rules (${msg})`
      });
    }

    // 6. Shadow Admin Privilege Escalation Write
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isAdmin: true,
        role: 'superadmin',
        updatedAt: serverTimestamp()
      } as Record<string, unknown>);
      nextResults.push({
        ...INITIAL_CHECKS[5],
        status: 'failed',
        detail: 'Security failure: shadow admin field mutation succeeded.'
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const denied = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
      nextResults.push({
        ...INITIAL_CHECKS[5],
        status: denied ? 'passed' : 'failed',
        detail: `Blocked by Firestore Rules (${msg})`
      });
    }

    setChecks(nextResults);
    setRunningChecks(false);
    await loadAudits();
  };

  if (activeSection === 'isolation') {
    return (
      <div className="space-y-8">
        <div className="border-b border-slate-200 pb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            UID Data Isolation Sandbox
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Create private verification records under <span className="font-mono">users/{user.uid}/isolation_probes</span>. Use this to confirm that separate guest or registered UIDs never share data, and that records created as a guest persist under the exact same UID after linking an account.
          </p>
        </div>

        <form onSubmit={handleCreateProbe} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <Database className="w-4 h-4 text-indigo-700 shrink-0" />
            <h2 className="font-display text-base font-semibold">
              Add Isolated Verification Record
            </h2>
          </div>

          {probeError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {probeError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="probe-label" className="block text-xs font-medium text-slate-700 mb-1">
                Verification Label
              </label>
              <input
                id="probe-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={160}
                placeholder="e.g., Guest A private record before account linking"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label htmlFor="probe-scope" className="block text-xs font-medium text-slate-700 mb-1">
                Verification Scope
              </label>
              <select
                id="probe-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as IsolationScope)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="isolation_check">Isolation Check</option>
                <option value="linking_preservation">Linking Preservation</option>
                <option value="session_continuity">Session Continuity</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Write to Private UID Namespace
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Records Owned by UID {user.uid}
              </h3>
              <p className="text-xs text-slate-500">
                {isolationProbes.length} isolated {isolationProbes.length === 1 ? 'record' : 'records'}
              </p>
            </div>
            <Lock className="w-4 h-4 text-slate-400" />
          </div>

          {isolationProbes.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No verification records in this UID namespace yet. Add one above to test session persistence and account linking continuity.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-3 px-6 font-medium">Label</th>
                    <th className="py-3 px-4 font-medium">Scope</th>
                    <th className="py-3 px-4 font-medium">Created Mode</th>
                    <th className="py-3 px-4 font-medium">Owner UID</th>
                    <th className="py-3 px-6 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isolationProbes.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-6 font-medium text-slate-900">{item.label}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.scope}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.createdUnderMode}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{item.uid}</td>
                      <td className="py-3 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteIsolationProbe(user, item.id)}
                          aria-label={`Delete ${item.label}`}
                          className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Live Security &amp; Rules Verification
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Execute live penetration probes against Firestore Security Rules and the Express Firebase Admin backend.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void runLiveSecurityChecks()}
          disabled={runningChecks}
          className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {runningChecks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run Live Security Probes
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-700" />
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Live Enforcement Matrix
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          {checks.map((check) => (
            <div key={check.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{check.name}</p>
                <p className="text-xs text-slate-500">Expected: {check.expected}</p>
                <p className="text-xs font-mono text-slate-600 break-all">{check.detail}</p>
              </div>
              <div className="shrink-0 text-xs font-medium">
                {check.status === 'passed' && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Passed
                  </span>
                )}
                {check.status === 'failed' && (
                  <span className="inline-flex items-center gap-1.5 text-red-700">
                    <XCircle className="w-4 h-4" />
                    Failed
                  </span>
                )}
                {check.status === 'idle' && (
                  <span className="text-slate-400">Ready</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Server-Verified Security Audit Log
            </h2>
            <p className="text-xs text-slate-500">
              Events logged for UID <span className="font-mono">{user.uid}</span> without storing tokens or passwords.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAudits()}
            disabled={loadingAudits}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-900 cursor-pointer"
          >
            Refresh Log
          </button>
        </div>

        {auditEvents.length === 0 ? (
          <div className="p-6 text-xs text-slate-500">
            No server audit events recorded in this runtime yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {auditEvents.map((ev) => (
              <div key={ev.id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <p className="font-mono font-medium text-slate-900">
                    {ev.eventType} · {ev.outcome}
                  </p>
                  <p className="text-slate-600">{ev.detail}</p>
                </div>
                <span className="font-mono text-slate-500 tabular-nums shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
