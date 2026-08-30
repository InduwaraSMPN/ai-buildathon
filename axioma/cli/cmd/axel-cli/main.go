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
	fmt.Fprint(os.Stderr, `axel-cli — Axioma device agent

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
	host, err := gatewayHost()
	if err != nil {
		return err
	}
	return device.RunDaemon(ctx, host, agentVersion)
}

func gatewayHost() (string, error) {
	if host := os.Getenv("AXIOMA_GRPC_HOST"); host != "" {
		return host, nil
	}
	config, err := device.LoadConfig()
	if err != nil {
		return "", err
	}
	if config.GRPCHost != "" {
		return config.GRPCHost, nil
	}
	return "localhost:50051", nil
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
	host, err := gatewayHost()
	if err != nil {
		return err
	}
	_, err = tea.NewProgram(tui.NewEnroll(id, host), tea.WithContext(ctx)).Run()
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
		// Every tier-one action depends on a binary. Finding one missing during
		// a real ticket is the worst possible moment.
		{Name: "ipconfig present", Run: tui.BinaryPresent("ipconfig")},
		{Name: "PowerShell present", Run: tui.BinaryPresent("powershell")},
		{Name: "klist present", Run: tui.BinaryPresent("klist")},
		{Name: "taskkill present", Run: tui.BinaryPresent("taskkill")},
		{Name: "computer-use available", Run: cua.Check},
	}

	_, err := tea.NewProgram(tui.NewDoctor(checks), tea.WithContext(ctx)).Run()
	return err
}
