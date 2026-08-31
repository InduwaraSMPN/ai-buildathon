# Phase 3 — Device Channel Authentication

**Document role:** Implementation plan, executed in its own chat session.
**Read first:** [00-overview.md](00-overview.md) for the program and cross-phase contracts · the axel-cli section of [architecture.md](../idea/architecture.md) · this document's Progress Log at the end.
**Depends on:** nothing. Runs in parallel with Phase 1 — they share no files.
**Blocks:** Phase 5, hard. Do not widen device capability before this lands.

## Problem

`architecture.md` records the gap in its own words: the device connection is not authenticated, the stream is plaintext, the device ID in the hello is client-asserted — any process that can reach the gateway can impersonate any device — and the binary is unsigned.

That is survivable while a device can only be told to do one of five fixed things. It stops being survivable the moment the device surface widens, which is exactly what Phase 5 does. It is also the reason `06-itsm-connector.md` states that a customer trial must be infrastructure-path only.

Three separate problems live under one heading, and they need separating:

| Problem | Consequence |
|---|---|
| Device identity is client-asserted | Any process reaching the gateway impersonates any laptop and receives its commands |
| The stream is plaintext | Commands and device state are readable and modifiable in transit |
| The binary is unsigned | No integrity guarantee on what is installed, and Windows SmartScreen friction on install |

## Scope

**In.**

- Enrolment that issues a per-device credential.
- Gateway verification of that credential on every connection.
- TLS on the device stream.
- Credential lifecycle: rotation, revocation, and what happens on reimage.
- Binary signing, or a recorded decision to defer it with the reason.
- Tests, including a negative test that impersonation now fails.

**Out.**

- Widening the device action set. That is Phase 5.
- Implementing computer-use. That is Phase 5.
- Mutual authentication of the *agent* channel (`AgentChannel`). Different trust story — the agent is a worker on infrastructure the customer runs, not a laptop on a home network. Note it, do not build it here.
- Device attestation or hardware-bound identity. `architecture.md` argues against hardware IDs deliberately; do not reverse that decision in this phase.

## Design

### Enrolment issues the credential

`axel-cli enroll` exists today as an operator-facing command with a Bubble Tea interface. It becomes the point where a device receives a credential rather than merely announcing itself.

Shape to aim for:

1. IT staff, or an onboarding script, obtains a short-lived enrolment token from the API — capability-gated, single-use, expiring.
2. `axel-cli enroll` presents that token, along with the device identity it minted on first run.
3. The API verifies the token, records the device, and returns a long-lived per-device credential.
4. The daemon stores that credential under the user profile alongside the existing identity file, and presents it on every connection.

The existing identity design stays: a UUID minted on first run, persisted under the user profile, surviving restarts and upgrades and dying with the profile. `architecture.md` argues that is the right lifetime for "this person's laptop" and the argument still holds. What changes is that the gateway now has a reason to believe the claim.

Decide and record the credential form. A bearer token in gRPC call credentials is the smaller change; a client certificate with mTLS is stronger and composes with the TLS work below. Either is defensible — record which and why.

### TLS on the stream

The device dials out through NAT, home networks, and corporate proxies. That constraint stays and it shapes the answer: whatever is chosen must survive a proxy that terminates and re-establishes connections.

If Phase 2 has landed, this is ingress configuration plus client trust configuration. If not, it is a standalone server certificate on the gateway. Either way the CLI needs a way to trust a customer-supplied CA, because a self-hosted deployment will not have a publicly trusted certificate on an internal hostname. Do not add a flag that disables verification; a flag like that is always still there in production.

### Lifecycle

Four cases, all of which will happen:

| Case | Behaviour |
|---|---|
| Rotation | Credential can be replaced without re-enrolling and without losing device history |
| Revocation | IT revokes from the dashboard; the device's next connection is refused and existing streams close |
| Reimage | Profile is gone, identity is gone. Re-enrolment produces a new device row. Decide whether it links to the old one and record it |
| Expiry | Decide whether device credentials expire at all. If they do, the daemon must renew unattended or laptops silently fall off the fleet |

### Replay and the outbox

The gateway replays commands past the device's last processed sequence on reconnect. Confirm that authentication does not break replay, and that a *revoked* device reconnecting cannot receive queued commands. Read `api/src/server/grpc.ts` around the outbox and sequence handling before designing.

## Build order

### 1. Proto and schema

`api/proto/axioma.proto` — the device hello gains a credential field, or the credential moves into call metadata. Mirror into `agent/` and `cli/` with the existing publish command rather than editing copies.

