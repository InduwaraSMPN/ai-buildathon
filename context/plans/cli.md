# Axiōma `cli` — implementation plan

**Document role:** Implementation plan for `axioma/cli` — axel-cli
**Related:** [api.md](api.md) (read first), [agent.md](agent.md), [architecture.md](../idea/architecture.md)

One Go binary on an employee laptop. It is Axel's reach onto a device, not a second agent: it executes
typed actions it is told to execute and holds no reasoning of its own.

---

## 1. Current state

### Gates, run 2026-08-29

| Gate | Command | Result |
|---|---|---|
| Vet | `go vet ./...` | Clean |
| Build | `go build ./...` | Clean |
| Tests | `go test ./...` | 2 passed (`TestExecuteRejectsComputerUse`, `TestSplitFacets`); `cmd/axel-cli`, `internal/pb` and `internal/tui` have no test files |

`proto/axioma.proto` is byte-identical to `api/proto/axioma.proto`, and generated bindings exist in
`internal/pb/`. Built binaries are present at `bin/axel-cli` and `bin/axel-cli.exe`.

### What is built and real

**Command surface** — `cmd/axel-cli/main.go`. Six subcommands with a usage block, signal-aware
context, and the deliberate split the architecture calls for: `daemon` is headless with no Bubble Tea
anywhere near it, and the operator commands carry the terminal UI.

**Identity** — `internal/device/identity.go`. A UUIDv4 minted on first run and persisted to
`%LOCALAPPDATA%\axioma\device.json`, with a POSIX fallback under `~/.local/share/axioma`. Writes go
through a tmp-file-plus-rename, so a crash mid-write cannot corrupt the identity.
`SaveSequence` refuses to move the sequence backwards. `DaemonState` gives `status` something to read
without talking to the daemon.

**Daemon** — `internal/device/daemon.go`. Genuinely good for its size:

- outbound dial only, so it works through NAT and corporate proxies with no firewall change;
- `DeviceHello` carries `last_seen_sequence`, which is what makes gateway replay possible;
- a 20s heartbeat, because a sleeping laptop does not close its TCP connection — it stops answering,
  and only an application-level ping notices;
- reconnect with exponential backoff plus jitter, so a fleet waking together does not stampede;
- one goroutine receiving and one loop sending, respecting gRPC's single-sender rule, with an explicit
  comment saying so;
- the sequence is persisted **before** the result is sent, and a command at or below the last seen
  sequence is rejected rather than re-run.

**Actions** — `internal/device/actions.go`. Three typed actions (`flush_dns`, `reset_resolver`,
`restart_service`), a three-name service allowlist, four read facets, a 30s command timeout. The
argument list for every action is written out in the binary and nothing composes a command string from
caller input, which is exactly the property that stops a ticket talking the agent into running
something arbitrary.

**Operator UI** — `internal/tui/`. `doctor` runs checks sequentially with a per-check timeout and a
clear pass/fail render, and checks that the binaries each action depends on are present — the comment
is right that finding one missing during a real ticket is the worst possible moment. `status` renders
identity, gateway, connection state and sequence.

### What is stubbed

- **`enroll` returns `not implemented`** with a `TODO(M8)`. There is no path from a device to a user,
  which is why `devices.owner_id` is null for every row.
- **Computer-use is refused unconditionally** at `daemon.go:122-124`, and
  `TestExecuteRejectsComputerUse` asserts that refusal. Correct as of today; in scope to change.

### Defects found while reading

