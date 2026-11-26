import type { User } from 'firebase/auth';
import type { BackendVerifiedSession, SecurityAuditEntry } from '../../types/auth';
import { isValidFirebaseId } from './validation';

async function getBearerHeaders(user: User): Promise<HeadersInit> {
  const idToken = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`
  };
}

export async function verifySessionWithBackend(user: User): Promise<BackendVerifiedSession> {
  const headers = await getBearerHeaders(user);
  const response = await fetch('/api/auth/verify-session', {
    method: 'POST',
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Token verification failed.' }));
    throw new Error(payload.message || 'Backend session verification failed.');
  }

  return response.json() as Promise<BackendVerifiedSession>;
}

export async function recordSecurityAuditEvent(
  user: User,
  eventType:
    | 'session_restored'
    | 'guest_started'
    | 'registered_signed_in'
    | 'provider_linked'
    | 'linking_conflict_blocked'
    | 'sign_out_initiated'
    | 'isolation_probe_verified'
    | 'account_deleted',
  detail: string
): Promise<void> {
  if (!isValidFirebaseId(user.uid)) return;
  try {
    const headers = await getBearerHeaders(user);
    await fetch(`/api/users/${encodeURIComponent(user.uid)}/audit-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventType, detail: detail.slice(0, 180) })
    });
  } catch {
    // Audit logging should never block primary auth flows if offline
  }
}

export async function fetchUserAuditEvents(user: User): Promise<SecurityAuditEntry[]> {
  const headers = await getBearerHeaders(user);
  const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}/audit-events`, {
    method: 'GET',
    headers
  });
  if (!response.ok) {
    throw new Error('Unable to load security audit events.');
  }
  const data = (await response.json()) as { events: SecurityAuditEntry[] };
  return data.events || [];
}

export async function recordDeletionReceipt(user: User): Promise<{ receiptId: string; deletedAt: string }> {
  const headers = await getBearerHeaders(user);
  const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}/deletion-receipt`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirmation: 'DELETE' })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Unable to record deletion receipt.' }));
    throw new Error(payload.message || 'Deletion receipt check failed.');
  }

  const data = (await response.json()) as { receipt: { receiptId: string; deletedAt: string } };
  return data.receipt;
}

export async function probeUnauthenticatedBackendCall(): Promise<{ status: number; rejected: boolean; message: string }> {
  const response = await fetch('/api/auth/verify-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const payload = await response.json().catch(() => ({ message: 'Unauthorized' }));
  return {
    status: response.status,
    rejected: response.status === 401,
    message: payload.message || 'Rejected unauthenticated request'
  };
}

export async function probeCrossUidBackendCall(
  user: User,
  foreignUid: string
): Promise<{ status: number; rejected: boolean; message: string }> {
  const headers = await getBearerHeaders(user);
  const response = await fetch(`/api/users/${encodeURIComponent(foreignUid)}/security-context`, {
    method: 'GET',
    headers
  });
  const payload = await response.json().catch(() => ({ message: 'Forbidden' }));
  return {
    status: response.status,
    rejected: response.status === 403,
    message: payload.message || 'Rejected cross-UID access'
  };
}
