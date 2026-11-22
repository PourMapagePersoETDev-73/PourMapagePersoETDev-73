# Security Specification — EuroQuant & Tableau de Bord Personnel

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: Every user profile (`/users/{userId}`), tracked web app (`/users/{userId}/apps/{appId}`), and saved EuroMillions grid (`/users/{userId}/savedGrids/{gridId}`) is strictly private to the authenticated, email-verified user whose `request.auth.uid == userId`.
2. **Identity Integrity**: Every document's `uid` or `ownerId` MUST match both the path `{userId}` and `request.auth.uid`, and is immutable after creation.
3. **Strict Key & Boundary Limits**: Every write uses `keys().hasAll(...) && keys().hasOnly(...)` on `create` and `affectedKeys().hasOnly(...)` on `update` alongside `isValid*` schema/size guards.
4. **Server Timestamps**: `createdAt` and `updatedAt` must equal `request.time`; `createdAt` is immutable on update.
5. **Path Variable Hardening**: All `{userId}`, `{appId}`, and `{gridId}` IDs must satisfy `^[a-zA-Z0-9_\-]+$` and length `<= 128`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: Any request with `request.auth == null` -> DENIED.
2. **Unverified email write**: `request.auth.token.email_verified == false` attempting to create an app -> DENIED.
3. **Cross-user read (PII leak)**: User A (`uid_A`) attempting `get` or `list` on `/users/uid_B` or `/users/uid_B/apps` -> DENIED.
4. **Identity spoofing on create**: User A creating `/users/uid_A/apps/app1` with `{ ownerId: "uid_B", ... }` -> DENIED.
5. **Shadow / Ghost field injection**: Creating a `TrackedApp` with extra field `{ isAdmin: true }` -> DENIED (`hasOnly` rejects).
6. **ID Poisoning**: Creating `/users/uid_A/apps/invalid$id..with.spaces` -> DENIED (`isValidId` rejects).
7. **Oversized string DoW**: Creating a `TrackedApp` with `notes` of 5,000 characters (`> 500`) -> DENIED.
8. **Invalid enum value**: Creating a `TrackedApp` with `status: "hacked"` -> DENIED.
9. **Client-forged timestamp**: Creating a `TrackedApp` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED.
10. **Immutable field mutation**: Updating `ownerId` or `createdAt` on `/users/uid_A/apps/app1` -> DENIED.
11. **Array poisoning on SavedGrid**: Creating a `SavedGrid` with `balls: [1, 2, 3]` (size != 5) or `balls: ["1","2","3","4","5"]` -> DENIED.
12. **Blanket collection access**: Querying an undefined path `/otherCollection/doc` -> DENIED by global catch-all.
