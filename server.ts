import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { createServer as createViteServer } from 'vite';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf-8')
);

if (!firebaseConfig.projectId || firebaseConfig.projectId === 'remixed-project-id') {
  throw new Error('Firebase projectId is not configured in firebase-applet-config.json.');
}

// Initialize Firebase Admin SDK with projectId only for ID token verification (requires zero IAM)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });

const adminAuth = getAuth(adminApp);

interface AuthenticatedRequest extends Request {
  authContext?: {
    uid: string;
    isAnonymous: boolean;
    signInProvider: string;
    email: string | null;
    emailVerified: boolean;
    authTime: number;
    issuedAt: number;
    expiresAt: number;
  };
}

interface SecurityAuditEntry {
  id: string;
  eventType: string;
  signInProvider: string;
  isAnonymous: boolean;
  timestamp: string;
  outcome: 'success' | 'blocked';
  detail: string;
}

interface DeletionAuditReceipt {
  receiptId: string;
  uidHash: string;
  deletedAt: string;
  accountTypeAtDeletion: 'guest' | 'registered';
  reason: string;
}

const UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const ALLOWED_AUDIT_EVENTS = new Set([
  'session_restored',
  'guest_started',
  'registered_signed_in',
  'provider_linked',
  'linking_conflict_blocked',
  'sign_out_initiated',
  'isolation_probe_verified',
  'account_deleted'
]);

// In-memory sliding window rate limiter store & bounded security event log
const rateLimitBuckets = new Map<string, number[]>();
const userAuditLogs = new Map<string, SecurityAuditEntry[]>();
const deletionReceipts: DeletionAuditReceipt[] = [];

