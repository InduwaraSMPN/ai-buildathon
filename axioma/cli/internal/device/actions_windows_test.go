//go:build windows

package device

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestRunCommandKillsDescendantHoldingOutputPipe(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	started := time.Now()
	result, err := runCommand(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `Start-Process powershell.exe -ArgumentList '-NoProfile','-NonInteractive','-Command','Start-Sleep 30' -NoNewWindow; Start-Sleep 30`)
	if err != nil || result.Detail != "timed out" {
		t.Fatalf("result=%+v err=%v", result, err)
	}
	if elapsed := time.Since(started); elapsed >= commandWaitDelay+2*time.Second {
		t.Fatalf("runCommand waited %s for descendant pipe", elapsed)
	}
}

func TestRunCommandReturnsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := runCommand(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Start-Sleep 30")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("runCommand error = %v", err)
	}
}
