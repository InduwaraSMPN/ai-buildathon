package tui

import (
	"errors"
	"testing"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/device"
)

func newTestDisconnect(t *testing.T, forget func(device.Identity) error) disconnectModel {
	t.Helper()
	model := NewDisconnect(device.Identity{DeviceID: "device-1", Hostname: "laptop"}, "localhost:50051").(disconnectModel)
	model.forget = forget
	return model
}

func press(model disconnectModel, key string) (disconnectModel, tea.Cmd) {
	updated, cmd := model.Update(tea.KeyPressMsg{Code: rune(key[0]), Text: key})
	return updated.(disconnectModel), cmd
}

func TestDisconnectClearsOnlyOnY(t *testing.T) {
	for _, key := range []string{"n", "N", "q", "x"} {
		called := false
		model, _ := press(newTestDisconnect(t, func(device.Identity) error {
			called = true
			return nil
		}), key)
		if called {
			t.Fatalf("%q cleared the credential", key)
		}
		if model.done {
			t.Fatalf("%q completed the flow", key)
		}
	}

	called := false
	model, _ := press(newTestDisconnect(t, func(device.Identity) error {
		called = true
		return nil
	}), "y")
	if !called || !model.done {
		t.Fatalf("y did not disconnect: called=%v done=%v", called, model.done)
	}
}

// Enter is the key someone presses to get past a screen they have not read, and
// this screen clears a credential that took an enrolment token to obtain.
func TestDisconnectIgnoresEnter(t *testing.T) {
	called := false
	model := newTestDisconnect(t, func(device.Identity) error {
		called = true
		return nil
	})
	updated, _ := model.Update(tea.KeyPressMsg{Code: tea.KeyEnter})
	if called || updated.(disconnectModel).done {
		t.Fatal("Enter disconnected the device")
	}
}

func TestDisconnectReportsFailureAndStaysOpen(t *testing.T) {
	model, _ := press(newTestDisconnect(t, func(device.Identity) error {
		return errors.New("state directory is read-only")
	}), "y")
	if model.done {
		t.Fatal("a failed disconnect reported success")
	}
	if model.err != "state directory is read-only" {
		t.Fatalf("err = %q", model.err)
	}
}