| # | Location | Defect | Severity |
|---|---|---|---|
| C1 | `daemon.go:24-39` | **Backoff never resets after a successful connection.** `backoff` doubles on every reconnect and is never returned to one second, so a laptop that sleeps nightly permanently sits at the 30s cap and takes half a minute to come back every morning. The Python agent's equivalent loop does reset. | High |
| C2 | `daemon.go:182-187` | `actionOK` returns `true` for any output that is not a `Result`. `ReadState` returns a `map[string]any`, so **a facet read in which every facet failed is reported to Axel as `ok: true`** with error text buried in the payload. | High |
| C3 | `actions.go:41` | `reset_resolver` runs `netsh winsock reset`, which requires administrator rights and a reboot. The install path is deliberately non-admin (`/RL LIMITED`). **This action cannot succeed as installed**, and it is disruptive enough that it should not be in a tier-one set anyway. | High |
| C4 | `actions.go:48-54` | `restart_service` uses `sc stop`/`sc start`. Stopping `Dnscache`, `Dhcp` or `WlanSvc` requires administrator rights, so this action also fails as installed. | High |
| C5 | `actions.go:74` | The `services` facet runs `sc query type= service state= all` — several thousand lines of output, returned whole, straight into the model's context. | Medium |
| C6 | `actions.go:88-92` | Every facet returns `{"raw": "<entire stdout>"}`. Axel is handed console prose and asked to parse it, which is precisely what `architecture.md` argues against on the cluster side ("status is structured, events are prose"). | Medium |
| C7 | `daemon.go:32-36` | `break` inside a `select` breaks the select, not the `for`. Harmless because the loop condition re-checks `ctx.Err()`, but it reads as control flow that does not exist. | Low |
| C8 | `identity.go:80-82` | `Release` is set from `runtime.GOARCH`. It is an architecture string in a field the dashboard renders as an OS release. | Low |
| C9 | `daemon.go:26-41` | `RunDaemon` always returns `nil`; connection failures are recorded in `DaemonState` and the process exits 0 regardless. A supervisor cannot tell a clean stop from a permanent failure. | Low |

### What is missing outright

- **Result delivery is at-most-once.** The sequence is persisted before the result is sent, so a
  command that ran and whose result was lost in transit is never retried — the API times it out and
  Axel sees a failure for work that actually succeeded. This is the honest consequence of the
  "dispatch is not durable" decision and should be documented rather than silently carried.
- **Computer-use, tier two.** No cua integration, no detection, no local driver.
- **Packaging.** No installer, no versioned artefact, no update path, no signing. The README documents
  a `schtasks` line and nothing produces the file it points at.
- **Windows build constraints.** `actions.go` shells out to `ipconfig`, `netsh` and `sc` with no build
  tags, so a non-Windows build compiles and fails only at runtime.
- **Tests.** Two, both trivial. Nothing covers the daemon loop, reconnect, replay, sequence
  persistence, or any action.

---

## 2. Gaps

1. Reconnect is functionally broken after the first few cycles (C1).
2. A failed read reports success (C2).
3. Two of the three typed actions cannot run under the intended non-admin install (C3, C4).
4. Facets return unbounded console prose rather than structured state (C5, C6).
5. No enrolment, so no device is ever linked to a user.
6. No computer-use tier, which is now in scope.
7. No packaging, no install artefact, no update path.
8. No meaningful test coverage.
9. At-most-once result delivery is undocumented.

---

## 3. Milestones

Dependency-ordered.

### A — Fix the connection defects
**Files:** `internal/device/daemon.go`, `internal/device/identity.go`, new
`internal/device/daemon_reconnect_test.go`.

- **C1** — reset `backoff` to its base the moment a connection is established and has survived a
  minimum stable period (say 30s), not merely on dial success, so a connect-crash loop still backs off
  while a nightly sleep/wake does not.
- **C2** — `ReadState` returns a typed struct carrying per-facet success, and `execute` reports
  `ok: false` when every requested facet failed, `ok: true` with per-facet errors when some succeeded.
  A read that wholly failed must never look successful to Axel, because milestone C of `agent.md`
  discharges a verification obligation on a successful read.
- **C7** — replace the dead `break` with a labelled break or a `return`.
- **C8** — populate `Release` from the actual OS version. On Windows that is a
  `RtlGetVersion`/registry read behind a build tag; the POSIX fallback can use `uname`-equivalent
  data. Keep `GOARCH` as a separate field if it is wanted.
