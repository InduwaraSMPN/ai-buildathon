package device

import (
	"strings"
	"testing"
)

func withExecutionEnabled(t *testing.T, enabled bool) {
	t.Helper()
	original := executionEnabled
	executionEnabled = func() bool { return enabled }
	t.Cleanup(func() { executionEnabled = original })
}

// The device refuses on its own. A command arriving without the proposal that
// authorised it does not run here, whatever the gateway believed when it sent
// it — one compromised gateway should not be enough.
func TestRunCommandRefusesWithoutAnApproval(t *testing.T) {
	withExecutionEnabled(t, true)
	for name, params := range map[string]map[string]string{
		"no proposal":    {"command": `["ipconfig","/all"]`},
		"blank proposal": {"proposal_id": "  ", "command": `["ipconfig","/all"]`},
	} {
		if _, err := actionCommands("run_command", params); err == nil {
			t.Fatalf("%s: accepted an unauthorised command", name)
		}
	}
}

func TestRunCommandRefusesWhenTheDeviceHasNotOptedIn(t *testing.T) {
	withExecutionEnabled(t, false)
	_, err := actionCommands("run_command", map[string]string{
		"proposal_id": "p1", "command": `["ipconfig","/all"]`,
	})
	if err == nil || !strings.Contains(err.Error(), "not enabled") {
		t.Fatalf("opted-out device accepted a command: %v", err)
	}
}

func TestRunCommandRejectsAnythingThatIsNotAnArgumentVector(t *testing.T) {
	withExecutionEnabled(t, true)
	for name, command := range map[string]string{
		"a command line":     `"ipconfig /all && whoami"`,
		"not json":           `ipconfig /all`,
		"empty vector":       `[]`,
		"an empty argument":  `["ipconfig",""]`,
		"a newline argument": "[\"ipconfig\",\"/all\\nwhoami\"]",
		"an object":          `{"program":"ipconfig"}`,
	} {
		if _, err := actionCommands("run_command", map[string]string{
			"proposal_id": "p1", "command": command,
		}); err == nil {
			t.Fatalf("%s: accepted %s", name, command)
		}
	}
}

// The approved vector is executed directly. No shell is started, so a shell
// metacharacter is an ordinary argument rather than syntax.
func TestRunCommandExecutesTheVectorWithoutAShell(t *testing.T) {
	withExecutionEnabled(t, true)
	got, err := actionCommands("run_command", map[string]string{
		"proposal_id": "p1",
		"command":     `["ipconfig","/all & whoami"]`,
	})
	if err != nil || len(got) != 1 {
		t.Fatalf("got %#v, %v", got, err)
	}
	if got[0].name != "ipconfig" || len(got[0].args) != 1 || got[0].args[0] != "/all & whoami" {
		t.Fatalf("argv was reinterpreted: %#v", got[0])
	}
	if len(got[0].env) != 0 {
		t.Fatalf("run_command should carry no environment: %#v", got[0].env)
	}
}

// run_command is verified like every other action, so a run cannot resolve on it
// without a device_read_state that observes the device afterwards.
func TestRunCommandHasAVerifyingFacet(t *testing.T) {
	facets := actionFacets["run_command"]
	if len(facets) == 0 {
		t.Fatal("run_command has no verifying facet")
	}
	for _, facet := range facets {
		if !knownFacets[facet] {
			t.Fatalf("run_command names unknown facet %q", facet)
		}
	}
}
