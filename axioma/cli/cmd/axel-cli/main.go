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

	"github.com/axioma/cli/internal/device"
	"github.com/axioma/cli/internal/tui"
)

const agentVersion = "0.1.0"

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
		fmt.Println(agentVersion)
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
  status    Show connection state and recent commands.
  enroll    Register this device with the gateway.
  doctor    Check connectivity, identity, and action prerequisites.
  version   Print the agent version.

The daemon is installed as a logon Scheduled Task and is not run by hand.
`)
}

// runDaemon is the headless mode. No Bubble Tea here: when this runs there is
// no terminal, and anything written to stdout goes nowhere.
func runDaemon(ctx context.Context) error {
	host := os.Getenv("AXIOMA_GRPC_HOST")
	if host == "" {
		host = "localhost:50051"
	}
	return device.RunDaemon(ctx, host, agentVersion)
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

func runEnroll(_ context.Context) error {
	// TODO(M8): Bubble Tea form for gateway URL, then a connectivity check.
	return fmt.Errorf("not implemented")
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
			Name: "state directory writable",
			Run: func(context.Context) (string, error) {
				return device.StateDir()
			},
		},
		// Every tier-one action depends on a binary. Finding one missing during
		// a real ticket is the worst possible moment.
		{Name: "ipconfig present", Run: tui.BinaryPresent("ipconfig")},
		{Name: "netsh present", Run: tui.BinaryPresent("netsh")},
		{Name: "sc present", Run: tui.BinaryPresent("sc")},
	}

	_, err := tea.NewProgram(tui.NewDoctor(checks), tea.WithContext(ctx)).Run()
	return err
}
