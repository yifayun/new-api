# Security Hardening Checklist (L3/L4)

This document summarizes the recent security hardening changes and provides an operations checklist for deployment verification and compliance evidence collection.

## 1) Recommended Environment Baseline

Set these values in production:

- `SECURITY_L3_STRICT=true`  
  (If not set, the system now auto-enables strict mode in production-like runtime based on `APP_ENV`/`ENV`/`GO_ENV`/`NODE_ENV`/`GIN_MODE`.)
- `SESSION_SECRET=<random-strong-secret>`
- `CRYPTO_SECRET=<random-strong-secret>`
- `SESSION_COOKIE_SECURE=true`
- `CORS_ALLOW_ORIGINS=https://your.console.domain` (must not be `*`)
- `ENABLE_PPROF=false`
- `DEBUG=false`
- `TLS_INSECURE_SKIP_VERIFY=false`
- `EXPOSE_VERSION_HEADER=false` (optional, recommended for fingerprint reduction)

Notes:

- Secrets should be high-entropy and at least 24 characters.
- In strict mode, insecure combinations will fail startup by baseline validation.

## 2) Implemented Hardening Summary

### Error Exposure

- Panic response has been unified to generic `Internal server error` in relay recover path.
- Internal stack traces remain server-side only.

### TLS / SMTP

- SMTP TLS no longer uses `InsecureSkipVerify`.
- SMTP TLS now enforces certificate validation and minimum TLS version `1.2`.

### CORS / Header / Fingerprint

- Strict mode enforces explicit CORS origin configuration and tighter headers.
- Version exposure header is controllable via `EXPOSE_VERSION_HEADER`.

### Webhook Replay Protection

- Replay guard now uses **Redis first** (`SETNX + TTL`) with in-memory fallback.
- Replay keys are normalized with provider/event/order/type dimensions.
- Replay statistics are exposed in admin security status endpoint.

### Sensitive Logging Reduction

- Payment and webhook logs were minimized to avoid raw payload/signature/token leakage.
- Several full-object JSON logs were replaced by metadata-level logs.

### Subscription Payment Payload Minimization

- Epay / Stripe / Creem subscription completion payloads are now persisted as minimal summaries (no full provider raw object).

## 3) Runtime Verification Steps

## A. Startup Baseline

1. Start service with production envs.
2. Confirm startup logs include security baseline snapshot.
3. If startup fails, resolve reported baseline constraint and restart.

## B. Admin Security Status API

Endpoint:

- `GET /api/status/security` (Admin auth required)

Expected fields include:

- `strict_mode`
- `baseline_validation_passed`
- `tls_insecure_skip_verify`
- `session_cookie_secure`
- `cors_allow_origins`
- `webhook_replay_stats.duplicate_hits`
- `webhook_replay_stats.new_records`

## C. Webhook Replay Test

1. Send the same signed webhook event twice.
2. Verify first request is accepted/processed.
3. Verify second request is treated as duplicate and ignored idempotently.
4. Check `webhook_replay_stats.duplicate_hits` increases.

## D. Log Sanitization Spot Check

Verify logs do **not** contain:

- raw webhook bodies
- raw signatures
- full payment provider response JSON
- full user-sensitive payment payloads

## 4) Residual Items Requiring Infra / Ops Collaboration

The following are out of pure application code scope and should be handled by infrastructure/security operations:

- Host/kernel hardening baseline
- Bastion host + MFA + privileged access audit
- EDR/IDS/WAF coverage
- DB encryption at rest + key rotation governance
- Backup/DR drills and evidence
- TLS certificate lifecycle automation
- Centralized audit log retention and tamper controls

## 5) Evidence Collection Template

For each release/change window, archive:

- effective environment variable snapshot (masked)
- startup security baseline log snippet
- `/api/status/security` response screenshot/export
- replay protection test records
- sanitized log sample proof
- deployment and rollback records

This set is suitable as primary evidence bundle for formal compliance review preparation.
