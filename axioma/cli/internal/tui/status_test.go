package tui

import (
	"strings"
	"testing"

	"github.com/axioma/cli/internal/device"
)

func render(t *testing.T, state device.DaemonState) string {
	t.Helper()
	model := NewStatus(device.Identity{DeviceID: "device-1", Hostname: "laptop"}, state).(statusModel)
	return model.View().Content
}

// Enrolment binds the machine to the gateway; a claim binds it to a person, and
// releasing it in the portal ends the second while the daemon stays connected.
// A status that reported only the connection read as healthy on a device the
// portal could no longer see.
func TestStatusSeparatesConnectionFromOwnership(t *testing.T) {
	out := render(t, device.DaemonState{Connected: true, GRPCHost: "localhost:50051"})
	if !strings.Contains(out, "connected") || !strings.Contains(out, "not linked") {
		t.Fatalf("connected but unowned device did not report both bindings:\n%s", out)
	}
	if !strings.Contains(out, "Restart the axel-cli daemon") {
		t.Fatalf("no route back to a claim code:\n%s", out)
	}

	out = render(t, device.DaemonState{Connected: true, GRPCHost: "localhost:50051", Claimed: true})
	if strings.Contains(out, "not linked") || !strings.Contains(out, "linked") {
		t.Fatalf("claimed device reported as unlinked:\n%s", out)
	}
	if strings.Contains(out, "Restart the axel-cli daemon") {
		t.Fatalf("claimed device was told to reconnect for a code:\n%s", out)
	}
}

// A code on screen is the instruction; telling the employee to restart the
// daemon for one they can already read would throw it away.
func TestStatusPrefersAClaimCodeOverReconnecting(t *testing.T) {
	out := render(t, device.DaemonState{Connected: true, ClaimCode: "ABCDEF-1234"})
	if !strings.Contains(out, "ABCDEF-1234") || strings.Contains(out, "Restart the axel-cli daemon") {
		t.Fatalf("unexpected guidance while a code is showing:\n%s", out)
	}
}
