package device

import (
	"context"
	"fmt"
	"net"
	"strings"
)

const (
	maxFacetRaw      = 4096
	maxCommandOutput = 64 * 1024
)

// Result is what the agent reports back for one command.
type Result struct {
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

type commandSpec struct {
	name string
	args []string
}

var userProcesses = map[string]commandSpec{
	"notepad": {name: "notepad.exe"},
}

// actionCommands returns only argument vectors written into this binary. Caller
// input can select an allowlisted process, but can never become a command.
func actionCommands(action string, params map[string]string) ([]commandSpec, error) {
	switch action {
	case "flush_dns":
		return []commandSpec{{name: "ipconfig", args: []string{"/flushdns"}}}, nil
	case "renew_dhcp_lease":
		return []commandSpec{{name: "ipconfig", args: []string{"/renew"}}}, nil
	case "clear_proxy_override":
		return []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", `Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyOverride -ErrorAction SilentlyContinue`}}}, nil
	case "reset_credential_cache":
		return []commandSpec{{name: "klist", args: []string{"purge"}}}, nil
	case "restart_user_process":
		process := params["process_name"]
		if process == "" { // compatibility with the existing flattened parameter convention
			process = params["processName"]
		}
		process = strings.ToLower(process)
		start, ok := userProcesses[process]
		if !ok {
			if process == "" {
				return nil, fmt.Errorf("processName is required")
			}
			return nil, fmt.Errorf("process not allowlisted: %s", process)
		}
		return []commandSpec{
			{name: "taskkill", args: []string{"/IM", start.name, "/F"}},
			start,
		}, nil
	default:
		return nil, fmt.Errorf("unknown action: %s", action)
	}
}

// RunAction performs a shipped, non-admin typed action.
func RunAction(ctx context.Context, action string, params map[string]string) (Result, error) {
	commands, err := actionCommands(action, params)
	if err != nil {
		return Result{Detail: err.Error()}, nil
	}
	return runAction(ctx, action, commands)
}

type FacetResult struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Raw   string `json:"raw,omitempty"`
	Error string `json:"error,omitempty"`
}

var knownFacets = map[string]bool{
	"resolver": true, "adapters": true, "reachability": true,
	"proxy": true, "identity": true, "processes": true,
}

var facetReader = readFacet

// ReadState preserves the daemon-facing API. Parameterized callers should use
// ReadStateWithParams so reachability can receive its required target.
func ReadState(ctx context.Context, facets []string) (map[string]any, error) {
	return ReadStateWithParams(ctx, facets, nil)
}

func ReadStateWithParams(ctx context.Context, facets []string, params map[string]string) (map[string]any, error) {
	type facetResult struct {
		name   string
		result FacetResult
	}
	out := make(map[string]any, len(facets))
	results := make(chan facetResult, len(facets))
	pending := 0
	for _, facet := range facets {
		if !knownFacets[facet] {
			out[facet] = FacetResult{Error: "unknown facet: " + facet}
			continue
		}
		target := ""
		if facet == "reachability" {
			target = params["target"]
			if err := validateTarget(target); err != nil {
				out[facet] = FacetResult{Error: err.Error()}
				continue
			}
		}
		pending++
		go func() { results <- facetResult{facet, facetReader(ctx, facet, target)} }()
	}
	for range pending {
		result := <-results
		out[result.name] = result.result
	}
	return out, nil
}

func validateTarget(target string) error {
	if target == "" {
		return fmt.Errorf("target is required")
	}
	if len(target) > 253 {
		return fmt.Errorf("target is too long")
	}
	if net.ParseIP(target) != nil {
		return nil
	}
	for _, label := range strings.Split(target, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return fmt.Errorf("invalid target")
		}
		for _, r := range label {
			if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-') {
				return fmt.Errorf("invalid target")
			}
		}
	}
	return nil
}
