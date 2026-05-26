# Security Specification - Conexão

## Data Invariants
1. A record MUST belong to the authenticated user (`userId` in path matches `request.auth.uid`).
2. Documents in `/users/{userId}/records/` MUST follow the `PerformanceRecord` schema.
3. Users can only read and write their own records.
4. Document IDs MUST be valid strings (size <= 128, alphanumeric).

## The Dirty Dozen Payloads (Target: `/users/victim_uid/records/attacker_doc`)
1. **Identity Spoofing**: Attacker authenticated as `attacker_uid` tries to write to `/users/victim_uid/records/doc1`.
2. **Schema Break (Missing Field)**: Missing `libido`.
3. **Type Poisoning**: `libido` as string instead of number.
4. **Boundary Break**: `libido` set to 100 (max is 5).
5. **ID Poisoning**: Document ID with 2KB of junk characters.
6. **Shadow Field**: Adding `isAdmin: true` to a record.
7. **Timestamp Fraud**: `timestamp` set to a future date manually.
8. **PII Leak Attempt**: Unauthorized 'list' on `/users/victim_uid/records/`.
9. **State Locking Bypass**: (Not applicable yet as there is no terminal state).
10. **Malicious Regex ID**: ID containing scripts `<script>`.
11. **Resource Exhaustion**: Extremely large string in `date`.
12. **Unauthenticated Write**: Trying to create a record without being signed in.

## Test Runner (Logic Verification)
A `firestore.rules.test.ts` would verify these are all `PERMISSION_DENIED`.
Since I don't have the test environment set up, I will ensure the rules handle these cases.
