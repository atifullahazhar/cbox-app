# Cbox API & Realtime Event Documentation

All authenticated routes require a valid `cbox_sid` HttpOnly session cookie. All state-changing (`POST`, `PATCH`, `DELETE`) authenticated routes also require the `X-CSRF-Token` header matching the active session's `cbox_csrf` cookie.

## REST API Endpoints

### Health
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Liveness check (`{ status: "ok" }`) |

### Authentication & Sessions (`/api/auth`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public (rate-limited) | Creates account (`username`, `password`), enforces unique `usernameNormalized`, sets `cbox_sid` + `cbox_csrf` cookies |
| `POST` | `/api/auth/login` | Public (rate-limited) | Verifies Argon2id hash, returns generic error on failure, issues session cookies |
| `POST` | `/api/auth/logout` | Session + CSRF | Revokes current session in DB and clears cookies |
| `GET` | `/api/auth/me` | Session | Returns current user DTO (`role`, `theme`, profile fields) and real `{ postCount, friendCount }` stats |
| `GET` | `/api/auth/sessions` | Session | Lists active non-revoked sessions for the current user |
| `DELETE` | `/api/auth/sessions/:id` | Session + CSRF | Revokes a specific session |
| `POST` | `/api/auth/sessions/revoke-others` | Session + CSRF | Revokes all sessions except the current device |
| `POST` | `/api/auth/change-password` | Session + CSRF | Verifies current password, hashes new password with Argon2id, revokes other sessions |
| `POST` | `/api/auth/developer-code` | Rate-limited (5 / 15 min) | Verifies server-configured developer code (timing-safe), grants `DEVELOPER` role to authenticated account, records audit event (never logs code) |

### Profile & Media Customization (`/api/profile`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile/me` | Session | Current user's profile and real stats |
| `PATCH` | `/api/profile/me` | Session + CSRF | Updates `username` (re-checks uniqueness), `primaryNickname`, `alternateNicknames`, `bio`, `theme` |
| `POST` | `/api/profile/me/avatar` | Session + CSRF | Multipart `image` upload; validated & re-encoded to WebP via Sharp |
| `DELETE` | `/api/profile/me/avatar` | Session + CSRF | Resets avatar to default initials |
| `POST` | `/api/profile/me/banner` | Session + CSRF | Multipart `image` upload; validated & re-encoded to WebP via Sharp |
| `DELETE` | `/api/profile/me/banner` | Session + CSRF | Resets banner to default gradient |
| `GET` | `/api/profile/:username` | Session | Safe public profile lookup (404 if blocked in either direction) |

### Chat Hub, Friend Requests & Blocks (`/api/friends`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/friends/general` | Session | Accepted friends only, with real Socket.IO `online` status and latest message preview |
| `GET` | `/api/friends/lookup?username=` | Session | Resolves exact normalized username and returns safe preview + relationship state |
| `GET` | `/api/friends/requests/sent` | Session | Pending outgoing friend requests |
| `GET` | `/api/friends/requests/received` | Session | Pending incoming friend requests |
| `POST` | `/api/friends/requests` | Session + CSRF | Sends friend request; blocks self-request, duplicates, already-friends, and blocked accounts |
| `POST` | `/api/friends/requests/:id/accept` | Session + CSRF | Creates mutual `Friendship` and `Conversation`, emits `friend:request:accepted` |
| `POST` | `/api/friends/requests/:id/deny` | Session + CSRF | Marks request `DENIED`, does not create friendship |
| `DELETE` | `/api/friends/requests/:id` | Session + CSRF | Cancels sender's pending request |
| `GET` | `/api/friends/blocks` | Session | Lists accounts blocked by the current user |
| `POST` | `/api/friends/blocks` | Session + CSRF | Blocks target user, removes friendship & pending requests; respects `ALLOW_BLOCKING_DEVELOPERS` flag |
| `DELETE` | `/api/friends/blocks/:blockedId` | Session + CSRF | Unblocks a previously blocked user |

### One-to-One Chat (`/api/chat`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/chat/conversations/with/:friendId` | Session + CSRF | Opens/creates canonical 1:1 conversation (requires accepted friendship & no block) |
| `GET` | `/api/chat/conversations/:id/messages` | Session | Returns persisted messages (strictly participant-authorized; no developer bypass) |
| `POST` | `/api/chat/conversations/:id/messages` | Session + CSRF | Persists message, enforces participant + friendship + block rules, broadcasts `message:new` |

### Posts & Authorized Media (`/api/posts`, `/api/media`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/posts/feed` | Session | Own posts + `PUBLIC` posts + accepted friends' `FRIENDS_ONLY` posts (excluding blocked users) |
| `GET` | `/api/posts/mine` | Session | Current user's own non-deleted posts |
| `GET` | `/api/posts/:id` | Session | Single post fetch with server-side `canViewPost` check |
| `POST` | `/api/posts` | Session + CSRF | Multipart upload (`image`, `caption`, `audience`: `FRIENDS_ONLY` \| `PUBLIC`) |
| `PATCH` | `/api/posts/:id` | Session + CSRF | Author-only caption/audience update |
| `DELETE` | `/api/posts/:id` | Session + CSRF | Author-only soft delete (`deletedAt`) |
| `GET` | `/api/media/:mediaId` | Session | Authorized private media delivery; enforces `canViewMedia` so non-friends cannot fetch `FRIENDS_ONLY` photos |

### Developer Space (`/api/developer`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/developer/status` | Session + `DEVELOPER` role | Returns verified access status, active policy flags, upcoming module placeholders, and non-sensitive developer audit events (`403` for standard users) |

---

## Socket.IO Realtime Events

Socket.IO authenticates during the WebSocket handshake using the same `cbox_sid` HttpOnly session cookie. Each authenticated socket joins its private room `user:<userId>`.

| Event | Direction | Payload | Purpose |
| :--- | :--- | :--- | :--- |
| `message:new` | Server → Client | `ChatMessage` DTO | Pushes persisted 1:1 messages in real time to both recipient and sender's other devices |
| `presence:update` | Server → Client | `{ userId, online }` | Broadcasts real online/offline transitions exclusively to accepted friends |
| `friend:request:received` | Server → Client | `FriendRequestItem` | Notifies receiver immediately of an incoming friend request |
| `friend:request:accepted` | Server → Client | `{ requestId, friend, conversationId }` | Updates sender's General list immediately when their request is accepted |
| `friend:request:updated` | Server → Client | `{ requestId, status }` | Syncs denied request status |
| `friend:request:canceled` | Server → Client | `{ requestId }` | Removes canceled request from receiver's list |
