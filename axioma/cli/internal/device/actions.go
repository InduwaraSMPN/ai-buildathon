package device

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// Tier one of device remediation: a fixed set of named actions.
//
// The gateway sends an action name and typed parameters. It never sends a
// command string, and nothing here builds one from caller input — the argument
// list for each action is written out below. That is what makes a ticket unable
// to talk the agent into running something arbitrary.

const defaultTimeout = 30 * time.Second

// servicesAllowed bounds restart_service. A service outside this set is refused
// rather than attempted.
var servicesAllowed = map[string]bool{
	"Dnscache": true,
	"Dhcp":     true,
	"WlanSvc":  true,
}

// Result is what the agent reports back for one command.
type Result struct {
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

// RunAction performs a named action. Unknown actions are refused, not guessed.
func RunAction(ctx context.Context, action string, params map[string]string) (Result, error) {
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	switch action {
	case "flush_dns":
		return runCommand(ctx, "ipconfig", "/flushdns")

	case "reset_resolver":
		return runCommand(ctx, "netsh", "winsock", "reset")

	case "restart_service":
		name := params["serviceName"]
		if name == "" {
			return Result{OK: false, Detail: "serviceName is required"}, nil
		}
		if !servicesAllowed[name] {
			return Result{OK: false, Detail: fmt.Sprintf("service not allowlisted: %s", name)}, nil
		}
		// A stop that fails because the service was already stopped is fine; the
		// start is the operation that matters.
		_, _ = runCommand(ctx, "sc", "stop", name)
		return runCommand(ctx, "sc", "start", name)

	default:
		return Result{OK: false, Detail: fmt.Sprintf("unknown action: %s", action)}, nil
	}
}

// Facets are the read side: fixed commands behind fixed names.
var facetCommands = map[string][]string{
	"resolver":     {"ipconfig", "/all"},
	"adapters":     {"netsh", "interface", "show", "interface"},
	"services":     {"sc", "query", "type=", "service", "state=", "all"},
	"reachability": {"ping", "-n", "2", "127.0.0.1"},
}

// ReadState collects the named facets. An unknown facet is reported per-facet
// rather than failing the whole read.
func ReadState(ctx context.Context, facets []string) (map[string]any, error) {
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	out := make(map[string]any, len(facets))
	for _, facet := range facets {
		argv, ok := facetCommands[facet]
		if !ok {
			out[facet] = map[string]string{"error": "unknown facet: " + facet}
			continue
		}
		res, err := runCommand(ctx, argv[0], argv[1:]...)
		if err != nil || !res.OK {
			out[facet] = map[string]string{"error": res.Detail}
			continue
		}
		out[facet] = map[string]string{"raw": res.Detail}
	}
	return out, nil
}

func runCommand(ctx context.Context, name string, args ...string) (Result, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	detail := strings.TrimSpace(string(output))

	if ctx.Err() == context.DeadlineExceeded {
		return Result{OK: false, Detail: "timed out"}, nil
	}
	if err != nil {
		if detail == "" {
			detail = err.Error()
		}
		return Result{OK: false, Detail: detail}, nil
	}
	return Result{OK: true, Detail: detail}, nil
}
