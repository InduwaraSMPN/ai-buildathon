//go:build !windows

package device

import (
	"context"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

func osRelease() string {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, "uname", "-sr").Output()
	if err == nil && strings.TrimSpace(string(output)) != "" {
		return strings.TrimSpace(string(output))
	}
	return runtime.GOOS
}
