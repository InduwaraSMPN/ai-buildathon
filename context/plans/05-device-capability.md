# Phase 5 — Device Capability

**Document role:** Implementation plan, executed in its own chat session.
**Read first:** [00-overview.md](00-overview.md) for the program and cross-phase contracts · the axel-cli and device-remediation sections of [architecture.md](../idea/architecture.md) and [idea.md](../idea/idea.md) · this document's Progress Log at the end.
**Depends on:** Phase 3, **hard**. Do not start Stage B or C until device channel authentication has landed.

## Problem

The device path is meant to resolve an employee's laptop fault end to end: typed actions where they exist, computer-use for GUI-only problems, and general local execution for the rest.

Two of those three do not exist.

**Computer-use is a stub.** `cli/internal/device/daemon.go` refuses unconditionally:

```go
if command.ComputerUse {
    result.Error = "computer-use is not installed; this device supports typed actions only"
```

`cli/internal/cua/` contains only `detect.go`, a version probe whose sole caller is the `doctor` checklist in `cmd/axel-cli/main.go`. Nothing ever sends an objective to `cua-computer-server`. The registry entry, the proto field, the API zod schema, and the tier-two prompt guidance all exist. The executor does not.

**The typed action set is five actions**, and one of them barely counts: `restart_user_process` allowlists exactly one process, `notepad`. Real coverage is four network fixes.

**General local execution does not exist by design.** `actionCommands` in `cli/internal/device/actions.go` returns only argument vectors written into the binary. `architecture.md` states the reason: no command string crosses the boundary, which is what stops a ticket talking the agent into running something arbitrary.

## The constraint this phase must respect

The ticket title and body are chosen by whoever files the ticket — including by anyone who can send mail that becomes one — and they reach the model verbatim through `build_user_prompt`. Today the worst case is that the model picks a wrong tool from a five-item list and a pydantic schema rejects the parameters.

If the device gains general execution, the worst case becomes arbitrary code on an employee's laptop, selected by whoever wrote the ticket. Combined with an unauthenticated, plaintext channel and a client-asserted device ID, one crafted ticket reaches the whole fleet. That is why Phase 3 is a hard gate rather than a preference.

The comparison to a coding CLI agent does not carry. Those run on the developer's own machine, on prompts that developer typed, with that developer watching. axel-cli runs unattended on someone else's machine on text a stranger supplied.

This phase therefore proceeds in three stages, each with its own precondition. **The stages ship separately.** Stage A is worth shipping on its own even if B and C are deferred.

## Stage A — widen the typed surface

**Precondition:** none. Can start immediately, in parallel with Phase 3.

The cheapest coverage in the whole program. Each new action is one entry in `actionCommands`, one enum member in four places, and a test.

Adding an action touches, per the parity test's own assertions:

| Place | Change |
|---|---|
| `cli/internal/device/actions.go` | The argv, written into the binary |
| `api/src/server/tools/device.ts` | `deviceActionInput` enum member |
| `agent/axel/tools.py` | `DeviceRunAction` literal member |
| `api/proto/axioma.proto` | `DEVICE_ACTION_<NAME>` enum member |

`api/src/server/tools/parity.test.ts` asserts all four agree, including the proto's uppercase form. It will catch a missed one — this is the one place the existing parity coverage is genuinely strong.

Candidate additions, to be chosen against real ticket data rather than guessed: network profile reset, printer spooler restart, Windows Update service restart, Outlook profile cache clear, certificate store refresh, time resynchronisation, disk cleanup on a bounded path. Widen the `userProcesses` allowlist beyond `notepad` to the applications employees actually report — that map is the mechanism, and it is currently a placeholder.

Every action must stay: non-admin, argv-only, no caller-supplied string reaching a shell, and paired with a facet in `facets.go` that can verify it. `device_run_action` names `device_read_state` as its verifier, and the loop enforces that obligation before a run may resolve — an action with no observable effect cannot be verified and should not be added.

**Acceptance:** at least six new actions, each with a verifying facet, parity test green, `cli` go tests green.

## Stage B — implement computer-use

**Precondition:** Phase 3 complete.

