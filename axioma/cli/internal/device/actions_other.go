//go:build !windows

package device

import (
	"context"
	"fmt"
)

func runCommand(_ context.Context, _ string, _ ...string) (Result, error) {
	return Result{Detail: "unsupported platform"}, nil
}

func runSpec(_ context.Context, _ commandSpec) (Result, error) {
	return Result{Detail: "unsupported platform"}, nil
}

func runAction(_ context.Context, action string, _ []commandSpec) (Result, error) {
	return Result{Detail: fmt.Sprintf("action %s: unsupported platform", action)}, nil
}