- **C9** — return the terminal error from `RunDaemon` so the exit code distinguishes a cancelled
  context from a permanent failure.
- **Document at-most-once delivery** in the package doc: a command that executed and whose result was
  lost is not retried, and the API will time it out. Retrying would need an idempotency key, which
  `architecture.md` names as one of the two gaps worth closing first if this moves past a demo. Do not
  close it here; state it.

**Done when:** a test drives the reconnect loop through ten simulated drops and asserts the delay
returns to base after a stable connection; a facet read where every facet fails returns `ok: false`;
and `go test ./...` covers both.

### B — Rebuild the action and facet set around what actually works
**Files:** `internal/device/actions.go`, new `internal/device/actions_windows.go`,
`internal/device/facets_windows.go`, `internal/device/actions_test.go`.

This is the largest single piece of real work in the component, because the current set was written
against what the commands look like rather than against what a non-admin process can do.

**Retire `reset_resolver` and rework `restart_service`.** `netsh winsock reset` (C3) needs admin and a
reboot, and is disproportionate to any problem the demo has. `sc stop/start` (C4) needs admin for the
three services on the allowlist. Both go. What replaces them must satisfy three conditions: it runs as
the logged-in user without elevation, it is deterministic and fast, and a read facet can prove it
happened.

Proposed tier-one set, each paired with the facet that verifies it:

| Action | Command | Verified by facet | Non-admin |
|---|---|---|---|
| `flush_dns` | `ipconfig /flushdns` | `resolver` (cache entry count) | Yes |
| `renew_dhcp_lease` | `ipconfig /renew` | `adapters` (address, lease time) | Yes |
| `clear_proxy_override` | per-user proxy settings under `HKCU` | `proxy` | Yes |
| `reset_credential_cache` | `klist purge` for the user's tickets | `identity` | Yes |
| `restart_user_process` | terminate and relaunch a named per-user process from a fixed allowlist | `processes` | Yes |

The exact set is settled against **scenario 2's seed**, which `implementation.md` leaves open ("put the
device into a bad state that a read facet exposes and a typed action restores"). Settle the seed first
and let it choose the actions — building an action set before knowing what it must fix is how the
current one went wrong. The scenario ticket text is already written: *"I can't reach the internal site,
everything else works fine."* A stale or poisoned DNS cache entry fits, is trivially seedable with a
`hosts` entry or a bad cache load, is fixed by `flush_dns`, and is observable in the `resolver` facet
before and after. That is the recommended pairing.

**Structure the facets (C5, C6).** Each facet parses its command output into named fields and returns
those, keeping the raw text under a `raw` key that is truncated to a stated ceiling. Concretely:

- `resolver` — DNS servers per interface, suffix search list, and a cached-entry count, from
  `ipconfig /all` and `ipconfig /displaydns`, not the whole dump.
- `adapters` — per adapter: name, status, IPv4, gateway, DHCP enabled, lease expiry.
- `reachability` — takes a target parameter rather than hardcoding `127.0.0.1`, which today proves
  nothing except that the loopback works. Returns per-target resolved address, packet loss and mean
  latency.
- `proxy`, `identity`, `processes` as the new actions require.
- Drop the unbounded `services` facet; if service state is needed, return the three named services'
  status rather than every service on the machine.

Every facet declares a hard output ceiling. Console output is an unbounded input from the perspective
of a model context window, and that is the component that can bound it.

**Done when:** each action in the table runs successfully on a Windows laptop under a non-admin
account, and for each one a before/after `read_state` on its paired facet shows a field that changed.
Unit tests parse captured fixture output for every facet.

### C — Enrolment
**Files:** `cmd/axel-cli/main.go`, new `internal/tui/enroll.go`, `internal/device/identity.go`,
`internal/device/daemon.go`, regenerate `internal/pb`.

