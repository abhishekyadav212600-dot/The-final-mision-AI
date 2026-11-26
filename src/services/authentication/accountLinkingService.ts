import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  sendEmailVerification,
  updateProfile,
  type User
} from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrorHandler';
import { extractLinkedProviders } from './sessionService';
import { recordSecurityAuditEvent, verifySessionWithBackend } from '../security/authorization';
import { sanitizeDisplayName, validateEmail, validatePasswordStrength } from '../security/validation';
import type { LinkingConflictState, SupportedProviderId } from '../../types/auth';

export interface AccountLinkingOutcome {
  status: 'linked' | 'conflict';
  uidPreserved: boolean;
  originalUid: string;
  finalUid: string;
  linkedProviders?: SupportedProviderId[];
  conflict?: LinkingConflictState;
}

const PROVIDER_LABELS: Record<SupportedProviderId, string> = {
  'google.com': 'Google',
  'apple.com': 'Apple',
  'microsoft.com': 'Microsoft',
  password: 'Email & Password'
};

async function syncProfileAfterLink(user: User, originalUid: string): Promise<SupportedProviderId[]> {
  if (user.uid !== originalUid) {
    throw new Error('Security invariant violation: UID changed during credential linking.');
  }

  // Force token refresh so Firestore security rules observe the non-anonymous sign_in_provider claim
  await user.reload();
  await user.getIdToken(true);

  const linkedProviders = extractLinkedProviders(user);
  const userPath = `users/${user.uid}`;

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      accountType: 'registered',
      isAnonymous: false,
      displayName: user.displayName ? sanitizeDisplayName(user.displayName) : null,
      email: user.email ? user.email.slice(0, 254) : null,
      emailVerified: Boolean(user.emailVerified),
      photoURL: user.photoURL ? user.photoURL.slice(0, 512) : null,
      linkedProviders,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  await verifySessionWithBackend(user);
  await recordSecurityAuditEvent(
    user,
    'provider_linked',
    `Linked ${linkedProviders.join(', ')} while preserving UID ${user.uid}.`
  );

  return linkedProviders;
}

function isConflictError(code?: string): code is 'auth/credential-already-in-use' | 'auth/email-already-in-use' | 'auth/provider-already-linked' {
  return (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/email-already-in-use' ||
    code === 'auth/provider-already-linked'
  );
}

function buildConflictResult(
  user: User,
  providerId: SupportedProviderId,
  code: 'auth/credential-already-in-use' | 'auth/email-already-in-use' | 'auth/provider-already-linked',
  attemptedEmail: string | null = null
): AccountLinkingOutcome {
  const reason =
    code === 'auth/email-already-in-use'
      ? 'email-already-in-use'
      : code === 'auth/provider-already-linked'
        ? 'provider-already-linked'
        : 'credential-already-in-use';

  const message =
    reason === 'provider-already-linked'
      ? `${PROVIDER_LABELS[providerId]} is already linked to your current account.`
      : `This ${PROVIDER_LABELS[providerId]} credential already belongs to an existing registered MISSION AI account. To prevent data loss or unauthorized merging, your current guest session (${user.uid}) and all existing data remain untouched.`;

  return {
    status: 'conflict',
    uidPreserved: true,
    originalUid: user.uid,
    finalUid: user.uid,
    conflict: {
      providerId,
      providerLabel: PROVIDER_LABELS[providerId],
      attemptedEmail,
      currentGuestUid: user.uid,
      reason,
      message
    }
  };
}

export async function linkProviderPopup(
  user: User,
  providerId: 'google.com' | 'apple.com' | 'microsoft.com'
): Promise<AccountLinkingOutcome> {
  const originalUid = user.uid;

  let provider: GoogleAuthProvider | OAuthProvider;
  if (providerId === 'google.com') {
    const gProvider = new GoogleAuthProvider();
    gProvider.setCustomParameters({ prompt: 'select_account' });
    provider = gProvider;
  } else if (providerId === 'apple.com') {
    const aProvider = new OAuthProvider('apple.com');
    aProvider.addScope('email');
    aProvider.addScope('name');
    provider = aProvider;
  } else {
    const mProvider = new OAuthProvider('microsoft.com');
    mProvider.addScope('user.read');
    mProvider.setCustomParameters({ prompt: 'select_account' });
    provider = mProvider;
  }

  try {
    const result = await linkWithPopup(user, provider);
    const linkedProviders = await syncProfileAfterLink(result.user, originalUid);
    return {
      status: 'linked',
      uidPreserved: result.user.uid === originalUid,
      originalUid,
      finalUid: result.user.uid,
      linkedProviders
    };
  } catch (error) {
    const firebaseErr = error as { code?: string; customData?: { email?: string } };
    if (isConflictError(firebaseErr?.code)) {
      await recordSecurityAuditEvent(
        user,
        'linking_conflict_blocked',
        `Blocked duplicate/overwrite on ${providerId} (${firebaseErr.code}); preserved UID ${originalUid}.`
      );
      return buildConflictResult(
        user,
        providerId,
        firebaseErr.code,
        firebaseErr.customData?.email ?? null
      );
    }
    throw error;
  }
}

export async function linkEmailPasswordAccount(
  user: User,
  params: {
    email: string;
    password: string;
    confirmPassword: string;
    displayName?: string;
  }
): Promise<AccountLinkingOutcome> {
  const originalUid = user.uid;
  const emailCheck = validateEmail(params.email);
  if (!emailCheck.valid) {
    throw { code: 'auth/invalid-email', message: emailCheck.error };
  }

  const strength = validatePasswordStrength(params.password);
  if (!strength.valid) {
    throw { code: 'auth/weak-password', message: strength.errors.join(', ') };
  }

  if (params.password !== params.confirmPassword) {
    throw new Error('Password confirmation does not match.');
  }

  const credential = EmailAuthProvider.credential(emailCheck.normalized, params.password);

  try {
    const result = await linkWithCredential(user, credential);
    if (params.displayName && sanitizeDisplayName(params.displayName)) {
      await updateProfile(result.user, {
        displayName: sanitizeDisplayName(params.displayName)
      });
    }
    try {
      await sendEmailVerification(result.user);
    } catch {
      // Non-blocking if email dispatch is throttled
    }
    const linkedProviders = await syncProfileAfterLink(result.user, originalUid);
    return {
      status: 'linked',
      uidPreserved: result.user.uid === originalUid,
      originalUid,
      finalUid: result.user.uid,
      linkedProviders
    };
  } catch (error) {
    const firebaseErr = error as { code?: string };
    if (isConflictError(firebaseErr?.code)) {
      await recordSecurityAuditEvent(
        user,
        'linking_conflict_blocked',
        `Blocked email linking conflict (${firebaseErr.code}); preserved UID ${originalUid}.`
      );
      return buildConflictResult(user, 'password', firebaseErr.code, emailCheck.normalized);
    }
    throw error;
  }
}
