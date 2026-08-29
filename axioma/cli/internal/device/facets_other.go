//go:build !windows

package device

import (
	"context"
	"fmt"
)

func readFacet(_ context.Context, name, _ string) FacetResult {
	return FacetResult{Error: fmt.Sprintf("facet %s: unsupported platform", name)}
}
