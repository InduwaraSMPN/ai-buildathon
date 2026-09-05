# axel-cli

A single Go binary that connects an employee Windows device to Axiōma. The daemon makes an outbound gateway connection, executes only typed actions, and runs as the logged-in user rather than as an elevated Windows service.

## Build

From this directory, with Go and Git available:

```powershell
.\scripts\build.ps1 -Version 0.1.0
.\dist\axel-cli.exe version
```

The script cross-compiles Windows/amd64 `dist\axel-cli.exe` and stamps the version, Git commit, and UTC build date using Go linker flags. `-Commit` and `-BuildDate` can be supplied explicitly for reproducible release builds.

## Development

`api/proto/axioma.proto` is canonical. The generated bindings in `internal/pb`
must be regenerated rather than edited, and committed whenever they change.
Generation requires Go and either `protoc` on `PATH` or `uv` for the pinned
`grpcio-tools` fallback. The script installs pinned Go protobuf plugins automatically.

```powershell
pwsh scripts/generate-proto.ps1
go vet ./...
go test ./...
go build ./...
```

## Install on Windows (non-admin)

> **Unsigned binary:** `axel-cli.exe` is not code-signed. Windows SmartScreen may warn, and managed-device policy may block it. Signing is deferred because no Authenticode certificate is available; procurement is typically several hundred US dollars per year plus CI key/HSM integration.

Run PowerShell as the user who should own and run the agent; administrator rights are neither required nor recommended:

```powershell
.\scripts\install.ps1 -Gateway 'gateway.example.com:50051'
& "$env:LOCALAPPDATA\axioma\axel-cli.exe" enroll
schtasks.exe /End /TN 'Axiōma Axel Agent'; schtasks.exe /Run /TN 'Axiōma Axel Agent'
```

`enroll` asks for the single-use token issued from the dashboard. The daemon loads its identity once, at start-up, so one that is already running has to be restarted before it will present a token written after it started — hence the third line.

For an internal or self-signed gateway certificate, pass `-CAFile 'C:\certs\corp-root.pem'` to the installer; it is written to `caFile` in `%LOCALAPPDATA%\axioma\config.json`. Set `tlsServerName` in the same file when the dial address is not the certificate name. Verification cannot be disabled, so a gateway whose CA is not configured fails the handshake — silently, because the daemon runs as a Scheduled Task with nowhere to write.

The installer validates its inputs and copies `dist\axel-cli.exe` or `bin\axel-cli.exe` — whichever is present, the newer one when both are, and it reports which — to `%LOCALAPPDATA%\axioma\axel-cli.exe`. It merges the gateway and CA into `%LOCALAPPDATA%\axioma\config.json` rather than rewriting the file, so settings added by hand survive a re-run. It then registers the **Axiōma Axel Agent** `ONLOGON` Scheduled Task with `LIMITED` privileges and starts it, stopping and waiting out a task that already exists first. The task runs in that user's session so it can access the user's profile and applications.

Check the task or agent afterward:

```powershell
schtasks.exe /Query /TN 'Axiōma Axel Agent' /V /FO LIST
& "$env:LOCALAPPDATA\axioma\axel-cli.exe" status
```

## Uninstall

```powershell
.\scripts\uninstall.ps1
```

This stops and removes the Scheduled Task and deletes `%LOCALAPPDATA%\axioma`, including the binary, persisted gateway, device identity, sequence, and daemon state. Use `-WhatIf` to preview this destructive cleanup.

## Device actions

Both remediation tiers are fixed typed actions implemented in `internal/device`. The gateway sends an action name and typed parameters; the argument vector for each action is written into this binary. No shell command string crosses the gateway boundary.

Seventeen selectable actions ship today — twelve tier-one actions and five tier-two GUI steps — each paired with the diagnostic facet that observes its effect. An eighteenth, `run_command`, is implemented here and described below; it is not in the model-facing action set and cannot be chosen by an agent. `device_run_action` names `device_read_state` as its verifier, so an action whose result no facet can see cannot be confirmed and is not added.

| Action | Effect | Verified by |
|---|---|---|
| `flush_dns` | Clears the DNS resolver cache | `resolver` |
| `renew_dhcp_lease` | Renews the DHCP lease on the adapters | `adapters` |
| `clear_proxy_override` | Removes the per-user proxy override | `proxy` |
| `disable_proxy` | Turns the per-user proxy off | `proxy` |
| `reset_credential_cache` | Purges the Kerberos ticket cache | `identity` |
| `refresh_certificate_store` | Pulses the user certificate store | `certificates` |
| `clear_temp_files` | Empties the user temp directory | `storage` |
| `clear_outlook_cache` | Clears the Outlook RoamCache | `app_cache` |
| `clear_teams_cache` | Clears the Teams local cache | `app_cache` |
| `clear_icon_cache` | Clears the Explorer icon and thumbnail caches | `app_cache` |
| `clear_print_queue` | Removes queued print jobs | `printing` |
| `restart_user_process` | Stops and relaunches one allowlisted application | `processes` |
| `gui_invoke_control` | Presses one named control — `InvokePattern` | `screen` |
| `gui_set_control_value` | Sets one named field's value — `ValuePattern` | `screen` |
| `gui_toggle_control` | Toggles one named control — `TogglePattern` | `screen` |
| `gui_select_item` | Selects one named item — `SelectionItemPattern` | `screen` |
| `gui_expand_control` | Expands or collapses one named control — `ExpandCollapsePattern` | `screen` |

