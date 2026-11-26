import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { firebaseApp, recaptchaSiteKey } from './firebaseConfig';

export interface AppCheckStatus {
  enabled: boolean;
  provider: 'recaptcha_v3' | 'not_configured';
  message: string;
}

let appCheckInstance: AppCheck | null = null;
let cachedStatus: AppCheckStatus = {
  enabled: false,
  provider: 'not_configured',
  message: 'App Check activates automatically when a reCAPTCHA v3 site key is configured in Firebase.'
};

export function initializeMissionAppCheck(): AppCheckStatus {
  if (appCheckInstance) {
    return cachedStatus;
  }

  const envSiteKey = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FIREBASE_APP_CHECK_SITE_KEY;
  const siteKey = (envSiteKey || recaptchaSiteKey || '').trim();

  if (!siteKey) {
    cachedStatus = {
      enabled: false,
      provider: 'not_configured',
      message: 'App Check key not yet configured. Backend ID token verification and rate limiting remain active.'
    };
    return cachedStatus;
  }

  try {
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
    cachedStatus = {
      enabled: true,
      provider: 'recaptcha_v3',
      message: 'Firebase App Check (reCAPTCHA v3) is active and auto-refreshing attestation tokens.'
    };
  } catch {
    cachedStatus = {
      enabled: false,
      provider: 'not_configured',
      message: 'App Check initialization skipped in current preview context; server token verification active.'
    };
  }

  return cachedStatus;
}

export function getAppCheckStatus(): AppCheckStatus {
  return cachedStatus;
}
