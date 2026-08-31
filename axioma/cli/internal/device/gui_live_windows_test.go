//go:build windows

package device

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// Drives the real dispatch path — RunAction and ReadStateWithParams — against a
// throwaway Notepad, to prove read, act, and verify work through the Go code and
// not merely through the scripts in isolation.
func TestLiveGUIStepAgainstNotepad(t *testing.T) {
	// Opt-in: this launches a real window and drives it. It is the only proof
	// that the GUI tier works end to end, and it has no business firing during
	// an ordinary go test on somebody's desktop.
	if os.Getenv("AXIOMA_LIVE_GUI_TEST") == "" {
		t.Skip("set AXIOMA_LIVE_GUI_TEST=1 to drive a real window")
	}
	launch := exec.Command("notepad.exe")
	if err := launch.Start(); err != nil {
		t.Skipf("notepad unavailable: %v", err)
	}
	pid := launch.Process.Pid
	defer func() {
		_ = exec.Command("taskkill", "/PID", itoa(pid), "/T", "/F").Run()
	}()
	_ = launch.Process.Release()
	time.Sleep(2500 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	params := map[string]string{"window": "Notepad"}

	read := func(stage string) ScreenFacet {
		t.Helper()
		out, err := ReadStateWithParams(ctx, []string{"screen"}, params)
		if err != nil {
			t.Fatalf("%s: %v", stage, err)
		}
		result, ok := out["screen"].(FacetResult)
		if !ok || !result.OK {
			t.Fatalf("%s: facet failed: %#v", stage, out["screen"])
		}
		body, _ := json.Marshal(result.Data)
		var facet ScreenFacet
		if err := json.Unmarshal(body, &facet); err != nil {
			t.Fatalf("%s: %v", stage, err)
		}
		return facet
	}

	before := read("before")
	if before.Window == "" {
		t.Fatalf("screen facet found no window: %#v", before)
	}
	var editor string
	for _, control := range before.Controls {
		for _, action := range control.Actions {
			if action == "ValuePattern" && editor == "" {
				editor = control.Name
			}
		}
	}
	if editor == "" {
		t.Skipf("no settable control in %q: %#v", before.Window, before.Controls)
	}

	const typed = "axioma live gui verification"
	result, err := RunAction(ctx, "gui_set_control_value", map[string]string{
		"window": "Notepad", "control": editor, "value": typed,
	})
	if err != nil || !result.OK {
		t.Fatalf("gui_set_control_value: %+v %v", result, err)
	}

	after := read("after")
	for _, control := range after.Controls {
		if strings.Contains(control.Name, typed) {
			return // the facet observed the write
		}
	}
	t.Fatalf("no control reflected the write: %#v", after.Controls)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