Two kinds of action take a caller-supplied parameter, and in both the parameter selects out of something the device itself reported rather than supplying a string the device runs.

`restart_user_process` takes `process_name` — or the flattened `processName`, accepted for compatibility — which must name one of eight applications:

`notepad` · `explorer` · `outlook` · `teams` · `onedrive` · `msedge` · `chrome` · `slack`

Anything else is refused. The `processes` facet observes every key in that map, so the allowlist and the read that verifies it cannot drift apart.

The five `gui_*` steps take `control`, an optional `window`, and — for `gui_set_control_value` — `value`. `control` must name a control the `screen` facet reported for that window, and a step is refused when the named control is missing, ambiguous, offscreen, disabled, or does not support the pattern requested. There are no coordinates, so no pixel drift, and no free-text keyboard step, so nothing can type into whatever happens to have focus.

One invariant holds across all seventeen: each action runs non-admin as the logged-in user, every argument vector is a constant written into this binary, and no caller-supplied string is ever concatenated into a command. The GUI steps' window, control, and value travel in the environment instead, where the shell cannot parse them as code — a value bound through `powershell.exe -Command "& { param($x) ... }"` is silently re-split on spaces, and control names are full of them.

`run_command` is the exception, and it is gated on both ends. It is the one action whose argument vector comes from the caller rather than from this binary, and it exists so a person can authorise a command Axiōma has no typed action for. The gateway dispatches it only from a proposal a `device.approve` holder approved, never from an agent run. This binary refuses it independently of that: without a proposal reference in the parameters, or without an `execution-enabled` marker file present at `%LOCALAPPDATA%\axioma\execution-enabled` on this machine, it will not run — so an operator has to opt this device in, and a compromised gateway alone is not sufficient. The vector is validated the same way every other input is (1 to 32 arguments, 1 to 1024 characters each, no control characters) and then executed directly with `exec`. No shell is started, so a metacharacter in an argument is an ordinary character rather than syntax, and the action still names the `processes` facet as its verifier.

### Diagnostic facets

`device_read_state` collects any of eleven facets:

`resolver` · `adapters` · `reachability` · `proxy` · `identity` · `processes` · `certificates` · `storage` · `app_cache` · `printing` · `screen`

Two of them take a parameter. `reachability` requires `target`, a validated hostname or IP address, and is the only facet no action is paired with. `screen` takes an optional `window` — a substring matched against window titles — and reads the foreground window when it is omitted; it returns that window's accessibility tree reduced to actionable controls, each with its name, its role, whether it is enabled, and which UI Automation patterns it supports. The table above names which facet verifies each action.

## GUI remediation, and the optional pixel fallback (`cua`)

Tier two ships, and it is Windows UI Automation rather than cua. The `screen` facet and the five `gui_*` steps above are the whole mechanism: PowerShell against the UI Automation client assemblies, non-admin, with no new dependency, no Python, no vision model, and nothing fetched over the network. It works here because the daemon runs as a logon Scheduled Task in the interactive desktop session — UI Automation needs that session, and a session-0 Windows service could not have provided it.

The trust boundary is the one tier one already had. The facet enumerates the controls that exist; a step names one of them. Caller input selects a key out of a set the device produced rather than supplying anything executable — the `restart_user_process` allowlist, generalised to the GUI.

Measured on a real machine, as the facet actually runs — a cold PowerShell process, capped at thirty controls: one browser window takes 3.6 seconds and 2.9KB of JSON. A UI Automation *cached request* is what makes that viable — the uncached form of the same script measured twenty-one seconds, because every property read is a separate call into the target process.

`TestLiveGUIStepAgainstNotepad` drives a real Notepad through the Go dispatch path: read the `screen` facet, `gui_set_control_value`, then re-read and confirm the facet observed the write. It is opt-in, because it drives a real window.

```powershell
$env:AXIOMA_LIVE_GUI_TEST = '1'
go test ./internal/device -run TestLiveGUIStepAgainstNotepad -v
```

Not every surface exposes an accessibility tree. Canvas-drawn applications, remote desktop, Citrix, and some Electron applications do not, and **cua is the fallback for those — it is not implemented**. The Go binary refuses every computer-use request unconditionally, on a machine with the server installed as readily as on one without, so installing the Python packages alone does not enable integration.

For development of that optional tier, install the server package separately:

```powershell
python -m pip install "cua-computer-server[driver]"
python -m computer_server --backend cua-driver --capture-scope desktop
```

The driver extra provides the native Cua Driver backend.

What blocks the positive path is recorded in `docs/cua-spike.md`, and it has not moved: computer-server exposes low-level screenshot, pointer, keyboard, window, and shell primitives, but no objective-submission endpoint and no server-side reasoning loop — so the contract this CLI would call, submit an objective and receive a step transcript, does not exist. Implementing that reasoning here would break the rule that axel-cli holds none, and forwarding a free-form objective as a shell or input command would break the typed-action boundary above. That gate applies to the pixel fallback alone; the accessible GUI needed neither a driver nor an objective contract.

The device channel is the other precondition, and that one is being fixed: authenticating it is Phase 3's work and is landing — the gateway requires TLS material and verifies a per-device credential on hello, and the daemon dials with real transport credentials. Widening what a device will do on instruction is gated on that landing. A device with no working pixel integration refuses the request rather than falling back to cursor-stealing automation.
