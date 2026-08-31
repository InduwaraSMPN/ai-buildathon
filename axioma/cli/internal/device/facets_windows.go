//go:build windows

package device

import (
	"context"
	"fmt"
)

func facetCommand(name, target string) (commandSpec, error) {
	script := facetScript(name)
	if script == "" {
		return commandSpec{}, fmt.Errorf("unknown facet: %s", name)
	}
	args := []string{"-NoProfile", "-NonInteractive", "-Command"}
	var env []string
	switch name {
	case "reachability":
		// A validated hostname or address: no spaces reach this binding.
		args = append(args, "& { param($target) "+script+" }", target)
	case "screen":
		// A window title, which is full of spaces, so it travels in the
		// environment where nothing re-splits or reparses it.
		args = append(args, script)
		env = []string{"AXIOMA_GUI_TARGET=" + target}
	default:
		args = append(args, script)
	}
	return commandSpec{name: "powershell.exe", args: args, env: env}, nil
}

func readFacet(ctx context.Context, name, target string) FacetResult {
	command, err := facetCommand(name, target)
	if err != nil {
		return FacetResult{Error: err.Error()}
	}
	result, err := runSpec(ctx, command)
	if err != nil || !result.OK {
		return FacetResult{Raw: boundedRaw(result.Detail), Error: result.Detail}
	}
	data, err := parseFacet(name, result.Detail)
	if err != nil {
		return FacetResult{Raw: boundedRaw(result.Detail), Error: err.Error()}
	}
	return FacetResult{OK: true, Data: data, Raw: boundedRaw(result.Detail)}
}
