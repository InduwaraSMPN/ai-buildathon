// Command axel-cli is the Axiōma device agent.
//
// One binary, two modes. `daemon` is headless and runs as a logon Scheduled
// Task, so there is no terminal attached to it. Every other subcommand is
// operator-facing — run by IT staff on a machine they are debugging — and those
// are where the terminal UI lives.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"syscall"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/cua"
	"github.com/axioma/cli/internal/device"
	"github.com/axioma/cli/internal/tui"
)

var (
	agentVersion = "dev"
	commit       = "unknown"
	buildDate    = "unknown"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var err error
	switch os.Args[1] {
	case "daemon":
		err = runDaemon(ctx)
	case "status":
		err = runStatus(ctx)
	case "enroll":
		err = runEnroll(ctx)
	case "doctor":
		err = runDoctor(ctx)
	case "version":
		fmt.Printf("%s (commit %s, built %s)\n", agentVersion, commit, buildDate)
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `axel-cli — Axiōma device agent

  daemon    Hold the connection and execute actions. Headless; no terminal UI.
  status    Show connection and device state.
  enroll    Register this device with the gateway.
  doctor    Check identity, state directory, and local prerequisites.
  version   Print the agent version.

The daemon is installed as a logon Scheduled Task and is not run by hand.
`)
}

// runDaemon is the headless mode. No Bubble Tea here: when this runs there is
// no terminal, and anything written to stdout goes nowhere.
func runDaemon(ctx context.Context) error {
	config, err := gatewayConfig()
	if err != nil {
		return err
	}
	return device.RunDaemon(ctx, config, agentVersion)
}

func gatewayConfig() (device.Config, error) {
	config, err := device.LoadConfig()
	if err != nil {
		return device.Config{}, err
	}
	if host := os.Getenv("AXIOMA_GRPC_HOST"); host != "" {
		config.GRPCHost = host
	}
	if ca := os.Getenv("AXIOMA_GRPC_CA_FILE"); ca != "" {
		config.CAFile = ca
	}
	if name := os.Getenv("AXIOMA_GRPC_SERVER_NAME"); name != "" {
		config.TLSServerName = name
	}
	if config.GRPCHost == "" {
		config.GRPCHost = "localhost:50051"
	}
	return config, nil
}

// The operator-facing commands below are where the terminal UI belongs. They
// are run by a person, on a machine they are looking at, to answer "is this
// thing connected and what did it last do".

func runStatus(ctx context.Context) error {
	id, err := device.Load(agentVersion)
	if err != nil {
		return err
	}
	state, err := device.LoadDaemonState()
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	_, err = tea.NewProgram(tui.NewStatus(id, state), tea.WithContext(ctx)).Run()
	return err
}

func runEnroll(ctx context.Context) error {
	id, err := device.Load(agentVersion)
	if err != nil {
		return err
	}
	config, err := gatewayConfig()
	if err != nil {
		return err
	}
	_, err = tea.NewProgram(tui.NewEnroll(id, config), tea.WithContext(ctx)).Run()
	return err
}

func runDoctor(ctx context.Context) error {
	checks := []tui.Check{
		{
			Name: "device identity",
			Run: func(context.Context) (string, error) {
				id, err := device.Load(agentVersion)
				if err != nil {
					return "", err
				}
				return id.DeviceID, nil
			},
		},
		{
			Name: "state directory",
			Run: func(context.Context) (string, error) {
				return device.StateDir()
			},
		},
		{
			Name: "device credential",
			Run: func(context.Context) (string, error) {
				id, err := device.Load(agentVersion)
				if err != nil {
					return "", err
				}
				if id.Credential != "" {
					return "stored", nil
				}
				if id.EnrolmentToken != "" {
					return "", fmt.Errorf("enrolment pending; restart the daemon")
				}
				return "", fmt.Errorf("missing; run axel-cli enroll")
			},
		},
		{
			Name: "TLS and authentication",
			Run: func(checkCtx context.Context) (string, error) {
				id, err := device.Load(agentVersion)
				if err != nil {
					return "", err
				}
				if id.Credential == "" {
					return "", fmt.Errorf("credential unavailable")
				}
				config, err := gatewayConfig()
				if err != nil {
					return "", err
				}
				return device.CheckAuth(checkCtx, config, id)
			},
		},
	}
	// Every tier-one action depends on a binary. Finding one missing during
	// a real ticket is the worst possible moment. Those binaries are
	// Windows-only, so the checks only run where the actions do; on other
	// platforms the actions themselves report "unsupported platform".
	if runtime.GOOS == "windows" {
		checks = append(checks,
			tui.Check{Name: "ipconfig present", Run: tui.BinaryPresent("ipconfig")},
			tui.Check{Name: "PowerShell present", Run: tui.BinaryPresent("powershell")},
			tui.Check{Name: "klist present", Run: tui.BinaryPresent("klist")},
			tui.Check{Name: "taskkill present", Run: tui.BinaryPresent("taskkill")},
			tui.Check{Name: "certutil present", Run: tui.BinaryPresent("certutil")},
			tui.Check{Name: "cmd present", Run: tui.BinaryPresent("cmd")},
		)
	}
	checks = append(checks, tui.Check{Name: "computer-use available", Run: cua.Check})

	_, err := tea.NewProgram(tui.NewDoctor(ctx, checks), tea.WithContext(ctx)).Run()
	return err
}
