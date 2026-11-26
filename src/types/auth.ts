import type { Timestamp } from 'firebase/firestore';

export type AccountType = 'guest' | 'registered';
export type AccountStatus = 'active' | 'deletion_pending';
export type SupportedProviderId = 'google.com' | 'apple.com' | 'microsoft.com' | 'password';
export type SessionPersistenceMode = 'local' | 'session';
export type IsolationScope = 'isolation_check' | 'linking_preservation' | 'session_continuity';

export interface UserProfile {
  uid: string;
  accountType: AccountType;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  onboardingCompleted: boolean;
  linkedProviders: SupportedProviderId[];
  accountStatus: AccountStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserPrivateSettings {
  uid: string;
  sessionPersistence: SessionPersistenceMode;
  dataRetentionNoticeSeen: boolean;
  securityNotifications: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface IsolationProbeRecord {
  id: string;
  uid: string;
  label: string;
  scope: IsolationScope;
  createdUnderMode: AccountType;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BackendVerifiedSession {
  verified: boolean;
  uid: string;
  accountType: AccountType;
  isAnonymous: boolean;
  signInProvider: string;
  email: string | null;
  emailVerified: boolean;
  issuedAt: number;
  expiresAt: number;
  verifiedAt: string;
}

export interface SecurityAuditEntry {
  id: string;
  eventType: string;
  signInProvider: string;
  isAnonymous: boolean;
  timestamp: string;
  outcome: 'success' | 'blocked';
  detail: string;
}

export interface AuthErrorInfo {
  code: string;
  title: string;
  message: string;
  recoverable: boolean;
  guidance?: string;
}

export interface LinkingConflictState {
  providerId: SupportedProviderId;
  providerLabel: string;
  attemptedEmail: string | null;
  currentGuestUid: string;
  reason: 'credential-already-in-use' | 'email-already-in-use' | 'provider-already-linked';
  message: string;
}
