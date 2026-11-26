import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { ensureUserProfile } from './sessionService';
import { recordSecurityAuditEvent, verifySessionWithBackend } from '../security/authorization';
import { sanitizeDisplayName, validateEmail, validatePasswordStrength } from '../security/validation';
import type { UserProfile } from '../../types/auth';

export interface AuthActionResult {
  user: User;
  profile: UserProfile;
  isNewRegistration?: boolean;
}

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  const profile = await ensureUserProfile(credential.user);
  await verifySessionWithBackend(credential.user);
  await recordSecurityAuditEvent(
    credential.user,
    'registered_signed_in',
    'Authenticated with Google OAuth provider.'
  );
  return { user: credential.user, profile };
}

export async function signInWithApple(): Promise<AuthActionResult> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const credential = await signInWithPopup(auth, provider);
  const profile = await ensureUserProfile(credential.user);
  await verifySessionWithBackend(credential.user);
  await recordSecurityAuditEvent(
    credential.user,
    'registered_signed_in',
    'Authenticated with Apple Sign-In provider.'
  );
  return { user: credential.user, profile };
}

export async function signInWithMicrosoft(): Promise<AuthActionResult> {
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('user.read');
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  const profile = await ensureUserProfile(credential.user);
  await verifySessionWithBackend(credential.user);
  await recordSecurityAuditEvent(
    credential.user,
    'registered_signed_in',
    'Authenticated with Microsoft OAuth provider.'
  );
  return { user: credential.user, profile };
}

export async function registerWithEmail(params: {
  email: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}): Promise<AuthActionResult> {
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

  const credential = await createUserWithEmailAndPassword(auth, emailCheck.normalized, params.password);

  if (params.displayName && sanitizeDisplayName(params.displayName)) {
    await updateProfile(credential.user, {
      displayName: sanitizeDisplayName(params.displayName)
    });
  }

  try {
    await sendEmailVerification(credential.user);
  } catch {
    // Do not block registration if verification dispatch encounters a transient throttle
  }

  const profile = await ensureUserProfile(credential.user);
  await verifySessionWithBackend(credential.user);
  await recordSecurityAuditEvent(
    credential.user,
    'registered_signed_in',
    'Created registered email/password account and dispatched verification email.'
  );

  return { user: credential.user, profile, isNewRegistration: true };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthActionResult> {
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    throw { code: 'auth/invalid-email', message: emailCheck.error };
  }
  if (!password) {
    throw { code: 'auth/wrong-password', message: 'Password is required.' };
  }

  const credential = await signInWithEmailAndPassword(auth, emailCheck.normalized, password);
  const profile = await ensureUserProfile(credential.user);
  await verifySessionWithBackend(credential.user);
  await recordSecurityAuditEvent(
    credential.user,
    'registered_signed_in',
    'Signed in with verified email/password credentials.'
  );

  return { user: credential.user, profile };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    throw { code: 'auth/invalid-email', message: emailCheck.error };
  }
  await sendPasswordResetEmail(auth, emailCheck.normalized);
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}
