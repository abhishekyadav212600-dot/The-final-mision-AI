import {
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  setPersistence,
  signOut,
  type User
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';
import { handleFirestoreError, OperationType } from '../firebase/firestoreErrorHandler';
import type {
  IsolationProbeRecord,
  IsolationScope,
  SessionPersistenceMode,
  SupportedProviderId,
  UserPrivateSettings,
  UserProfile
} from '../../types/auth';
import {
  isValidFirebaseId,
  sanitizeDisplayName,
  sanitizeProbeLabel
} from '../security/validation';
import { recordDeletionReceipt, recordSecurityAuditEvent } from '../security/authorization';

const ALLOWED_PROVIDERS: SupportedProviderId[] = [
  'google.com',
  'apple.com',
  'microsoft.com',
  'password'
];

export function extractLinkedProviders(user: User): SupportedProviderId[] {
  const providers = new Set<SupportedProviderId>();
  for (const info of user.providerData || []) {
    if (ALLOWED_PROVIDERS.includes(info.providerId as SupportedProviderId)) {
      providers.add(info.providerId as SupportedProviderId);
    }
  }
  return Array.from(providers);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  if (!isValidFirebaseId(user.uid)) {
    throw new Error('Invalid Firebase user identifier.');
  }

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const linkedProviders = user.isAnonymous ? [] : extractLinkedProviders(user);

  if (!existingSnap.exists()) {
    const newProfilePayload = {
      uid: user.uid,
      accountType: user.isAnonymous ? 'guest' : 'registered',
      isAnonymous: user.isAnonymous,
      displayName: user.displayName ? sanitizeDisplayName(user.displayName) : null,
      email: user.email ? user.email.slice(0, 254) : null,
      emailVerified: Boolean(user.emailVerified),
      photoURL: user.photoURL ? user.photoURL.slice(0, 512) : null,
      onboardingCompleted: false,
      linkedProviders,
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(userRef, newProfilePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    const settingsPath = `users/${user.uid}/private/settings`;
    const settingsRef = doc(db, 'users', user.uid, 'private', 'settings');
    try {
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) {
        await setDoc(settingsRef, {
          uid: user.uid,
          sessionPersistence: 'local',
          dataRetentionNoticeSeen: false,
          securityNotifications: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, settingsPath);
    }

    let createdSnap;
    try {
      createdSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }
    return createdSnap.data() as UserProfile;
  }

  // Ensure private settings document exists even if user profile existed beforehand
  const settingsPath = `users/${user.uid}/private/settings`;
  const settingsRef = doc(db, 'users', user.uid, 'private', 'settings');
  try {
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        uid: user.uid,
        sessionPersistence: 'local',
        dataRetentionNoticeSeen: false,
        securityNotifications: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, settingsPath);
  }

  return existingSnap.data() as UserProfile;
}

export async function updateDisplayName(user: User, displayName: string): Promise<void> {
  const sanitized = sanitizeDisplayName(displayName);
  const userPath = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: sanitized || null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function updatePrivateSettings(
  user: User,
  updates: Partial<Pick<UserPrivateSettings, 'sessionPersistence' | 'dataRetentionNoticeSeen' | 'securityNotifications'>>
): Promise<void> {
  if (updates.sessionPersistence) {
    const persistence =
      updates.sessionPersistence === 'session'
        ? browserSessionPersistence
        : browserLocalPersistence;
    await setPersistence(auth, persistence);
  }

  const settingsPath = `users/${user.uid}/private/settings`;
  try {
    await updateDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, settingsPath);
  }
}

export async function configureSessionPersistence(mode: SessionPersistenceMode): Promise<void> {
  await setPersistence(
    auth,
    mode === 'session' ? browserSessionPersistence : browserLocalPersistence
  );
}

export async function createIsolationProbe(
  user: User,
  label: string,
  scope: IsolationScope
): Promise<void> {
  const cleanLabel = sanitizeProbeLabel(label);
  if (!cleanLabel) {
    throw new Error('Verification record label cannot be empty.');
  }
  const probeId = `probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const probePath = `users/${user.uid}/isolation_probes/${probeId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'isolation_probes', probeId), {
      uid: user.uid,
      label: cleanLabel,
      scope,
      createdUnderMode: user.isAnonymous ? 'guest' : 'registered',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await recordSecurityAuditEvent(
      user,
      'isolation_probe_verified',
      `Created UID-isolated verification record (${scope}).`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, probePath);
  }
}

export async function deleteIsolationProbe(user: User, probeId: string): Promise<void> {
  if (!isValidFirebaseId(probeId)) {
    throw new Error('Invalid probe identifier.');
  }
  const probePath = `users/${user.uid}/isolation_probes/${probeId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'isolation_probes', probeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, probePath);
  }
}

export async function listUserIsolationProbes(user: User): Promise<IsolationProbeRecord[]> {
  const probesPath = `users/${user.uid}/isolation_probes`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'isolation_probes'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<IsolationProbeRecord, 'id'>)
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, probesPath);
  }
}

export async function signOutUser(user: User | null): Promise<void> {
  if (user) {
    await recordSecurityAuditEvent(
      user,
      'sign_out_initiated',
      user.isAnonymous
        ? 'Guest session signed out (Firestore records preserved under UID).'
        : 'Registered session signed out cleanly.'
    );
  }
  await signOut(auth);
}

export async function reauthenticateWithPassword(user: User, password: string): Promise<void> {
  if (!user.email) {
    throw new Error('No email address is associated with this account.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export async function reauthenticateWithProviderPopup(
  user: User,
  providerId: 'google.com' | 'apple.com' | 'microsoft.com'
): Promise<void> {
  if (providerId === 'google.com') {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await reauthenticateWithPopup(user, provider);
    return;
  }
  if (providerId === 'apple.com') {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    await reauthenticateWithPopup(user, provider);
    return;
  }
  const provider = new OAuthProvider('microsoft.com');
  provider.setCustomParameters({ prompt: 'select_account' });
  await reauthenticateWithPopup(user, provider);
}

export async function deleteCurrentAccount(user: User): Promise<{ receiptId: string }> {
  const uid = user.uid;

  // Step 1: Lock profile status as deletion_pending before cascading cleanup
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      accountStatus: 'deletion_pending',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  // Step 2: Delete all user-owned isolation probe records
  const probesPath = `users/${uid}/isolation_probes`;
  try {
    const q = query(collection(db, 'users', uid, 'isolation_probes'), where('uid', '==', uid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, probesPath);
  }

  // Step 3: Delete user-owned private settings
  const privatePath = `users/${uid}/private`;
  try {
    const q = query(collection(db, 'users', uid, 'private'), where('uid', '==', uid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, privatePath);
  }

  // Step 4: Record anonymized deletion receipt on backend before revoking Auth user
  const receipt = await recordDeletionReceipt(user);

  // Step 5: Delete root user profile document
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }

  // Step 6: Permanently delete Firebase Auth user record
  await deleteUser(user);

  return { receiptId: receipt.receiptId };
}
