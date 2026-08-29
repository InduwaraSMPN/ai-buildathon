//go:build !windows

package device

import (
	"os/exec"
	"runtime"
	"strings"
)

func osRelease() string {
	output, err := exec.Command("uname", "-sr").Output()
	if err == nil && strings.TrimSpace(string(output)) != "" {
		return strings.TrimSpace(string(output))
	}
	return runtime.GOOS
}