function createRateLimiter(options: { windowMs: number; maxRequests: number; bucketPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.bucketPrefix}:${clientIp}`;
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const timestamps = (rateLimitBuckets.get(key) || []).filter((ts) => ts > cutoff);

    if (timestamps.length >= options.maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil(options.windowMs / 1000)));
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many authentication or security requests. Please wait a moment and try again.'
      });
      return;
    }

    timestamps.push(now);
    rateLimitBuckets.set(key, timestamps);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - timestamps.length)));
    next();
  };
}

function appendAuditLog(uid: string, entry: Omit<SecurityAuditEntry, 'id' | 'timestamp'>): SecurityAuditEntry {
  const fullEntry: SecurityAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
  const existing = userAuditLogs.get(uid) || [];
  const next = [fullEntry, ...existing].slice(0, 50);
  userAuditLogs.set(uid, next);
  return fullEntry;
}

async function verifyFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required. Missing or malformed Bearer ID token.'
    });
    return;
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 8192) {
    res.status(401).json({
      error: 'invalid_token_format',
      message: 'Invalid authentication token format.'
    });
    return;
  }

  try {
    const decoded: DecodedIdToken = await adminAuth.verifyIdToken(idToken);
    const signInProvider = decoded.firebase?.sign_in_provider || 'unknown';
    const isAnonymous = signInProvider === 'anonymous';

    if (!UID_REGEX.test(decoded.uid)) {
      res.status(401).json({
        error: 'invalid_uid',
        message: 'Authenticated user identifier failed structural validation.'
      });
      return;
    }

    req.authContext = {
      uid: decoded.uid,
      isAnonymous,
      signInProvider,
      email: typeof decoded.email === 'string' ? decoded.email : null,
      emailVerified: Boolean(decoded.email_verified),
      authTime: typeof decoded.auth_time === 'number' ? decoded.auth_time : 0,
      issuedAt: typeof decoded.iat === 'number' ? decoded.iat : 0,
      expiresAt: typeof decoded.exp === 'number' ? decoded.exp : 0
    };

    next();
  } catch (error) {
    const code = (error as { code?: string })?.code || '';
    const isExpired = code === 'auth/id-token-expired';
    res.status(401).json({
      error: isExpired ? 'token_expired' : 'invalid_token',
      message: isExpired
        ? 'Your authentication session has expired. Please refresh your session or sign in again.'
        : 'Unable to verify authentication token.'
    });
  }
}

function enforceUidOwnership(paramName = 'uid') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const callerUid = req.authContext?.uid;
    const requestedUid = req.params[paramName];

    if (!callerUid) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Missing verified caller identity.'
      });
      return;
    }

    if (!requestedUid || !UID_REGEX.test(requestedUid)) {
      res.status(400).json({
        error: 'invalid_resource_uid',
        message: 'Requested user identifier is invalid.'
      });
      return;
    }

    if (requestedUid !== callerUid) {
      appendAuditLog(callerUid, {
        eventType: 'cross_uid_access_blocked',
        signInProvider: req.authContext?.signInProvider || 'unknown',
        isAnonymous: Boolean(req.authContext?.isAnonymous),
        outcome: 'blocked',
        detail: 'Blocked request attempting to access a different UID namespace.'
      });
      res.status(403).json({
        error: 'forbidden_uid_mismatch',
        message: 'Access denied. Authenticated user does not own the requested resource.'
      });
      return;
    }

    if (req.body && typeof req.body === 'object' && 'uid' in req.body && req.body.uid !== callerUid) {
      res.status(403).json({
        error: 'forbidden_body_uid_mismatch',
        message: 'Access denied. Request body UID does not match authenticated token.'
      });
      return;
    }

    next();
  };
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));

  // Security headers (iframe-compatible without X-Frame-Options)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const authRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
    bucketPrefix: 'auth'
  });

  const sensitiveActionLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 25,
    bucketPrefix: 'sensitive'
  });

  // Public service readiness check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'mission-ai-auth-security',
      projectId: firebaseConfig.projectId
    });
  });

  // Protected: Verify Firebase ID token via Admin SDK
  app.post('/api/auth/verify-session', authRateLimiter, verifyFirebaseAuth, (req: AuthenticatedRequest, res) => {
    const ctx = req.authContext!;
    res.json({
      verified: true,
      uid: ctx.uid,
      accountType: ctx.isAnonymous ? 'guest' : 'registered',
      isAnonymous: ctx.isAnonymous,
      signInProvider: ctx.signInProvider,
      email: ctx.email,
      emailVerified: ctx.emailVerified,
      issuedAt: ctx.issuedAt,
      expiresAt: ctx.expiresAt,
      verifiedAt: new Date().toISOString()
    });
  });

  // Protected: Read caller-owned security context (enforces UID ownership)
  app.get(
    '/api/users/:uid/security-context',
    authRateLimiter,
    verifyFirebaseAuth,
    enforceUidOwnership('uid'),
    (req: AuthenticatedRequest, res) => {
      const ctx = req.authContext!;
      res.json({
        uid: ctx.uid,
        accountType: ctx.isAnonymous ? 'guest' : 'registered',
        isAnonymous: ctx.isAnonymous,
        signInProvider: ctx.signInProvider,
        emailVerified: ctx.emailVerified,
        isolationPolicy: 'strict_uid_ownership',
        guestRetentionPolicy: {
          inactiveRetentionDays: 90,
          autoMigrationEnabled: false,
          recoveryRequiresLinkedProvider: true
        },
        recentAuditCount: (userAuditLogs.get(ctx.uid) || []).length
      });
    }
  );

  // Protected: Record validated security audit event (sanitized, zero PII/tokens)
  app.post(
    '/api/users/:uid/audit-event',
    authRateLimiter,
    verifyFirebaseAuth,
    enforceUidOwnership('uid'),
    (req: AuthenticatedRequest, res) => {
      const ctx = req.authContext!;
      const { eventType, detail } = (req.body || {}) as { eventType?: unknown; detail?: unknown };

      if (typeof eventType !== 'string' || !ALLOWED_AUDIT_EVENTS.has(eventType)) {
        res.status(400).json({
          error: 'invalid_event_type',
          message: 'Unsupported security audit event type.'
        });
        return;
      }

      const safeDetail =
        typeof detail === 'string' ? detail.trim().slice(0, 180) : 'Authenticated security event recorded.';

      const entry = appendAuditLog(ctx.uid, {
        eventType,
        signInProvider: ctx.signInProvider,
        isAnonymous: ctx.isAnonymous,
        outcome: eventType === 'linking_conflict_blocked' ? 'blocked' : 'success',
        detail: safeDetail
      });

      res.status(201).json({ recorded: true, entry });
    }
  );

  // Protected: Read caller's own audit log
  app.get(
    '/api/users/:uid/audit-events',
    authRateLimiter,
    verifyFirebaseAuth,
    enforceUidOwnership('uid'),
    (req: AuthenticatedRequest, res) => {
      const ctx = req.authContext!;
      res.json({
        uid: ctx.uid,
        events: userAuditLogs.get(ctx.uid) || []
      });
    }
  );

  // Protected: Record anonymized account deletion receipt (retains zero PII)
  app.post(
    '/api/users/:uid/deletion-receipt',
    sensitiveActionLimiter,
    verifyFirebaseAuth,
    enforceUidOwnership('uid'),
    (req: AuthenticatedRequest, res) => {
      const ctx = req.authContext!;
      const { confirmation } = (req.body || {}) as { confirmation?: unknown };

      if (confirmation !== 'DELETE') {
        res.status(400).json({
          error: 'confirmation_required',
          message: 'Explicit confirmation value "DELETE" is required.'
        });
        return;
      }

      // One-way SHA-256 hash of UID for anonymized audit compliance without retaining PII
      const uidHash = crypto.createHash('sha256').update(ctx.uid).digest('hex').slice(0, 24);
      const receipt: DeletionAuditReceipt = {
        receiptId: crypto.randomUUID(),
        uidHash,
        deletedAt: new Date().toISOString(),
        accountTypeAtDeletion: ctx.isAnonymous ? 'guest' : 'registered',
        reason: 'user_initiated_account_deletion'
      };

      deletionReceipts.push(receipt);
      if (deletionReceipts.length > 500) {
        deletionReceipts.shift();
      }
      userAuditLogs.delete(ctx.uid);

      res.status(201).json({
        recorded: true,
        receipt
      });
    }
  );

  // Protected API fallback (prevent falling through to SPA HTML on unknown /api routes)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: 'API endpoint not found.'
    });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`MISSION AI authentication server listening on port ${port}`);
  });
}

// Start server only when executed directly (allows importing createApp in automated security tests)
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start MISSION AI server:', err);
    process.exit(1);
  });
}
