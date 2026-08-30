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

> **Unsigned binary:** `axel-cli.exe` is not code-signed. Windows SmartScreen may warn, and managed-device policy may block it. Signing is not included in this milestone.

Run PowerShell as the user who should own and run the agent; administrator rights are neither required nor recommended:

```powershell
.\scripts\install.ps1 -Gateway 'gateway.example.com:50051'
```

The installer validates its inputs, copies `dist\axel-cli.exe` to `%LOCALAPPDATA%\axioma\axel-cli.exe`, persists the gateway in `%LOCALAPPDATA%\axioma\config.json`, registers the **Axioma Axel Agent** `ONLOGON` Scheduled Task with `LIMITED` privileges, and starts it immediately. The task runs in that user's session so it can access the user's profile and applications.

Check the task or agent afterward:

```powershell
schtasks.exe /Query /TN 'Axioma Axel Agent' /V /FO LIST
& "$env:LOCALAPPDATA\axioma\axel-cli.exe" status
```

## Uninstall

```powershell
.\scripts\uninstall.ps1
```

This stops and removes the Scheduled Task and deletes `%LOCALAPPDATA%\axioma`, including the binary, persisted gateway, device identity, sequence, and daemon state. Use `-WhatIf` to preview this destructive cleanup.

## Device actions

Tier one consists of the fixed typed actions implemented in `internal/device`. No shell command string crosses the gateway boundary.

## Optional computer-use (`cua`)

Computer-use is separate from the base install. The current Go binary refuses computer-use requests; installing Python packages alone does **not** enable integration until milestone D's local client is implemented.

For development of that optional tier, install the server package separately:

```powershell
python -m pip install "cua-computer-server[driver]"
python -m computer_server --backend cua-driver --capture-scope desktop
```

The driver extra provides the native Cua Driver backend. The D0 result is recorded in `docs/cua-spike.md`: computer-server exposes low-level actions but no safe objective-level transcript contract, so positive dispatch awaits a typed GUI-step protocol. A device without working integration refuses the request rather than falling back to cursor-stealing automation.
