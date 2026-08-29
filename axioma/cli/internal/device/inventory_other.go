//go:build !windows

package device

import (
	"context"
	"fmt"
)

func readInventory(_ context.Context, name string) InventoryResult {
	return InventoryResult{Error: fmt.Sprintf("inventory %s: unsupported platform", name)}
}
