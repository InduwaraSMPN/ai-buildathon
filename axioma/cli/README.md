# axel-cli

Go. One static binary, no runtime to install on an employee laptop — which is
the whole reason this component is not TypeScript like the API and the
frontends.

Two modes:

- **`axel-cli daemon`** — headless. Holds an outbound connection to the API,
  executes typed actions, reports results. Runs as a logon Scheduled Task, so
  there is no terminal attached and no TUI.
- **`axel-cli status | enroll | doctor`** — operator-facing, for IT staff on a
  machine they are debugging. These use [Bubble Tea
  v2](https://charm.land/bubbletea) (`charm.land/bubbletea/v2`) with Lip Gloss
  for styling.

Outbound only: the device dials the gateway. It works through NAT, on home
networks, and behind corporate proxies without a firewall change.

## Build

```bash
go build -o bin/axel-cli ./cmd/axel-cli
GOOS=windows GOARCH=amd64 go build -o dist/axel-cli.exe ./cmd/axel-cli
```

## Install on Windows

A logon Scheduled Task as the interactive user, not a service. A service runs as
LocalSystem in session 0 and cannot reach the user profile, mapped drives, or
per-user applications — which is where most real laptop problems live. It also
installs without administrator rights.

```powershell
schtasks /Create /TN "AxelAgent" /SC ONLOGON /RL LIMITED /F /TR "%LOCALAPPDATA%\axioma\axel-cli.exe daemon"
```

## Device actions

**Tier one — typed actions.** A fixed set, implemented in `internal/device`. The
gateway sends an action name and typed parameters; the argument list for each is
written out in this binary. No command string crosses the boundary, which is what
stops a ticket talking the agent into running something arbitrary.

**Tier two — computer-use.** Driving the GUI, for the tail of problems with no
programmatic path: GUI-only vendor apps, legacy config panels, one-off things
nobody scripted.

This tier is **not part of the base install**. It requires
[cua](https://github.com/trycua/cua) on the device:

```bash
pip install cua-driver cua-computer-server
```

`cua-driver` is the piece that matters. Its driver runs in the background —
agents "click, type, and verify without stealing the cursor or focus" — which is
the property that makes this acceptable on a laptop somebody is working on. An
agent that seizes the cursor mid-meeting is worse than no agent.

cua is Python and this binary is Go, so the language boundary is a process
boundary: `cua-computer-server` runs locally and `axel-cli` drives it over its
local API. This binary keeps its job — hold the connection, receive typed
actions, orchestrate — and delegates only the GUI tier.

A device without cua installed **refuses** a computer-use request rather than
falling back to something else. That is the intended behaviour: the tiers are
ordered deliberately, and a missing tier two means escalate, not improvise.

## Why not Agent-S, and why not a cloud sandbox

[Agent-S](https://github.com/simular-ai/Agent-S) uses PyAutoGUI: it moves the
real mouse and takes the real keyboard. It also requires a separate grounding
model hosted alongside the reasoning model. Stronger on benchmarks; wrong for a
machine someone is using.

[E2B open-computer-use](https://github.com/e2b-dev/open-computer-use) drives a
remote cloud VM. The employee's resolver, VPN adapter, cached credentials, and
mapped drives are on *their* laptop — a pristine cloud VM has none of it, so
fixing something there fixes nothing.

`cua-sandbox` remains interesting for a disposable environment where an agent can
run code against infrastructure, but that is not this component and is not in
scope.