`axel-cli enroll` becomes a Bubble Tea flow: prompt for the gateway address (defaulting to
`AXIOMA_GRPC_HOST`), dial it, display the device ID and a short enrolment code, and persist the code
alongside the identity. The daemon sends it on `DeviceHello.enrolment_code` — the additive proto field
`api.md` milestone G adds — until the API reports the device claimed, after which it stops sending it.

The employee redeems the code in the portal while signed in, which is what sets `devices.owner_id`.
The code is short-lived and single-use; both properties are enforced on the API side.

`doctor` gains two checks: gateway reachable, and device claimed by a user.

**Done when:** running `enroll` on a fresh laptop and redeeming the code in the portal makes that
device show an owner name in the dashboard devices table, and a ticket opened by that employee with no
device specified reaches Axel with the right device ID.

### D — Computer-use, tier two
**Files:** new `internal/cua/client.go`, `internal/cua/detect.go`, `internal/device/daemon.go`,
`internal/tui/doctor.go`, `README.md`, `internal/device/daemon_test.go`.

[cua](https://github.com/trycua/cua) is the choice because its driver runs in the background: agents
click, type and verify without stealing the cursor or focus, which is the property that makes this
acceptable on a laptop somebody is working on. Agent-S was rejected for using PyAutoGUI, which takes
the real mouse and keyboard, and for requiring a separately hosted grounding model.

cua is Python and this is Go, so the language boundary is a process boundary: `cua-computer-server`
runs locally and `axel-cli` drives it over its local API. This binary keeps its job — hold the
connection, receive typed commands, orchestrate — and delegates only the GUI tier.

**D0, a spike before any code.** Stand up `cua-driver` and `cua-computer-server` on the test
machine, confirm the local API surface — transport, port, authentication, whether an objective is
submitted as one call or driven step by step, and what a step result looks like — and write it down.
The rest of this milestone is sized on the assumption that it is a local HTTP or WebSocket API on a
loopback port; if the spike shows otherwise, rescope milestone D before continuing rather than
adapting in flight.

Then:

- `internal/cua/detect.go` — is the local server reachable, and at what version. Cached with a short
  TTL, because a laptop can install cua between two commands.
- `internal/cua/client.go` — submit an objective with a timeout, stream or poll step results, and
  return a structured transcript of what was clicked and typed. The transcript matters as much as the
  outcome: the whole objection to computer-use is that you cannot say precisely what changed, and a
  step log is the only partial answer available.
- `daemon.go` — `command.ComputerUse` routes here **only when detection succeeds**. When cua is
  absent, keep today's refusal verbatim: a missing tier two means escalate, not improvise, and a
  device that quietly falls back to something else is worse than one that says no.
- `doctor` gains a `computer-use available` check that reports "not installed" as informational rather
  than a failure, since most devices will not have it.
- `TestExecuteRejectsComputerUse` becomes `TestExecuteRefusesComputerUseWhenUnavailable`, asserting the
  refusal path with detection stubbed absent, plus a new test asserting dispatch with detection
  stubbed present.

Installation stays separate from the base install and is documented as such:

```bash
pip install cua-driver cua-computer-server
```

**Done when:** on a machine with cua installed, a `device.computer_use` command drives a GUI-only
change and returns a step transcript; on a machine without it, the same command returns the refusal
and Axel escalates rather than retrying; and `doctor` reports the difference correctly on both.

### E — Packaging and install
**Files:** new `scripts/build.ps1`, `scripts/install.ps1`, `scripts/uninstall.ps1`, `.github/` or
equivalent build entry, `README.md`.

- `build.ps1` cross-compiles `dist/axel-cli.exe` with the version, commit and build date stamped in via
  `-ldflags`, so `axel-cli version` reports something traceable instead of the hardcoded `0.1.0` in
  `main.go`.
- `install.ps1` copies the binary to `%LOCALAPPDATA%\axioma\`, registers the logon Scheduled Task
  exactly as the README documents, writes the gateway address, and starts the task — all without
  administrator rights. A Scheduled Task rather than a Windows service is deliberate: a service runs as
  LocalSystem in session 0, which cannot reach the user profile, mapped drives or per-user
  applications, and that is where most real laptop problems live.
- `uninstall.ps1` removes the task, the binary and the state directory, so a test machine can be reset
  between demo runs.
- Build constraints: move the Windows shell-outs behind `//go:build windows`, and provide a stub file
  for other platforms that returns "unsupported platform" per action. `go build ./...` must stay clean
  on the dev machine and on CI regardless of target.

The binary is **unsigned**, which `architecture.md` already lists as a deliberate gap. Say so in the
README next to the install command rather than leaving someone to discover it from a SmartScreen
prompt.

**Done when:** `install.ps1` on a clean Windows user account produces a running daemon that appears
online in the dashboard after logon, survives a reboot, and is fully removed by `uninstall.ps1`.

### F — Test coverage
**Files:** `internal/device/*_test.go`, new `internal/device/fake_gateway_test.go`.

An in-process fake `DeviceChannel` server lets the daemon loop be tested for real:

- hello carries the persisted sequence; replay past it is executed in order;
- a command at or below the last seen sequence is acknowledged, not re-run;
- the sequence is persisted before the result is sent, and a crash between the two leaves the command
  un-replayed — the at-most-once property, asserted so it is a known behaviour rather than a surprise;
- heartbeats are sent on the interval and a silent gateway triggers reconnect;
- backoff resets after a stable connection (the milestone A fix);
- context cancellation shuts the loop down cleanly.

Plus table tests parsing captured fixture output for every facet, so parsing regressions are caught
without a Windows machine in the loop.

**Done when:** `go test ./...` covers `internal/device` meaningfully — daemon loop, replay, sequence,
backoff, every facet parser, every action's argument construction.

---

## 4. Cross-component impact

| Needed from `api` | Why | Owned by |
|---|---|---|
| `DeviceHello.enrolment_code` proto field | Milestone C has nowhere to send the code | `api.md` milestone G |
| `enrollDevice` procedure and `devices.enrolment_code` column | Redemption sets `owner_id` | `api.md` milestone G |
| Device tool parameters carry a `target` for `reachability` and a process name for `restart_user_process` | The current gateway translation flattens parameters to `map[string]string`; that still works, but the tool schemas must accept the new fields | `api.md` milestone D |
| `listDeviceCommands` procedure | So `status` and the dashboard show the same command history | `api.md` milestone B |

| Forced on others | Detail |
|---|---|
| `agent` | `axel/tools.py` `DeviceRunAction.action` is `Literal["flush_dns", "reset_resolver", "restart_service"]`. Milestone B changes that set, so the literal must change with it or Axel will validate a valid action into a rejection. The facet literal in `DeviceReadState` changes for the same reason. Owned by `agent.md`, but this plan is the cause. |
| `api` | `device.run_action` and `device.read_state` input schemas in the server-side tool registry must match the same set. |
| `dashboard` | Structured facet output is worth rendering as fields rather than a blob in the transcript. Optional; noted, not required. |

Nothing here edits files outside `axioma/cli/`. Proto changes are requested from `api.md`; this
component regenerates with `scripts/generate-proto.ps1`.

---

## 5. Decisions taken

**Retire `reset_resolver` and admin-dependent `restart_service` rather than requiring elevation.** The
non-admin install is not incidental — `architecture.md` gives it as a reason the logon Scheduled Task
was chosen over a Windows service, and `idea.md` gives limited scope as what makes installing this on
an employee laptop acceptable at all. An action set that needs elevation to work invalidates both. The
honest fix is a set of actions that runs as the user.

**Every action is paired with the facet that proves it, and the facet must observe a field the action
changes.** `agent.md` milestone C makes write-then-verify a loop rule; that rule is only meaningful if
the read can actually see the effect. A `reachability` facet that pings loopback cannot verify a DNS
fix. This is why `reachability` takes a target.

**Facets return parsed fields plus bounded raw text.** The same argument `architecture.md` makes for
preferring pod status over events applies here: structured beats prose. It also bounds an
unbounded input to a model context window at the only layer that knows how big the output is.

**Keep at-most-once delivery; document it.** Making device commands idempotent needs an idempotency key
and a result store on the device, and `architecture.md` already names idempotency as out of scope by
decision — while also naming it as one of the two things to fix first if this moves past a demo.
Documenting the exact failure — command ran, result lost, API times out, Axel sees failure — is worth
more than a partial fix that hides it.

**Detection gates computer-use; absence is refusal, never fallback.** A device without cua refuses
rather than improvising. The tiers are ordered deliberately, and a missing tier two means escalate.
This is already the shipped behaviour; the milestone preserves it and adds the positive path.

**A step transcript is a required output of computer-use, not an optional one.** The strongest argument
against driving a GUI is that you cannot say precisely what changed. A recorded sequence of clicks and
keystrokes is a partial answer, and a partial answer is what makes the tier defensible at all.

**Spike cua's local API before building against it.** The one part of this plan whose surface is not
established by reading code in this repository is the one that gets a spike rather than an assumption.

**Keep Bubble Tea out of `daemon`.** Already true and worth keeping. The daemon runs as a logon
Scheduled Task with no terminal attached; anything it writes to stdout goes nowhere.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| cua's local API surface is not established from this repository, so milestone D rests on the least solid ground here. | The D0 spike is explicitly gated: confirm transport, port, auth and result shape before writing integration code, and rescope if the assumption of a loopback HTTP/WebSocket API is wrong. |
| The action set change breaks the agent's tool schema literals, and the two components cannot import from each other. | Land milestone B and the corresponding `agent.md` change in the same session, and cover it with the API-side schema, which validates independently and will reject a mismatch loudly. |
| Scenario 2's seed is still undefined, and the action set depends on it. | Milestone B settles the seed first and recommends a specific pairing (poisoned DNS cache → `flush_dns` → `resolver` facet) so the work is not blocked waiting for a decision. |
| Testing device actions genuinely needs a Windows machine under a non-admin account, which is slow to iterate on. | Facet parsers are tested against captured fixture output with no machine in the loop; only the execution path needs the real account, and the doctor checks catch a missing binary before a ticket does. |
| Installing cua puts a Python runtime on an employee laptop, expanding the footprint the base install was designed to avoid. | It is installed only on machines that need it, which is the existing design position; the base binary keeps working with no Python present, and detection means an uninstall degrades to refusal rather than error. |
| The binary is unsigned, so Windows SmartScreen will warn on first run and IT staff may be blocked by policy. | Documented next to the install command rather than discovered at install time. Signing is named as out of scope in `architecture.md` and stays there. |

---

## 7. Definition of done

1. `go vet ./...`, `go build ./...` and `go test ./...` clean, with `internal/device` covered by the
   daemon-loop, replay, backoff and facet-parser tests.
2. After a sleep/wake cycle the daemon reconnects within a few seconds, not the 30s cap, and appears
   online in the dashboard.
3. A `read_state` where every facet fails returns `ok: false` to Axel.
4. Every action in the shipped set runs successfully on Windows under a non-admin account, and for each
   one a before/after read on its paired facet shows a changed field.
5. Every facet returns parsed named fields with a bounded `raw` remainder, and no facet can return
   unbounded output.
6. `axel-cli enroll` links a laptop to a signed-in employee, and the dashboard devices table shows the
   owner.
7. On a cua-equipped machine, `device.computer_use` completes with a step transcript; on a machine
   without it, the same command is refused and `doctor` reports the difference.
8. `install.ps1` on a clean non-admin Windows account yields a daemon that comes up on logon, survives
   a reboot, and is fully removed by `uninstall.ps1`.
9. `axel-cli version` reports a stamped version and commit.
10. Scenario 2 runs end to end: Axel reads device state, dispatches the typed action, re-reads to
    confirm, and the ticket closes.
