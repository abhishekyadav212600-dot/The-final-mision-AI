import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, where, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../services/firebase/firebaseConfig';
import { initializeMissionAppCheck, type AppCheckStatus } from '../services/firebase/appCheck';
import { handleFirestoreError, OperationType } from '../services/firebase/firestoreErrorHandler';
import { ensureUserProfile } from '../services/authentication/sessionService';
import { recordSecurityAuditEvent, verifySessionWithBackend } from '../services/security/authorization';
import type {
  AuthErrorInfo,
  BackendVerifiedSession,
  IsolationProbeRecord,
  UserPrivateSettings,
  UserProfile
} from '../types/auth';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  settings: UserPrivateSettings | null;
  isolationProbes: IsolationProbeRecord[];
  backendSession: BackendVerifiedSession | null;
  appCheckStatus: AppCheckStatus;
  authReady: boolean;
  isLoadingProfile: boolean;
  authError: AuthErrorInfo | null;
  setAuthError: (err: AuthErrorInfo | null) => void;
  refreshBackendSession: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserPrivateSettings | null>(null);
  const [isolationProbes, setIsolationProbes] = useState<IsolationProbeRecord[]>([]);
  const [backendSession, setBackendSession] = useState<BackendVerifiedSession | null>(null);
  const [appCheckStatus, setAppCheckStatus] = useState<AppCheckStatus>(() => initializeMissionAppCheck());
  const [authReady, setAuthReady] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const listenersRef = useRef<Unsubscribe[]>([]);
  const restoredAuditRef = useRef<string | null>(null);

  const clearPrivateStateAndListeners = useCallback(() => {
    for (const unsub of listenersRef.current) {
      unsub();
    }
    listenersRef.current = [];
    setProfile(null);
    setSettings(null);
    setIsolationProbes([]);
    setBackendSession(null);
    restoredAuditRef.current = null;
  }, []);

  const refreshBackendSession = useCallback(async () => {
    const activeUser = auth.currentUser;
    if (!activeUser) {
      setBackendSession(null);
      return;
    }
    try {
      const verified = await verifySessionWithBackend(activeUser);
      setBackendSession(verified);
    } catch {
      // Keep existing state if transient network failure occurs
    }
  }, []);

  const refreshUserSession = useCallback(async () => {
    const activeUser = auth.currentUser;
    if (!activeUser) return;
    await activeUser.reload();
    await activeUser.getIdToken(true);
    setUser(auth.currentUser);
    await refreshBackendSession();
  }, [refreshBackendSession]);

  useEffect(() => {
    setAppCheckStatus(initializeMissionAppCheck());

    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        clearPrivateStateAndListeners();
        setAuthReady(true);
        setIsLoadingProfile(false);
        return;
      }

      setUser(firebaseUser);
      setIsLoadingProfile(true);

      // Tear down any previous UID listeners before attaching new UID-scoped listeners
      for (const unsub of listenersRef.current) {
        unsub();
      }
      listenersRef.current = [];

      try {
        await ensureUserProfile(firebaseUser);
        const verified = await verifySessionWithBackend(firebaseUser);
        setBackendSession(verified);

        if (restoredAuditRef.current !== firebaseUser.uid) {
          restoredAuditRef.current = firebaseUser.uid;
          await recordSecurityAuditEvent(
            firebaseUser,
            'session_restored',
            firebaseUser.isAnonymous
              ? 'Anonymous guest session verified and restored.'
              : 'Registered user session verified and restored.'
          );
        }

        const userPath = `users/${firebaseUser.uid}`;
        const unsubProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile);
            } else {
              setProfile(null);
            }
            setIsLoadingProfile(false);
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, userPath);
          }
        );

        const settingsPath = `users/${firebaseUser.uid}/private/settings`;
        const unsubSettings = onSnapshot(
          doc(db, 'users', firebaseUser.uid, 'private', 'settings'),
          (snap) => {
            if (snap.exists()) {
              setSettings(snap.data() as UserPrivateSettings);
            } else {
              setSettings(null);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, settingsPath);
          }
        );

        const probesPath = `users/${firebaseUser.uid}/isolation_probes`;
        const probesQuery = query(
          collection(db, 'users', firebaseUser.uid, 'isolation_probes'),
          where('uid', '==', firebaseUser.uid),
          orderBy('createdAt', 'desc')
        );
        const unsubProbes = onSnapshot(
          probesQuery,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<IsolationProbeRecord, 'id'>)
            }));
            setIsolationProbes(list);
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, probesPath);
          }
        );

        listenersRef.current = [unsubProfile, unsubSettings, unsubProbes];
      } catch (err) {
        setIsLoadingProfile(false);
        const message = err instanceof Error ? err.message : 'Failed to initialize user session.';
        setAuthError({
          code: 'session/init-error',
          title: 'Session Initialization Issue',
          message,
          recoverable: true
        });
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      clearPrivateStateAndListeners();
    };
  }, [clearPrivateStateAndListeners]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        settings,
        isolationProbes,
        backendSession,
        appCheckStatus,
        authReady,
        isLoadingProfile,
        authError,
        setAuthError,
        refreshBackendSession,
        refreshUserSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
