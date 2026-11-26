import { signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { ensureUserProfile } from './sessionService';
import { recordSecurityAuditEvent, verifySessionWithBackend } from '../security/authorization';
import type { UserProfile } from '../../types/auth';

export interface GuestSessionResult {
  user: User;
  profile: UserProfile;
  restoredExisting: boolean;
}

/**
 * Genuine Firebase Anonymous Authentication flow:
 * 1. Check whether a valid Firebase auth session already exists.
 * 2. Restore existing session if present (never create unnecessary duplicate UIDs).
 * 3. Otherwise invoke Firebase signInAnonymously(auth) to generate a unique Firebase UID.
 * 4. Initialize private Firestore profile with accountType = "guest".
 * 5. Verify session token with backend.
 */
export async function continueAsGuest(): Promise<GuestSessionResult> {
  let user = auth.currentUser;
  let restoredExisting = false;

  if (user) {
    restoredExisting = true;
  } else {
    const credential = await signInAnonymously(auth);
    user = credential.user;
  }

  const profile = await ensureUserProfile(user);
  await verifySessionWithBackend(user);
  await recordSecurityAuditEvent(
    user,
    restoredExisting ? 'session_restored' : 'guest_started',
    restoredExisting
      ? 'Restored existing authenticated session without creating a duplicate UID.'
      : 'Created isolated Firebase anonymous guest session.'
  );

  return {
    user,
    profile,
    restoredExisting
  };
}