`api/src/db/schema/` — devices gain credential material (hashed, never stored in the clear), enrolment tokens get a table with single-use and expiry semantics. Follow the AES-256-GCM convention from `api/src/auth/providers.ts` for anything that must be recoverable; credentials that only need verification should be hashed, not encrypted.

### 2. API side

Enrolment procedures in `api/src/contracts/` and `api/src/server/routers/`, capability-gated. Verification in `api/src/server/grpc.ts` on stream open, before any command dispatch. A refused device must produce a clear, logged, non-leaky error.

### 3. CLI side

`cli/internal/device/identity.go` and `config.go` gain credential storage. `daemon.go` presents it on connect and handles a refusal distinctly from a network failure — a revoked device should stop retrying with backoff and say why, not hammer the gateway forever.

`cli/internal/tui/enroll.go` becomes the enrolment flow. `cli/internal/tui/doctor.go` gains a credential-validity check alongside the existing connectivity and computer-use checks.

### 4. Signing

`cli/scripts/install.ps1` and `uninstall.ps1` exist. Signing requires a certificate, which is a procurement question, not a code question. If a certificate is not available, record that plainly in the Progress Log with what it would take, and ship the rest. Do not let signing block authentication.

## Testing

| Test | Asserts |
|---|---|
| Valid enrolment | A device with a good token enrols and connects |
| Impersonation fails | A connection asserting another device's ID without its credential is refused. This is the test that justifies the phase |
| Replayed enrolment token | A used or expired token is refused |
| Revocation | A revoked device is refused on reconnect and cannot drain its outbox |
| Rotation | Credential replacement preserves device identity and command history |
| TLS | Connection fails against an untrusted certificate; succeeds with the configured CA |
| Backoff behaviour | An authentication refusal does not produce an infinite tight retry loop |
| Existing suites | `cli` go tests and `api` node tests stay green. `daemon_test.go` and `identity_test.go` have uncommitted changes in the tree — read them before assuming shape |

## Acceptance checklist

- [x] A device cannot connect without a credential issued through enrolment.
- [x] Impersonating a known device ID without its credential is refused, proven by test.
- [x] The stream is encrypted, and the CLI can trust a customer-supplied CA without a verification-disabling flag.
- [x] Revocation from the dashboard takes effect on next connection and drains no queued commands.
- [x] `axel-cli doctor` reports credential state usefully.
- [x] Enrolment is capability-gated, tokens are single-use and expiring.
- [x] Binary signing is done, or deferred with a written reason and a stated cost.
- [x] Phase 5's gate is satisfied: it is now safe to widen the device surface.

## Known traps

- **Replay plus authentication.** The outbox replays past a sequence number. Make sure a revoked or re-enrolled device cannot pick up another device's queue.
- **A verification-disabling flag.** Whatever the reason it gets added, it will be set in production. Do not add one.
- **Enrolment must work without administrator rights.** The current installer is a logon Scheduled Task specifically so it installs without admin. Do not introduce a credential store that needs elevation.
- **Sleeping laptops.** Authentication must not interact badly with the ping-based liveness and reconnect-with-jitter behaviour. A fleet waking together must not stampede an authentication endpoint any more than it stampedes the gateway.
- **Do not reverse the identity decision.** Hardware IDs outlive a reimage, clone with a VM image, and are a privacy artifact. The UUID-under-profile design is deliberate.

## Progress Log

Append-only. Date, what was done, what remains, any blocker.

---

**2026-08-30 — implementation complete.** Chose a random 256-bit bearer credential in the authenticated `DeviceHello` rather than mTLS: it survives TLS-terminating corporate proxies and is the smaller cross-platform lifecycle. The API stores only SHA-256 verification hashes. Enrolment tokens are capability-gated, ten-minute, high-entropy, and atomically single-use. Credentials do not expire; unattended renewal is therefore unnecessary. Rotation immediately replaces the hash and is delivered only to an online authenticated device, preserving its row and command history. Revocation closes the live stream and blocks reconnect/replay. Reimage creates a new UUID and device row with no automatic link to the old identity.

TLS is mandatory on the shared gRPC listener. The CLI uses system roots plus an optional customer CA, with hostname verification always enabled; the infrastructure agent uses the same TLS listener but is not mutually authenticated, as scoped out above.

Binary signing is deferred because no Authenticode code-signing certificate is available. Completing it requires procuring and securely operating an organisation-validated or extended-validation certificate (typically several hundred US dollars per year, plus CI secret/HSM integration) and adding `signtool` after the existing Go build. Authentication and TLS are not blocked by that procurement dependency.
