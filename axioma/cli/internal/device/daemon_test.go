package device

import (
	"context"
	"strings"
	"testing"

	"github.com/axioma/cli/internal/pb"
)

func TestExecuteRejectsComputerUse(t *testing.T) {
	result := execute(context.Background(), &pb.DeviceCommand{CommandId: "c1", Sequence: 7, ComputerUse: true})
	if result.Ok || result.Sequence != 7 || !strings.Contains(result.Error, "computer-use") {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestSplitFacets(t *testing.T) {
	facets := splitFacets(`["resolver","services"]`)
	if len(facets) != 2 || facets[0] != "resolver" || facets[1] != "services" {
		t.Fatalf("unexpected facets: %#v", facets)
	}
}
