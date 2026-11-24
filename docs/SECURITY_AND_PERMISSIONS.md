# Cbox Security, Privacy & Acceptance Checklist

## 1. Authentication & Session Security
- **Globally Unique Usernames**: Trimmed, lowercased, validated (`^[a-z0-9_.]{3,24}$`), and enforced via PostgreSQL `UNIQUE` index on `User.usernameNormalized`.
- **Mandatory Password + Argon2id**: Every login requires a valid password verified against an Argon2id salted hash (`memoryCost: 65536, timeCost: 3, parallelism: 1`). Plaintext passwords are never stored, returned, or logged.
- **Generic Login Errors**: Both unknown usernames and wrong passwords return `401 Invalid username or password.` to prevent username enumeration.
- **Session Storage & Revocation**: Opaque random tokens hashed with HMAC-SHA256 before saving in PostgreSQL `Session`. Delivered via `HttpOnly`, `SameSite=Lax` (`Secure` in production) cookies with expiry, single-session revoke, and revoke-all-other-sessions support.
- **CSRF Defense**: State-changing authenticated routes (`POST`, `PATCH`, `DELETE`) require `X-CSRF-Token` matching the session's `csrfToken` via constant-time comparison.
- **Rate Limiting**: Dedicated Express rate limits protect `/api/auth/login`, `/api/auth/signup`, `/api/auth/developer-code` (5 attempts / 15 min), and image uploads.
- **Password Recovery Limitation**: Because accounts are username-only (no verified email or phone in the initial scope), self-service password reset is intentionally omitted rather than faked. Optional verified recovery contact setup is documented as a future security phase.

## 2. Developer Access & Trust/Safety Boundaries
- **Server-Only Verification**: `DEVELOPER_ACCESS_CODE` lives strictly in server environment variables / secret manager and is compared with `crypto.timingSafeEqual`. It is never bundled into frontend code or logged in `AuditEvent`.
- **9-Digit vs. 12-Digit Notice**: Production enforces a 12-digit numeric code. The supplied 9-digit demo code (`147852369`) is accepted *only* when the server explicitly sets `DEVELOPER_CODE_ALLOW_DEMO_9_DIGIT=true`.
- **No Client-Side Escalation**: Navigating to Developer Space or tampering with browser state cannot bypass `requireDeveloper` on `/api/developer/*`, which returns `403 Forbidden` and logs an audit event.
- **Strict Privacy Boundary**: Developer role grants **zero** permission to read private 1:1 conversations or bypass `FRIENDS_ONLY` post/media restrictions.
- **Configurable Developer-Block Policy (`ALLOW_BLOCKING_DEVELOPERS`)**:
  - Prototype setting (`ALLOW_BLOCKING_DEVELOPERS=false`): prevents blocking developer accounts, as requested for prototype testing.
  - **Production Trust & Safety Recommendation**: set `ALLOW_BLOCKING_DEVELOPERS=true` in production so every user can block any account, including developer accounts, without exception.

## 3. Media Upload & Access Control
- **MIME & Size Validation**: Rejects non-image uploads and files over `MAX_UPLOAD_MB` (default 8 MB).
- **Sharp Re-Encoding**: Every avatar, banner, and post photo is decoded and re-encoded to WebP via Sharp, stripping EXIF/GPS metadata and neutralizing polyglot payloads.
- **Authorized Private Media Delivery**: Files are stored in private storage (local private directory or private S3/R2 bucket) and served exclusively through `GET /api/media/:mediaId`, which runs `canViewMedia(viewerId, mediaId)` on every request. Non-friends receive `404` when requesting a `FRIENDS_ONLY` post image directly.

## 4. Acceptance Test Verification Matrix
- [x] Duplicate username registration (including case variations like `Maya_Chen` vs `maya_chen`) rejected by DB `UNIQUE` constraint.
- [x] Login requires correct password; invalid password returns `401`.
- [x] Standard account receives `403` on `/api/developer/status` and cannot open Developer Space via UI or URL manipulation.
- [x] Valid server-configured developer code grants `DEVELOPER` role; invalid attempts are rate-limited and audited without logging the code.
- [x] Default landing tab after login is **Profile**.
- [x] Desktop (`>= 768px`) renders fixed left Sidebar; mobile (`< 768px`) renders fixed bottom navigation bar without horizontal overflow.
- [x] Chat → General lists accepted friends only; Sent Requests resolves exact username with safe preview; Received Requests Accept creates mutual friendship, Deny does not.
- [x] Only conversation participants can read or send messages in `/api/chat/conversations/:id/messages`.
- [x] Blocking removes friendship, cancels pending requests, hides active conversation, prevents new requests/messages, and can be undone in Settings → Blocked Users.
- [x] `FRIENDS_ONLY` posts and their `/api/media/:id` images are invisible to non-friends via both UI and direct API requests.
- [x] `PUBLIC` posts are visible to all authenticated users (unless blocked).
- [x] Profile changes, theme preference, uploaded images, friend requests, and messages persist in PostgreSQL across refreshes and devices.
