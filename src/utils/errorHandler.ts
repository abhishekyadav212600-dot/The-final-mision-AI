import type { AuthErrorInfo } from '../types/auth';
import { firebaseProjectId } from '../services/firebase/firebaseConfig';

export function mapAuthError(error: unknown, contextLabel?: string): AuthErrorInfo {
  const firebaseErr = error as { code?: string; message?: string };
  const code = firebaseErr?.code || 'auth/unknown';
  const consoleAuthUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;

  switch (code) {
    case 'auth/network-request-failed':
      return {
        code,
        title: 'Network Unavailable',
        message: 'Unable to reach authentication servers. Check your internet connection and try again.',
        recoverable: true
      };
    case 'auth/invalid-email':
      return {
        code,
        title: 'Invalid Email Address',
        message: 'Please enter a valid email address (for example, name@domain.com).',
        recoverable: true
      };
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return {
        code,
        title: 'Incorrect Credentials',
        message: 'The email or password you entered could not be verified. Check your credentials or reset your password.',
        recoverable: true
      };
    case 'auth/user-not-found':
      return {
        code,
        title: 'Account Not Found',
        message: 'No account matches that email address. Create a new account or continue as a guest.',
        recoverable: true
      };
    case 'auth/weak-password':
      return {
        code,
        title: 'Password Too Weak',
        message: 'Use at least 8 characters including uppercase, lowercase, a number, and a symbol.',
        recoverable: true
      };
    case 'auth/email-already-in-use':
      return {
        code,
        title: 'Email Already Registered',
        message: 'An account with this email already exists. Sign in to that account instead, or use a different email.',
        recoverable: true
      };
    case 'auth/credential-already-in-use':
      return {
        code,
        title: 'Account Conflict Detected',
        message: 'This external credential is already associated with another MISSION AI account. Your current guest data remains safe and untouched.',
        recoverable: true
      };
    case 'auth/provider-already-linked':
      return {
        code,
        title: 'Provider Already Linked',
        message: 'This sign-in provider is already connected to your current account.',
        recoverable: true
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        title: 'Sign-In Cancelled',
        message: 'The authentication window was closed before completion. You can try again whenever ready.',
        recoverable: true
      };
    case 'auth/popup-blocked':
      return {
        code,
        title: 'Pop-up Blocked by Browser',
        message: 'Your browser blocked the sign-in window. Allow pop-ups for this site and retry.',
        recoverable: true
      };
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
    case 'auth/configuration-not-found':
      return {
        code,
        title: `${contextLabel || 'Sign-In Provider'} Not Enabled`,
        message: `This sign-in method is not enabled yet in Firebase Authentication for project "${firebaseProjectId}".`,
        recoverable: true,
        guidance: `Open Firebase Console (${consoleAuthUrl}), navigate to Authentication -> Sign-in method, and enable ${contextLabel || 'this provider'} (Anonymous, Email/Password, Google, Apple, or Microsoft).`
      };
    case 'auth/requires-recent-login':
      return {
        code,
        title: 'Recent Authentication Required',
        message: 'For your security, please reauthenticate your session before completing this sensitive action.',
        recoverable: true
      };
    case 'auth/too-many-requests':
      return {
        code,
        title: 'Too Many Attempts',
        message: 'Access has been temporarily rate-limited due to repeated attempts. Please wait a few minutes before retrying.',
        recoverable: true
      };
    case 'auth/user-disabled':
      return {
        code,
        title: 'Account Disabled',
        message: 'This account has been disabled. Contact support if you believe this is an error.',
        recoverable: false
      };
    case 'auth/invalid-user-token':
    case 'auth/user-token-expired':
      return {
        code,
        title: 'Session Expired',
        message: 'Your authentication token has expired. Please sign in again to continue.',
        recoverable: true
      };
    case 'auth/app-not-authorized':
    case 'auth/unauthorized-domain':
      return {
        code,
        title: 'Domain Authorization Required',
        message: 'This preview domain must be listed under Authorized Domains in Firebase Authentication settings.',
        recoverable: true,
        guidance: `Add the current host (${window.location.hostname}) in Firebase Console -> Authentication -> Settings -> Authorized domains.`
      };
    default:
      return {
        code,
        title: 'Authentication Error',
        message: 'Unable to complete authentication right now. Please check your connection and try again.',
        recoverable: true
      };
  }
}
