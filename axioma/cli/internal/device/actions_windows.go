//go:build windows

package device

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

func runCommand(ctx context.Context, name string, args ...string) (Result, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var output cappedBuffer
	cmd.Stdout, cmd.Stderr = &output, &output
	err := cmd.Run()
	detail := strings.TrimSpace(output.String())
	if output.overflow {
		return Result{Detail: fmt.Sprintf("output exceeded %d bytes", maxCommandOutput)}, nil
	}
	if ctx.Err() == context.DeadlineExceeded {
		return Result{Detail: "timed out"}, nil
	}
	if err != nil {
		if detail == "" {
			detail = err.Error()
		}
		return Result{Detail: detail}, nil
	}
	return Result{OK: true, Detail: detail}, nil
}

func runAction(ctx context.Context, action string, commands []commandSpec) (Result, error) {
	var details []string
	for i, command := range commands {
		if action == "restart_user_process" && i == len(commands)-1 {
			cmd := exec.CommandContext(ctx, command.name, command.args...)
			if err := cmd.Start(); err != nil {
				return Result{Detail: err.Error()}, nil
			}
			if err := cmd.Process.Release(); err != nil {
				return Result{Detail: err.Error()}, nil
			}
			continue
		}
		result, err := runCommand(ctx, command.name, command.args...)
		if err != nil {
			return result, err
		}
		// A missing process is harmless: restart_user_process still launches the
		// allowlisted executable. Every other command must succeed.
		if !result.OK && !(action == "restart_user_process" && i == 0) {
			return result, nil
		}
		if result.Detail != "" {
			details = append(details, result.Detail)
		}
	}
	return Result{OK: true, Detail: strings.Join(details, "\n")}, nil
}
