# MISSION AI — Phase 01 Security Specification

## 1. Data Invariants
1. **Strict UID Ownership**: Every document under `/users/{uid}` and all subcollections (`/users/{uid}/private/{docId}`, `/users/{uid}/isolation_probes/{probeId}`) is strictly readable and writable only when `request.auth != null && request.auth.uid == uid`.
2. **Provider-Verified Account Classification**: An anonymous session (`request.auth.token.firebase.sign_in_provider == 'anonymous'`) can ONLY store `accountType == 'guest'` and `isAnonymous == true`. A registered session (`sign_in_provider != 'anonymous'`) can ONLY store `accountType == 'registered'` and `isAnonymous == false`.
3. **No Privilege Escalation / Shadow Fields**: Documents under `/users/{uid}` enforce `keys().hasAll(...)` and `keys().hasOnly(...)` so clients cannot inject `role`, `isAdmin`, `tier`, or arbitrary shadow fields.
4. **Immutable Ownership & Temporal Integrity**: `uid` and `createdAt` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on create/update.
5. **Terminal Deletion Lock**: Once `accountStatus` transitions to `'deletion_pending'`, further profile mutations are blocked.
6. **Master Gate Sync**: Subcollection creation (`private`, `isolation_probes`) requires the parent `/users/{uid}` document to exist.
7. **Zero Public Listing**: Listing `/users` is globally denied (`allow list: if false`); subcollection `allow list` explicitly checks `resource.data.uid == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-UID Read**: Authenticated as `uid_A`, attempt `get(/users/uid_B)` -> `PERMISSION_DENIED`.
2. **Cross-UID Subcollection Write**: Authenticated as `uid_A`, attempt `set(/users/uid_B/isolation_probes/p1, { uid: 'uid_A', ... })` -> `PERMISSION_DENIED`.
3. **Guest Privilege Spoofing**: Authenticated anonymously (`sign_in_provider == 'anonymous'`), attempt `set(/users/uid_A, { accountType: 'registered', isAnonymous: false, ... })` -> `PERMISSION_DENIED`.
4. **Admin Escalation (Shadow Field)**: Authenticated as `uid_A`, attempt `update(/users/uid_A, { isAdmin: true, role: 'superadmin', updatedAt: SERVER_TIME })` -> `PERMISSION_DENIED`.
5. **UID Mutation**: Authenticated as `uid_A`, attempt `update(/users/uid_A, { uid: 'uid_B', updatedAt: SERVER_TIME })` -> `PERMISSION_DENIED`.
6. **CreatedAt Forgery**: Authenticated as `uid_A`, attempt `set(/users/uid_A, { ..., createdAt: pastTimestamp })` -> `PERMISSION_DENIED`.
7. **Unbounded String / Denial of Wallet**: Authenticated as `uid_A`, attempt `set(/users/uid_A/isolation_probes/p1, { label: <10KB string>, ... })` -> `PERMISSION_DENIED`.
8. **Malformed Path ID Poisoning**: Attempt `set(/users/uid_A/isolation_probes/bad$id..slash, ...)` -> `PERMISSION_DENIED`.
9. **Blanket Collection Scrape**: Authenticated as `uid_A`, attempt `list(/users)` -> `PERMISSION_DENIED`.
10. **Terminal State Bypass**: After `accountStatus == 'deletion_pending'`, attempt `update(/users/uid_A, { displayName: 'Back', updatedAt: SERVER_TIME })` -> `PERMISSION_DENIED`.
11. **Unauthenticated Access**: With `request.auth == null`, attempt any read or write on `/users/{uid}` -> `PERMISSION_DENIED`.
12. **Provider Array Overflow / Type Poisoning**: Attempt `update(/users/uid_A, { linkedProviders: [12345], ... })` or `> 10` items -> `PERMISSION_DENIED`.
