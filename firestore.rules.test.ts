import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createApp } from './server';
import {
  isValidFirebaseId,
  sanitizeDisplayName,
  sanitizeProbeLabel,
  validateEmail,
  validatePasswordStrength
} from './src/services/security/validation';

async function runTests() {
  console.log('Running MISSION AI Phase 01 Security & Verification Suite...');

  // 1. Validate blueprint-synchronized input guards
  assert.equal(isValidFirebaseId('guest_uid_001'), true);
  assert.equal(isValidFirebaseId('bad/path/uid'), false);
  assert.equal(isValidFirebaseId('bad$uid!'), false);
  assert.equal(isValidFirebaseId('a'.repeat(129)), false);

  assert.equal(validateEmail('user@example.com').valid, true);
  assert.equal(validateEmail('invalid-email').valid, false);
  assert.equal(validateEmail('').valid, false);

  assert.equal(validatePasswordStrength('weak').valid, false);
  assert.equal(validatePasswordStrength('StrongPass!123').valid, true);
  assert.equal(sanitizeDisplayName('  Alex  ').length, 4);
  assert.equal(sanitizeProbeLabel('x'.repeat(200)).length, 160);
  console.log('  [PASS] Blueprint input validation & boundary guards');

  // 2. Verify Firestore Security Rules enforce all Dirty Dozen & Eight Pillars invariants
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesText, /allow list: if false;/);
  assert.match(rulesText, /function isValidUserProfile\(data\)/);
  assert.match(rulesText, /function isValidUserSettings\(data\)/);
  assert.match(rulesText, /function isValidIsolationProbe\(data\)/);
  assert.match(rulesText, /request\.auth\.token\.firebase\.sign_in_provider == 'anonymous'/);
  assert.match(rulesText, /incoming\(\)\.uid == existing\(\)\.uid/);
  assert.match(rulesText, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rulesText, /existing\(\)\.accountStatus != 'deletion_pending'/);
  assert.match(rulesText, /resource\.data\.uid == request\.auth\.uid/);
  console.log('  [PASS] Firestore Security Rules structural invariants verified');

  // 3. Backend API Verification Tests (unauthenticated rejection, malformed token rejection, 404 API isolation)
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server port.');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Health endpoint
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { status: string };
    assert.equal(healthJson.status, 'ok');

    // TEST 8a: Protected endpoint without Authorization header -> 401 Unauthorized
    const noTokenRes = await fetch(`${baseUrl}/api/auth/verify-session`, { method: 'POST' });
    assert.equal(noTokenRes.status, 401);

    // TEST 8b: Protected endpoint with forged/invalid Bearer token -> 401 Unauthorized
    const badTokenRes = await fetch(`${baseUrl}/api/auth/verify-session`, {
      method: 'POST',
      headers: { Authorization: 'Bearer forged.invalid.jwt.token' }
    });
    assert.equal(badTokenRes.status, 401);

    // TEST 8c: Protected user namespace endpoint without token -> 401 Unauthorized
    const userRes = await fetch(`${baseUrl}/api/users/guest_uid_001/security-context`);
    assert.equal(userRes.status, 401);

    // TEST 8d: Deletion receipt without token -> 401 Unauthorized
    const delRes = await fetch(`${baseUrl}/api/users/guest_uid_001/deletion-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' })
    });
    assert.equal(delRes.status, 401);

    // Unknown API route returns JSON 404 (not SPA HTML)
    const missingRes = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(missingRes.status, 404);

    console.log('  [PASS] Backend Firebase ID token verification & unauthorized request rejection');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }

  console.log('All automated Phase 01 security checks passed.');
}

runTests().catch((err) => {
  console.error('Security verification suite failed:', err);
  process.exit(1);
});
