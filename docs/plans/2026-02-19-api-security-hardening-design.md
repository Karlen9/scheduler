# API Security Hardening Design

## Problem

The backend API has no real protection against unauthenticated access:

- `DevAuthMiddleware` grants admin access to anyone sending requests without Telegram init data
- `/superadmin/specialists` endpoint is completely unprotected
- No rate limiting — server vulnerable to DoS
- No replay protection on Telegram tokens
- Wildcard CORS allows any origin

## Solution

Three layers: auth fix, rate limiting, hardening.

### Layer 1: Auth Fix

**Remove `DevAuthMiddleware`** — delete the function and its usage in router.go.

**Harden `TelegramAuthMiddleware`:**

- Empty `initData` -> return 401 immediately (no pass-through)
- Validate `auth_date` from initData: reject tokens older than 1 hour (3600s)
- Move `/api/photo/{fileId}` outside authenticated group (fileIds are unguessable Telegram tokens)

**Protect `/superadmin/specialists`:**

- New env var `SUPERADMIN_SECRET`
- If set: require `Authorization: Bearer <secret>` header
- If not set: disable endpoint (return 404)

### Layer 2: Rate Limiting

Using `golang.org/x/time/rate`:

- Global: 100 req/s, burst 200
- Per-IP: 20 req/s, burst 40 (sync.Map with periodic cleanup)
- Returns 429 Too Many Requests

### Layer 3: Hardening

**CORS restriction:**

- Use `WEB_APP_URL` as allowed origin (+ localhost:3000 for dev)
- Fall back to `*` if not set
- Remove `X-Dev-User-ID` from allowed headers

**Security headers middleware:**

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

**Auth logging:**

- Log IP on failed auth attempts
- Log rate-limited requests

## Files Changed

- `bot/internal/api/middleware.go` — remove DevAuth, harden TelegramAuth, add security headers, auth_date check
- `bot/internal/api/router.go` — restructure routes, restrict CORS, add rate limit middleware
- `bot/internal/api/ratelimit.go` — new: rate limiting middleware
- `bot/internal/api/superadmin_handlers.go` — add auth check
- `bot/internal/config/config.go` — add `SUPERADMIN_SECRET`