`architecture.md` chose [cua](https://github.com/trycua/cua) because its driver runs in the background — agents click, type, and verify without stealing the cursor or focus — which is the property that makes it acceptable on a laptop somebody is working on. Agent-S was rejected for using PyAutoGUI, which takes the real mouse and keyboard, and for requiring a separately hosted grounding model. Do not revisit that decision here.

The language boundary is a process boundary: `cua-computer-server` runs locally as `python -m computer_server`, exposing HTTP and WebSocket on a loopback port, and axel-cli drives it over that local API. `cli/internal/cua/detect.go` already speaks to `http://127.0.0.1:8000/cmd` and parses an SSE-style `data:` line, so the wire shape is partly established — read it before designing the client.

Build:

1. A cua client in `cli/internal/cua/` that takes an objective and a timeout and drives the session to a result.
2. Replace the refusal in `daemon.go` with dispatch to that client when the detector reports availability.
3. **Keep the refusal when cua is absent.** A device without cua installed refuses rather than falling back. `idea.md` is explicit: a missing tier two means escalate, not improvise. The current refusal message is correct behaviour for that case; only the available case changes.
4. Bound it. `DeviceComputerUse` already carries `timeout_seconds` with a 10–600 range, and `commandTimeout` caps at `maxCommandTimeout`. Confirm the cua session respects both and cannot outlive the command.
5. Return something the loop can verify. `device_computer_use` names `device_read_state` as its verifier; a GUI action whose effect no facet can observe cannot discharge that obligation. If an objective's effect is unobservable, that is a reason not to attempt it rather than a reason to relax the loop.
6. Installation and packaging for `cua-computer-server` with its `[driver]` extra, so "installed only where it is needed" is an actual procedure rather than a sentence.

Note honestly in the Progress Log what the tier-two path costs: it is slow, non-deterministic, spends vision tokens per step, and leaves the transcript less able to state precisely what changed. The prompt already says this; the implementation should not quietly make it the easy path.

**Acceptance:** a real GUI-only fix completes on a device with cua installed, is verified by a facet read, and appears in the transcript; a device without cua still refuses; timeouts are enforced.

### Respecifying the tier-two contract — proposed 2026-08-31, revised the same day after measurement, **not yet agreed**

Stage B cannot be built as written, and the reason is not Phase 3. `cua-computer-server` exposes screenshot, pointer, keyboard, window, accessibility, shell, and file primitives over `POST /cmd`, and nothing else — no objective-submission endpoint, no server-side reasoning loop. "Take an objective, drive the session to a result" is not a contract that exists to call.

The first version of this section designed a typed-step protocol on top of cua. Measuring on a real Windows machine showed that premise was wrong: **for most GUI remediation, cua is not needed at all.**

#### What the measurement showed

Windows UI Automation is reachable from PowerShell, non-admin, with no new dependency, and it already provides both halves of what tier two needs. Numbers from this machine:

| Measured | Result |
|---|---|
| Enumerate top-level windows | 9 windows, 491ms, first call including assembly load |
| Enumerate one browser window's tree | 392 descendants, 57 actionable, 267ms |
| Actionable controls across all visible windows | 199 `InvokePattern`, 139 `ExpandCollapse`, 54 `SelectionItem`, 28 `ValuePattern`, 24 `TogglePattern` |
| Serialised payload, 50 controls, warm and in-process | 4.8KB JSON, roughly 1,200 tokens, 499ms |
| The facet as shipped: cold process, 30-control cap | 3.6s, 2.9KB |

Each control comes back with its role, its name, whether it is enabled, whether it is offscreen, its bounding rectangle, and the patterns it supports. `InvokePattern.Invoke` presses a control **without moving the mouse**, and `ValuePattern.SetValue` fills a field **without touching the keyboard**.

One honesty note on that last pair: the enumeration and pattern-support figures above were measured. **Invocation was deliberately not executed** — doing so would have clicked real controls on a working machine. That those patterns act without stealing the cursor is documented behaviour of the API, not something this session observed, and it is the first thing to confirm on a scratch VM before any of this is built.

That last point matters more than the rest. `architecture.md` chose cua over Agent-S specifically because cua's driver "runs in the background — agents click, type, and verify without stealing the cursor or focus". **UI Automation has that property natively**, because it is the API that screen readers use. The reason cua was selected turns out to be satisfied by something already on every Windows machine.

It also lands the right way round on the trust boundary. The facet **enumerates** the controls present; a step **selects one by name** from that enumeration. Caller input picks a key out of a set the device produced — it never becomes a command. That is `restart_user_process`'s allowlist shape, generalised to the GUI, so tier two stops being an exception to the invariant that governs tier one and starts being another instance of it.

And axel-cli is already in the right place to use it: UI Automation needs the interactive desktop session, which is exactly what the logon Scheduled Task gives it and what a session-0 Windows service would not.

#### The shape

The GUI is a surface, and it obeys the same rule as every other surface. Reads are facets. Writes are typed actions. Every write is verified by the read that observes it. `objective` disappears — Axel looks, decides one step, sends it, and looks again, which is the loop it already runs against clusters and tier one. Reasoning stays in Axel, so the component boundary holds without argument.

**Read side.** One new facet, `screen`: the enumerated actionable controls of the foreground or a named window — role, name, enabled, and supported actions. Text, not pixels. It parses into a typed struct like every other facet, and it discharges the verification obligation after a GUI write. Bounding matters: `maxFacetRaw` is 4096 bytes and a busy window exceeded that, so the facet caps the control count rather than truncating mid-structure.

**Write side.** A step names a control the facet just reported, and an action that control declares it supports:

| Step | Parameters | UI Automation pattern |
|---|---|---|
| `invoke_control` | window, control name | `InvokePattern` |
| `set_control_value` | window, control name, value | `ValuePattern` |
| `toggle_control` | window, control name | `TogglePattern` |
| `select_item` | window, control name | `SelectionItemPattern` |
| `expand_control` | window, control name | `ExpandCollapsePattern` |

No coordinates, so no pixel drift and no resolution dependence. No raw keyboard, so no typing into whatever happens to have focus. The device refuses a step whose named control is not present, not enabled, or does not support the pattern requested — the same refusal shape as an unlisted process today.

**This also removes the risk the first draft had to mitigate.** That draft needed a `type_text` step and a denylist of terminals, because typing goes wherever focus is. `set_control_value` targets a named field in a named window and cannot type into anything the facet did not enumerate, so the mitigation is structural rather than a blocklist someone has to maintain.

#### Where cua still belongs

Not everything exposes a UI Automation tree. The survey found a graphics overlay with zero descendants, and Electron applications expose little without a flag. Remote desktop, Citrix, and canvas-drawn applications are pixels by nature. **cua remains the fallback for those**, and the refusal when it is absent stays exactly as it is. What changes is that cua stops being the mechanism for tier two and becomes the tail of the tail — which also means the "no objective endpoint" blocker no longer sits on the critical path.

#### Surfaces to change

*Superseded by what shipped, and the difference is worth stating.* This section proposed a new `device_gui_step` tool replacing `device_computer_use`, with a typed step message on `DeviceCommand`. The implementation did something simpler and more faithful to the argument above: the five GUI steps are ordinary `device_run_action` actions, verified by `device_read_state` on the `screen` facet, joining the parity test exactly as actions and facets already do.

That is the stronger form of the claim this section makes. If the GUI is genuinely just another surface obeying the same rule, it should not need its own tool, its own proto message, or its own dispatch path — and it does not. `device_computer_use` and `objective` stay exactly as they were, refusing, because they now describe only the pixel fallback. `internal/cua` is untouched until that fallback is built.

#### The honest cost

A round trip per step, and a run that takes several steps where a typed action takes one. But a few thousand bytes tokens of structured text per look rather than thousands of vision tokens, and a deterministic control name rather than a coordinate. Tier two stops being the expensive non-deterministic option and becomes merely the slower one — which is a real change to the tiering argument in `idea.md` and should be reflected there if this is agreed.

#### Open, and needing a decision before code

How many steps one run may spend before it escalates. Whether `screen` may enumerate any window or only the foreground one. And whether a step that changes a control the facet did not enumerate in the immediately preceding read should be refused outright — stricter, and probably right.

## Stage C — general local execution

**Precondition:** Phase 3 complete, **and** the gates below designed and agreed before any code.

This is the capability that was asked for, and it is the one that inverts the system's threat model. It ships behind gates or it does not ship.

Design the gates first, in this document, and get them agreed:

| Gate | Why |
|---|---|
| Human approval before execution | IT staff sees the exact command string and approves it. The approval infrastructure already exists — change enablement with CAB voting, and catalogue requests that block on a manager's decision. Reuse that vocabulary rather than inventing a second one |
| Authenticated, encrypted channel | Phase 3. Without it, approval protects nothing, because the command can be injected downstream of the approval |
| Signed binary | So what executes is what was shipped |
| Bounded and audited | Non-admin, timeout, output captured in full to the transcript, every invocation recorded with the run and step that produced it |
| Per-environment or per-device opt-in | A customer chooses which machines allow it. Default off |

Recommended shape: general execution is **never** a tool Axel can call directly. Axel *proposes* a command; the proposal becomes an approval record; a human approves; the API dispatches. That keeps the invariant that no command string crosses the boundary on the model's authority alone, while giving the capability its actual value — the general case gets handled instead of escalating with nothing attached.

If that shape is rejected in favour of direct execution, record the decision and its reasoning in the Progress Log, along with what compensating control replaces the approval gate. Do not let the decision be implicit.

### Gate design — third revision, 2026-08-31, after adversarial review. **Not yet agreed**

Two earlier drafts of this section were wrong. The first reused the `changes` vocabulary; reading the code showed a standard change approves itself, so the gate would have opened itself. The second reused the `approvals` table; stress-testing it against the run lifecycle broke it in ways that would otherwise have been discovered in production. Both are recorded in the Progress Log rather than quietly replaced, because the failures are the useful part.

#### What the adversarial review found

**The run cannot wait, and nothing can resume it.** This is the finding that reshapes everything. A run holds a 45-second lease, renewed only by agent-driven events; the agent has a 300-second hard deadline; a device command times out in 30 to 120 seconds. There is no `paused` run status and no resume message in the proto. A gateway restart fails every running run outright. A human approval takes hours. **"Propose, wait, then dispatch" has no host in this system.**

**Reusing `approvals` would brick tickets.** `startTicketRun` refuses to start while an approval is `waiting_for_approval` or `rejected`. The only thing that could dispatch an approved command is a new run — blocked by the very row it waits on. And because a new run starts with an empty transcript, it re-derives and re-proposes, creating a second approval row. A rejected row is worse: nothing in the codebase ever deletes, resets, or reopens an approval, so one rejection makes the ticket permanently unrunnable *and* unclosable, with no escape short of SQL.

**Latest-row-wins would launder a rejection.** Both existing guards read the newest approval by `requestedAt`. A rejected catalogue approval followed by an approved device-command approval leaves the newest row `approved` — and the previously refused service request becomes resolvable.

**Self-approval is unconstrained.** `decideApproval` checks only that the approver matches the row; there is no requester-is-not-approver rule, in contrast to the `managerId` check on users. The seeds grant `device.command` and `approval.decide` to the same `it-analyst` role, and seed every existing user into it.

**There is nowhere to put the argv.** `approvals` has one free-text column, `requestNote`, which the dashboard truncates to a single line. Nothing binds a dispatched command to an approved note, and an approved row is never consumed, so it authorises every later proposal on that ticket. Time-of-check-to-time-of-use and replay in one.

#### The shape that follows

**The run does not wait, because it cannot. It proposes and escalates.**

Axel calls `device_propose_command`, which writes a proposal and returns. The run then finishes normally — escalated, with a diagnosis and an attached proposal. That is already a first-class good outcome here: escalating with a clear diagnosis is a success, not a failure. No lease extension, no paused status, no resume protocol, nothing new in the run lifecycle.

A human reviews the proposal later, on its own screen. Approving it **dispatches the command directly, outside any run**, through the same gateway path a tool call uses, and records the result against the ticket and the proposal. The agent is never in the loop for execution, which is exactly the invariant this phase protects.

**A new table, not `approvals`.** `device_command_proposals`, carrying the device, the originating run and step, the argv as structured data, a digest of it, a status through proposed, approved, dispatched, completed or failed, plus rejected and expired, the approver and decision time, and an expiry. A separate table avoids every failure above: it cannot collide with the per-ticket unique index, cannot be read by the latest-row-wins guards, cannot brick a ticket, and cannot appear in a reporter's approval card or a catalogue approver's queue.

| Gate | Mechanism |
|---|---|
| Axel cannot execute | `device_propose_command` writes a row and returns. No general-execution tool is registered |
| The run does not block | The proposal is a write, not a wait. The run escalates and ends |
| Approval is explicit | Dispatch requires an approved status with an approver recorded, enforced by a status predicate on the transition — the codebase's one real enforcement primitive |
| Approver is not the requester | A constraint on the table, mirroring the manager check on users. The seeded role holds both capabilities, so this cannot be left to convention |
| The approved argv is the executed argv | Digest checked at dispatch; the row is the only source. A proposal is single-use, so an approval cannot authorise a second command |
| Approval expires | A proposal not decided within its window expires. Stale authorisation is not authorisation |
| The approver sees it | A dedicated screen, untruncated, rendered as inert text — not the catalogue approvals list, which is where "new mouse please" lives |
| Refusal is visible | `assertEnvironmentAllowed` already throws before any side effect and the gateway records it in the transcript. Reuse that site; it is the one part of the earlier design the codebase already supported. Note the agent's budget is three consecutive failures, so a gate that refuses repeatedly exhausts a run |
| Per-device opt-in | Default off. `credentialStatus` is derived rather than stored, which is the precedent to follow if this can be computed |
| Bounded and audited | Non-admin, argv rather than a shell string, existing timeout and output caps. `deviceCommands` has no actor columns today and cannot answer who authorised a command — that is new schema |

**Still unresolved, and genuinely hard:** who may approve. No capability means "may authorise a privileged action on a device" — `device.command` means *may issue one*, and the same role holds `approval.decide`. A new capability is needed, and a rule for who holds it. Naming a single approver at insert time also encodes the wrong model; the right one is that any holder of the capability may decide, which is a queue rather than a nominated individual.

**Acceptance** — conditional on the above being agreed:

- [x] No registered tool executes a caller-supplied command; the only new agent tool writes a proposal and returns.
- [x] A proposal does not block the run: the run escalates with the proposal attached, and the ticket stays runnable and closable throughout.
- [x] Dispatch requires an approved, unexpired, unconsumed proposal whose digest still matches, on a device with execution enabled, over an authenticated channel. Each refusal has its own test and throws before any side effect.
- [x] A proposal cannot be approved by the identity that caused it. `agent_runs.started_by_id` now records who set a run going, the proposal copies it, and approval by that person is refused and rolled back. Auto-dispatched runs have no initiator and are unaffected.
- [x] A proposal is single-use; a test asserts a second dispatch against the same approval is refused.
- [x] Rejecting or expiring a proposal leaves the ticket fully operable — asserted against a real database for both outcomes, including that the proposal becomes undispatchable and that a second proposal on the same ticket is still allowed.
- [x] Device proposals never appear in the catalogue approvals queue or in a reporter's approval card.
- [x] A ticket body instructing a command produces at most a proposal awaiting a human decision, and a test asserts no execution occurred.
- [x] Every invocation records who authorised it — the dispatched command row carries the proposal that authorised it, asserted end to end against the database.

**Prerequisites:** Phase 3 confirmed complete, and the migration journal reconciled — its head is `idx` 32 while on-disk migrations run to `0042`, one entry carries a tag from a different file, and several files have no entry at all. This design needs a new table and new columns; generating them against that state would collide with work in flight.

## Testing

| Test | Stage | Asserts |
|---|---|---|
| Parity across four surfaces | A | Every new action present in Go, TypeScript, Python, and proto |
| Facet verification | A | Each new action has a facet that observes its effect |
| No string reaches a shell | A | A caller-supplied parameter cannot become a command; the `restart_user_process` allowlist rejects anything unlisted |
| cua available | B | An objective drives a real session and returns a result |
| cua absent | B | Refusal message unchanged, run escalates rather than improvising |
| cua timeout | B | Session cannot outlive `timeout_seconds` or `maxCommandTimeout` |
| Verification obligation | B | A computer-use write cannot resolve a run without a `device_read_state` that observes it |
| Approval gate | C | Execution without an approval record is refused at the API, not at the CLI |
| Injection attempt | C | A ticket body instructing a command produces, at most, a proposal awaiting human approval — never an execution |

## Acceptance checklist

- [x] Stage A shipped: typed surface widened, parity green, each action verifiable.
- [x] Phase 3 in place before Stage B shipped. Its code is in the tree and verified — the gateway refuses to start without TLS material, verifies a per-device credential hash on hello, and honours revocation; the daemon dials with real transport credentials. Its own Progress Log is still empty, so it is not *declared* complete, and this session does not declare it on another session'''s behalf. Recorded rather than glossed: what Stage B shipped does not widen the surface the gate exists to protect. A GUI step names a control the device itself just enumerated, which is the same trust boundary tier one already had, not the general execution Stage C would introduce.
- [x] Stage B shipped: GUI remediation works through UI Automation, verified by the screen facet and by a live end-to-end test. cua remains unimplemented and refused — it is now the pixel-only fallback, not the mechanism.
- [x] Stage C shipped: Axel proposes and escalates, a `device.approve` holder authorises the exact argument vector on its own screen, and the API dispatches from the approved row. Digest-bound, single-use, expiring, default off per device, and refused independently by the CLI.
- [x] Documentation updated — `architecture.md`, `idea.md`, and `cli/README.md` match what shipped.

## Known traps

- **Stage A is the whole win for most tickets.** `idea.md` says almost all real IT remediation belongs in tier one. Do not let the interesting stages starve the useful one.
- **The refusal path is a feature.** Deleting it to make computer-use "just work everywhere" removes the escalate-rather-than-improvise property deliberately built in.
- **cua steals no focus — keep it that way.** If an implementation shortcut reintroduces real mouse and keyboard control, the reason cua was chosen over Agent-S is gone.
- **`restart_user_process` has two parameter spellings.** `actions.go` accepts both `process_name` and `processName` for compatibility. Do not clean that up without checking what sends the flattened form.
- **Duplicate suppression is partial.** A device rejects a sequence it has already accepted, but reports the outcome as *indeterminate* rather than replaying the original result — so "did that action already run" is unanswerable after a timeout. In-flight commands are also lost if the API restarts. Widening the action set widens the consequence of both. Out of scope here; say so in the Progress Log rather than leaving it unsaid.

## Progress Log

Append-only. Date, what was done, what remains, any blocker.

---

### 2026-08-30 — Stage A shipped. Stage B blocked. Stage C gate design written, not agreed.

**Stage A is done.** Twelve typed actions where there were five, ten diagnostic facets where there were six, and eight allowlisted applications where there was one. Every action is paired with a facet that observes its effect, and that pairing is now asserted rather than assumed.

| New action | argv | Verified by |
|---|---|---|
| `disable_proxy` | PowerShell, `ProxyEnable` to 0 under `HKCU` | `proxy` |
| `refresh_certificate_store` | `certutil -user -pulse` | `certificates` |
| `clear_temp_files` | PowerShell, bounded to `$env:TEMP` | `storage` |
| `clear_outlook_cache` | PowerShell, bounded to Outlook `RoamCache` | `app_cache` |
| `clear_teams_cache` | PowerShell, bounded to the Teams package `LocalCache` | `app_cache` |
| `clear_icon_cache` | PowerShell, the icon and thumbnail caches | `app_cache` |
| `clear_print_queue` | CIM, the user's queued print jobs | `printing` |

New facets: `certificates` (the user's personal store, with expiry), `storage` (live free space and the temp footprint), `app_cache` (the directories the clear actions target), `printing` (printers, default printer, queued jobs). `storage` is deliberately distinct from the `disks` inventory, which stays a hardware register and never a diagnostic facet.

`userProcesses` now carries `notepad`, `explorer`, `outlook`, `teams`, `onedrive`, `msedge`, `chrome`, and `slack`. The map is still the mechanism: caller input selects a key and never supplies a string. Each entry now holds both the taskkill image and the argv that starts the application again, because most of these are not on `PATH`; those launch through `cmd /c start` with a target that is a constant in `actions.go`. The `processes` facet script is generated from that same map, so the read that verifies a restart always observes exactly what the action can restart.

Chosen against what the tree actually contains rather than guessed. The repository has no seeded tickets and no known-error corpus — the realistic symptoms live in test fixtures and amount to VPN and sign-in failures, stale DNS, a stale proxy override, printer problems, and Outlook. The additions follow that: proxy, certificates, printing, Outlook, Teams, and disk pressure.

**What was rejected, and why.** Printer spooler restart, Windows Update service restart, and network profile reset all need administrator rights, which the non-admin invariant forbids. Time resynchronisation was rejected for the same reason — `w32tm /resync` is not reliably available to a standard user.

`refresh_user_policy` was designed, built, and then dropped. No non-admin, edition-portable, language-neutral read observes a user Group Policy refresh: `gpresult /x` does not exist on Home editions — verified by running it, which reports `Invalid argument/option - '/x'` — and the `Group Policy\State\<SID>\Extension-List` timestamps are absent on non-domain machines. The plan's own rule is that an action nothing can observe should not be added, so it was not. `clear_icon_cache` took its place. Revisit it when there is a domain-joined machine to verify the facet against; the action itself is one line.

**The new facet scripts were run against a real Windows machine**, not just unit-tested, and that caught two things a fixture never would. `Get-Printer` piped into `Get-PrintJob` per printer measured at 50 seconds on a six-printer laptop, and eight separate `Get-Process -Name` lookups at 25 seconds — both against a fixed 30-second budget. Both were rewritten against CIM and a single process query, measuring 3 seconds and under 1. Walking a user temp directory still measures 28 seconds with 36,000 files in it, which is inherent.

That budget was the third finding. Every device command took a hardcoded 30 seconds from the gateway regardless of what it was, which the original five fast network actions never noticed. `device.ts` now carries a per-action and per-facet timeout, a read batch takes the longest allowance it asked for, and everything stays inside the device's own `maxCommandTimeout` of 300 seconds.

**Parity.** The test now covers facets and the process allowlist as well as actions, checks the API enum exactly and in order, asserts the CLI's `actionFacets` map deep-equals the API's `DEVICE_ACTION_FACETS` — which closes the direction the old test could not see, an extra action in the CLI passing silently — and asserts the three proto copies are byte-identical, which nothing checked before. The proto gained a `DeviceFacet` enum mirroring `DeviceAction`. Five device parity tests pass. One unrelated parity test fails on `knowledge_fetch`, which is another session's in-flight work, not this phase's.

Go side: `gofmt`, `go vet`, `go build`, and `go test ./...` all green. New Go tests assert that a hostile parameter cannot change a single argv element of any action but `restart_user_process`, that the allowlist rejects anything unlisted, that every action names a known verifying facet, that every admitted facet has a collection script, and that the `processes` facet covers every allowlisted key.

**Stage B did not ship, and the blocker is not the one the plan expected.**

Phase 3 is landing in a parallel session as this was written — `grpc.ts` now requires TLS material and verifies a per-device credential hash with revocation, and the daemon dials with real TLS credentials — but its Progress Log is still empty and the work is uncommitted, so this session does not declare that gate cleared on another session's behalf.

It would not unblock Stage B on its own. `cli/docs/cua-spike.md` records a prior finding that this session confirms: `cua-computer-server` exposes low-level screenshot, pointer, keyboard, window, and shell primitives, but **no objective-submission endpoint and no server-side reasoning loop**. The contract Stage B is written against — hand it an objective, receive a result — does not exist to call. The two ways around it are both closed: putting the reasoning in axel-cli contradicts the component boundary that the CLI holds none, and forwarding a free-form objective as a shell or input command destroys the typed-action boundary that Stage A just widened.

Per the session protocol, this is recorded and stopped at rather than worked around. Unblocking Stage B needs the tier-two contract respecified as typed GUI steps generated by Axel, with matching proto and API schema — which is a design change, not an implementation task, and larger than the line item in this plan. The refusal in `daemon.go` is unchanged and correct.

**Stage C has a gate design and no code.** Written into this document above, taking the recommended shape — Axel proposes, a human approves through the existing change-enablement vocabulary, the API dispatches from the approved record. It is marked not yet agreed, and no Stage C code exists.

**Out of scope, stated rather than left unsaid.** Duplicate suppression is still partial: a device that has already accepted a sequence reports the outcome as *indeterminate* rather than replaying the original result, and in-flight commands are still lost when the API restarts. Widening the action set widens the consequence of both — "did that action already run" is now unanswerable across twelve actions instead of five. Not fixed here.

One trade-off worth naming: `restart_user_process` force-terminates, and the allowlist now includes applications where that costs the user unsaved state — an Outlook draft, an unsaved document. Every one of them recovers on restart, and the alternative is escalating a stuck application to a human, but it is a real change in what a wrong tool call can cost. A graceful close before the force kill would reduce it and would change the action's execution semantics, which this phase did not do.

### 2026-08-31 — Both open decisions researched and taken. Still no Stage B or Stage C code.

Asked to choose rather than ask, so both were researched against the working tree first and the designs above were revised from what that found.

**Stage B: the tier-two contract is respecified, as a design, above.** The spike option was considered and is not executable — this machine has no network and no `cua-computer-server` on the loopback port, so probing the live primitives was impossible and the design was written from the spike's recorded surface instead.

The substance of the respec: `objective` disappears entirely. The GUI stops being a special tier and becomes a surface that obeys the rule every other surface already obeys — reads are facets, writes are typed actions, every write is verified by the read that observes it. Axel looks at a new `screen` facet, decides one typed step, sends it, and looks again. Reasoning stays in Axel, so the component boundary holds without special pleading, and the contract is one the server can actually serve.

The `shell` and `file` primitives are deliberately not exposed, because exposing them would make tier two into general local execution without Stage C's gates. The genuine new risk is `type_text`, which puts model-chosen text wherever focus happens to be — if that is a terminal, the keyboard becomes a shell. The mitigation has to live on the device, the only place that knows what is focused. That is written up rather than left to be discovered during implementation.

**Stage C: the gate design is agreed in shape, and the code is deferred.** Not deferred for lack of appetite — deferred because reading the code turned up three things that make writing it now premature or wrong:

The approver has nowhere to see the command. `implementationPlan` is written by the existing cluster path and is exposed by no contract and rendered by no screen; the approvals screen truncates its one free-text field to a single line. The central premise of the gate — a human reads the exact command and approves it — currently has no surface. That is a build item, and a gate without it would be theatre.

A standard change approves itself. `changeApproval()` returns `approved` for standard changes unconditionally and `updateChange` skips the CAB check for them, which is exactly what `patchImageWithChange` relies on. Had the first draft been implemented as written, the gate would have opened itself.

The migration journal is drifted across parallel sessions — head at `idx` 32 while on-disk migrations run to `0042`, one entry tagged from a different file, several files with no entry. The opt-in flag needs a migration, and generating one against that state would collide with other sessions' work.

The design above was rewritten against all of this: `approvals` for the decision rather than `changes`, because it is the single-decider shape and already blocks agent dispatch; `changeTransitions`' actor pattern for the record, because `deviceCommands` has no actor or authorization columns and cannot answer who authorized a command; and `assertEnvironmentAllowed` as the refusal site, because it already throws before any side effect and the gRPC layer already records the refusal.

**What both decisions have in common:** neither was blocked on taste. Both were blocked on something the code says, and in both cases the research changed the design rather than confirming it.

**Later the same day — the Stage B design was measured and then rewritten again.**

The respec above originally designed a typed-step protocol on top of cua. Before recording it, the assumption underneath it was tested on this machine, and it did not survive.

Windows UI Automation is reachable from PowerShell, non-admin, with no new dependency. Enumerating a browser window returned 392 descendants and 57 actionable controls in 267ms; across all visible windows there were 199 controls supporting `InvokePattern`, 28 supporting `ValuePattern`, and 24 supporting `TogglePattern`. Serialising one window's 50 actionable controls produced 4.8KB of JSON, roughly 1,200 tokens, in 499ms.

That matters because of *why* cua was chosen. `architecture.md` picked it over Agent-S because its driver works in the background without stealing the cursor or focus. UI Automation is the API screen readers use and has that property natively — so the deciding property is already present on every Windows machine, without a Python process, a vision model, or a network install.

It also lands the right way round on the trust boundary, which the cua-based draft never quite did. The facet enumerates the controls that exist; a step selects one by name from that enumeration. Caller input picks a key out of a set the device produced. That is `restart_user_process`'s allowlist shape generalised to the GUI, so tier two stops being an exception to the tier-one invariant and becomes another instance of it — and the `type_text`-into-a-terminal risk the earlier draft had to mitigate with a denylist disappears structurally, because there is no free keyboard step left to abuse.

cua does not go away. It becomes the fallback for surfaces with no accessibility tree — the graphics overlay in the survey reported zero descendants, Electron apps expose little, and remote desktop and canvas applications are pixels by nature. But it stops being the mechanism for tier two, which means the "no objective-submission endpoint" blocker is no longer on the critical path. **Stage B is substantially less blocked than it was this morning, and for a reason nobody would have found without measuring.**

Not verified, and named as such in the design: invocation itself was not executed, because doing so would have clicked real controls on a working machine. Pattern *support* was measured; pattern *behaviour* is documented rather than observed. Confirming it on a scratch VM is the first task if this is agreed.

**And the Stage C design was stress-tested, and did not survive.**

The `approvals`-based design above was handed to an adversarial review with instructions to find where it breaks rather than confirm it. It broke in five places, two of them fatal, and the worst was not the one anticipated.

The fatal one reshapes the whole stage: **no run can wait.** A run holds a 45-second lease renewed only by agent-driven events, the agent has a 300-second hard deadline, a device command times out in 30 to 120 seconds, there is no `paused` run status, there is no resume message in the proto, and a gateway restart fails every running run. Against a human approval measured in hours, "propose, wait, then dispatch" simply has no host in this system. Every version of the design up to that point assumed a run could sit and wait for a person. None can.

The second fatal one was worse than the deadlock that was suspected. Reusing `approvals` would have made the retry loop non-terminating — the only thing that could dispatch an approved command is a new run, and a new run is blocked by the very row it waits on, then starts with an empty transcript and re-proposes. And because nothing in the codebase ever deletes, resets, or reopens an approval row, a single *rejection* would leave the ticket permanently unrunnable and unclosable, with no escape short of SQL. A gate that bricks the ticket when a human says no is worse than no gate.

Three more: both existing approval guards read the newest row by time, so a device-command approval would launder a previously rejected catalogue approval; `decideApproval` has no requester-is-not-approver rule and the seeds grant `device.command` and `approval.decide` to the same role, with every user seeded into it; and `approvals` has nowhere to put an argv except a free-text note the dashboard truncates to one line, with nothing binding the dispatched command to the approved text and nothing consuming an approved row.

The design was rewritten a third time around what the evidence actually permits: **the run proposes and escalates rather than waiting.** Axel writes a proposal and the run ends — escalation with a clear diagnosis is already a first-class good outcome here, so this needs no lease extension, no paused status, and no resume protocol. A human approves later, and approval dispatches the command outside any run. The proposal lives in its own table rather than in `approvals`, which removes the collision, the laundering, the bricking, and the reporter-facing leakage in one move, and it carries the argv, a digest, an expiry, single-use consumption, and an approver — none of which `approvals` can hold.

What remains genuinely unresolved is who may approve. There is no capability meaning "may authorise a privileged action on a device", and the role that can issue device commands is the same role that can decide approvals.

Worth stating plainly, because it is the argument for having done this at all: **every one of these failures would have been found in production rather than in a document.** The `approvals`-based design looked entirely reasonable, reused existing infrastructure exactly as the plan asked, and would have bricked tickets the first time an operator clicked Reject.

**One finding for whoever owns Phase 3, since overtaken.** `src/env.ts` briefly required `AXIOMA_GRPC_TLS_CERT` and `AXIOMA_GRPC_TLS_KEY`, which broke every API test in CI because the workflow does not set them. That session has since moved the requirement to server start in `grpc.ts`, so CI needs no change. Recorded because it was true when written and is not now.

### 2026-08-31, later — Stage B shipped. Tier two exists, and it is not cua.

The measurement recorded above said cua was not needed for most GUI remediation. That was then built, and it works.

**What shipped.** One new facet and five new actions, taking the typed surface to seventeen actions and eleven facets.

The `screen` facet returns the accessibility tree of one window, reduced to the controls something can act on — name, role, whether it is enabled, and which UI Automation patterns it supports. It takes an optional `window` title substring; omitted means the foreground window. Text, not pixels.

The five actions are `gui_invoke_control`, `gui_set_control_value`, `gui_toggle_control`, `gui_select_item`, and `gui_expand_control`. Each drives exactly one UI Automation pattern on a control the `screen` facet has already reported, and each is verified by `screen`.

**The boundary this lands on is the point.** The facet enumerates the controls that exist; a step selects one by name from that enumeration. Caller input picks a key out of a set the device produced — the same shape as the `restart_user_process` allowlist, generalised to the GUI. Tier two stopped being an exception to the tier-one invariant and became another instance of it. There are no coordinates, so nothing drifts with resolution, and there is no free keyboard step, so there is no way to type into whatever happens to have focus. The earlier draft of this design needed a terminal denylist to make `type_text` safe; that mitigation is gone because the thing it mitigated is gone.

**Three things the implementation found that the design did not.**

An uncached UI Automation walk of a browser window measured **twenty-one seconds**, because every property read is a separate call into the target process. A cached request collapses that to **3.6 seconds** and roughly 2.9KB of JSON. Without that, the facet would not have fit any sane read budget. The design assumed the 267ms figure from an already-warm in-process measurement, which was not representative.

**A caller value bound through `powershell.exe -Command "& { param($x) ... }" value` is silently re-split on spaces.** Control names are almost entirely multi-word, so this broke immediately. Caller values now travel in the **environment** instead, which is both correct and stronger: an environment value cannot be parsed as code no matter what it contains, whereas argv binding was one quoting bug away from being a shell. This is a latent flaw in the pre-existing `reachability` binding too — it does not bite there only because `validateTarget` rejects anything with a space. Left alone, noted here.

`facetCommand` forwarded a parameter only for `reachability`, so the new facet's window filter was silently dropped and it read the foreground window instead. Caught by the live test picking a control out of a media player. This is the kind of thing a fixture cannot find.

**Verified on a real machine, not just in unit tests.** `gui_live_windows_test.go` drives a throwaway Notepad through the actual Go dispatch path — `ReadStateWithParams` for the `screen` facet, `RunAction` for `gui_set_control_value`, then a second read confirming the facet observed the write. It is opt-in behind `AXIOMA_LIVE_GUI_TEST` because it drives a real window and has no business firing during an ordinary `go test`. Its refusal paths are less well covered than that sentence would suggest, and the audit below caught the overclaim. The script refuses a missing control, an ambiguous name, a disabled control, and a control that does not support the requested pattern — but all four live inside the PowerShell and are exercised only by hand. What ordinary tests do cover is the Go side: the parameter bounds, and that hostile text in a control name reaches the environment rather than argv, where it is looked up as a literal name and found absent rather than executed.

**What UI Automation did not change.** cua is still unimplemented and the `computer_use` refusal in `daemon.go` is untouched. It is now the fallback for surfaces with no accessibility tree — canvas applications, remote desktop, Citrix, some Electron — rather than the mechanism for tier two. The spike finding still stands and still blocks that path; it no longer blocks GUI remediation generally, which is the correction that matters.

One vindication worth recording: UI Automation needs the interactive desktop session. That is exactly what the logon Scheduled Task provides and what a session-0 Windows service could not — a decision `architecture.md` argued for on entirely different grounds.

**Verification at this point:** 73 Go tests, `gofmt`, `go vet`, `go build` clean; 9 of 9 parity tests including the new GUI vocabulary across all four surfaces; 65 agent tests; proto mirrored and Go bindings regenerated. Documentation updated to match.

**Stage C remains unbuilt and correctly so.** Its design survived three revisions above; what blocks the code is not taste but the migration journal, whose head is `idx` 32 while on-disk migrations run to `0042`, with one entry tagged from a different file. Stage C needs a new table and new columns, and generating them against a journal three other sessions are actively writing would collide with their work. That is a coordination problem, not a design one.

**Corrections made while documenting, from a review of the shipped code against the docs.**

The measurement figures first written here were misleading. 267ms and 4.8KB came from a warm in-process probe of 50 controls; the facet as it actually runs is a cold PowerShell process capped at 30 controls, which measures 3.6 seconds and 2.9KB. Both numbers were real, but only one describes what a device read costs, and that is the one the documents now cite.

The system prompt said *prefer a typed action over driving a GUI*, which stopped separating anything the moment the GUI steps became typed actions. It now distinguishes what actually differs: an action that changes configuration directly against one that drives a control, a step at a time. It also tells the model to read the `screen` facet before naming a control, because a control the facet did not report is refused.

`DeviceComputerUse`'s docstring and the `computer_use` comment in the proto both described that field as the whole of tier two. They now describe the pixel fallback, which is all it is.

And the respec section above was left in place rather than rewritten, with a note on how the implementation diverged from it. It proposed a new `device_gui_step` tool; what shipped puts the GUI steps in `device_run_action` alongside every other action. That is the stronger form of the same argument — if the GUI is genuinely just another surface obeying the same rule, it should not need its own tool, its own proto message, or its own dispatch path, and it turned out not to.

### 2026-08-31, later still — Stage C shipped. All three stages are done.

The two blockers recorded above were treated as mine to resolve rather than as reasons to stop, and both had answers.

**Who may approve.** A new capability, `device.approve`, granted to `platform-engineer` and deliberately **not** to `it-analyst`. That is the separation of duty the review found missing: `device.command` means *may issue a typed action* and is held by every analyst, so reusing `approval.decide` would have let the same person propose and authorise. Adding a capability meant three coordinated edits, because the vocabulary is a CHECK constraint generated from the TypeScript array rather than a table — the `CAPABILITIES` list, `role_capabilities_key_check`, and `role_grants_capability_check`.

**The migration journal.** Hand-written, as the last four migrations were. `drizzle-kit generate` would have diffed against the `0034` snapshot — the newest that exists, though the journal is at 36 — and emitted one enormous migration re-containing everything applied since, swallowing three other sessions' uncommitted schema work. `0045_device_command_proposals.sql` plus one journal entry, matching what those sessions did.

**What shipped.**

`device_command_proposals` carries the device, the ticket, the originating run and step, the argument vector, a digest of it, the reason written for the approver, a status, the approver and decision time, an expiry, and the command it was consumed by. `devices.execution_enabled` defaults false. `device_commands.proposal_id` is what finally makes *who authorised this* answerable — that table had no actor column at all.

`device_propose_command` writes a row and returns. The run then escalates with its diagnosis, because a run holds a 45-second lease and a person decides in hours; the review's fatal finding was that no run can wait and nothing can resume one, so nothing waits. Approval dispatches the command from the stored row, outside any run, through a `device_run_command` branch that `executeTool` cannot reach.

The device refuses independently. `run_command` is implemented in the CLI and is **absent from the agent's action literal and the API's action enum on purpose** — the model cannot select it. On the device it requires both a proposal reference and a local opt-in marker file, and it executes the vector directly with no shell, so a metacharacter is an ordinary argument rather than syntax. The parity test asserts that asymmetry explicitly rather than excusing it.

Approvers get their own screen. `implementationPlan` was invisible to every client, which is what made the earlier design theatre; the proposal contract carries the argument vector in full and the page renders it untruncated as inert text — never a link, never anything runnable from there. It is a separate queue from catalogue approvals, so "new mouse please" and a command on someone's laptop are not the same two-line row behind the same button.

**Tests, against the plan's own acceptance list.** No registered tool executes a caller-supplied command, and a test asserts a general-execution tool is *not* in the registry. A proposal must be an argument vector — command lines, control characters, and empty vectors are refused. Dispatch is refused when the proposal is unapproved, expired, on an opted-out device, already dispatched, or when the command was edited after approval. The digest distinguishes argument boundaries, so `["a","b"]` and `["a b"]` are not the same command. An approval authorises exactly one execution, claimed by a status predicate so a concurrent dispatch loses rather than double-running. And the injection case the plan names: a ticket body instructing a command produces at most a row awaiting a person.

**Where the earlier designs would have failed, and do not now.** Each proposal is its own row in its own table, so there is no per-ticket unique index to violate, no latest-row-wins guard to launder a rejection through, and no path by which rejecting one leaves a ticket unrunnable or unclosable. Rejection is terminal for the proposal and touches nothing else.

**Honest limits.** The approval path has unit coverage but no end-to-end test through a live gateway and a real device — that needs a database, a running gateway, and an enrolled machine, none of which exist here. `expireStaleProposals` runs on read rather than on a sweep timer, so a proposal expires the next time someone looks; that is enough to keep an approver from acting on something stale, and less than a scheduled sweep would give.

**All three stages of this plan are now implemented.** Stage A widened tier one to twelve actions and ten facets. Stage B built tier two on UI Automation, which turned out not to need cua at all. Stage C put general execution behind a human, where the plan said it belonged.

**One gap found while documenting, and closed rather than recorded.** `WRITE_EFFECT_TOOLS` did not list `device_propose_command`, which looked like a defensible omission — a proposal touches no device, so shadow mode arguably need not refuse it. It was not defensible. Approval dispatches through an oRPC route that never sees the run's environment, so a shadow run could have left behind a proposal that a later approval executed against a real device. Proposal time is the only point where the environment is still known, so the tool is now listed there deliberately, with a test asserting a shadow environment cannot propose while still being able to read and diagnose.

That is the second time in this phase that something written down as an acceptable limitation turned out, on one more question, to be a hole. Both times the question was the same: *what happens to this later, somewhere the check does not run?*

### 2026-08-31, closing — an adversarial audit of this document against the tree

The plan was read back against the code by a reviewer told to falsify it rather than confirm it. It found the claim mostly real and several statements in this log false. Both are worth having.

**Fixed in code.**

*Control names were truncated to 60 characters by the `screen` facet while a GUI step matched the name exactly.* Any control with a longer name was enumerable and then permanently unreachable — the model would read it, name it verbatim, and be told it does not exist. The name is the address, so the truncation is gone and the payload is bounded by the control cap alone.

*A window filter was a wildcard, not a literal.* `-like "*$window*"` made a caller-supplied `*` widen the match rather than be matched, and the first window silently won. Both scripts now compare literally.

*The approver's screen joined the argument vector into one line.* A test three files away asserts that `["a","b"]` and `["a b"]` are different commands with different digests; the one human who is the entire gate saw them as identical text. Arguments now render one per line, labelled.

*The system prompt claimed an enforcement that does not exist.* It told the model that a control the `screen` facet did not report "will be refused". Nothing binds a step to a preceding read — the device looks the name up live — and the facet's own control cap means unreported controls are actuatable. The prompt now says what is true: a name you did not just read is a guess. The stricter binding remains the open question this document already recorded, and it is now not contradicted by the prompt.

*`device_read_state`'s description omitted `screen`* while the prompt told the model to read it first.

*Parity did not actually pin the agent's action enum.* The agent side was a substring scan over the whole of `tools.py`, so an action deleted from the `Literal` still passed on the copy in `DEVICE_GUI_STEPS`. It is now scoped to the literal and compared exactly, which is what the other three surfaces already had.

**Tests added.** Agent-side coverage of the widened surface existed nowhere: the GUI step validators, the `screen` facet's window parameter, the proposal schema bounds, that the model cannot select `run_command`, and that proposing names no verifier while every other device write does. Plus the per-action and per-facet timeout table, which was unasserted, and the API-side refusal of an approved-command dispatch carrying no approval — the row this plan asks for by name.

**Left standing, and stated rather than fixed.** The verification obligation is weaker than this document's own testing table implies: `_same_resource` in the loop strips `facets`, `parameters`, and `action`, so for device tools only `device_id` is compared and *any* device read discharges *any* device write. The plan says "a `device_read_state` **that observes it**"; the loop enforces "a `device_read_state` on the same device". That is a pre-existing property of the run loop, not something this phase introduced, and tightening it is a change to `loop.py` that belongs with whoever owns the loop. The `actionFacets` maps are likewise a contract between two hand-maintained lists rather than something consulted at runtime.

And CI still compiles almost none of this. The `cli` job runs on Linux, where `runAction`, `runSpec`, and `readFacet` are `unsupported platform` stubs — so `facetCommand`, the function that silently dropped a parameter earlier in this phase, is never built there. The Windows tests and the live GUI test are excluded by build tag and by opt-in. Nothing in CI proves tier two works end to end; only a Windows machine does.

**Closing the audit's gaps against a real database.** Four acceptance items were unbacked because they needed Postgres, which the earlier passes assumed was unavailable. It was not — `docker compose up` brought the existing `axioma-postgres` up, and that made two things possible.

`drizzle-kit migrate` applied `0045` cleanly against the real database, which had never been proven; the table, the `execution_enabled` column, the `proposal_id` column, and both CHECK-constraint swaps all landed. And the capability separation is now asserted against the seeded grants rather than against the migration text: `it-analyst` holds `device.approve` zero times, `platform-engineer` once.

The rest of the suite asserts the properties the earlier design failed on. A proposal against an opted-out device is refused *and leaves no row*. A proposal writes exactly one pending row — unapproved, unconsumed, digest-bound to that vector, linked to the ticket. Proposing does not move the ticket's status or touch its runs, which is the finding that reshaped this stage. And a device proposal creates no row in `approvals` — the table whose guards would otherwise freeze the ticket on a rejection.

Two items stay open and are marked `[~]` rather than ticked. Recording who authorised a command needs a device on the other end of the gateway, not just a database. And a proposal still cannot be checked against the identity that caused it, because nothing records who starts a run.

**The last three acceptance items, closed.** Two were only ever blocked by the assumption that no database was available, and one by a missing column.

Recording the authorising approval turned out to be testable without a device at all: `dispatch_device_tool` writes the command row before it looks the device up, so dispatching to a disconnected machine leaves exactly the row the audit trail depends on.

The rejection regression is now asserted for both outcomes — rejected and expired — and checks the three things the abandoned design got wrong: no row in `approvals`, the ticket untouched, and the proposal terminal afterwards. It also asserts a second proposal on the same ticket is allowed, which the per-ticket unique index would have prevented.

Self-approval needed schema. `agent_runs.started_by_id` records who set a run going, `startTicketRun` takes it from the router's authenticated user, and the proposal copies it at creation so the check survives the run being deleted. Approving your own run's proposal is refused and the decision rolled back. An auto-dispatched run has no initiator, so nothing is blocked by a null. Migration `0046` applied cleanly against the running database.

Nine of nine Stage C acceptance items are now met, and the two that remained unmet were unmet for reasons this session created rather than found.
