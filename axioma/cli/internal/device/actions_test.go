package device

import (
	"context"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"
)

func TestActionCommands(t *testing.T) {
	tests := []struct {
		name   string
		params map[string]string
		want   []commandSpec
	}{
		{"flush_dns", nil, []commandSpec{{name: "ipconfig", args: []string{"/flushdns"}}}},
		{"renew_dhcp_lease", nil, []commandSpec{{name: "ipconfig", args: []string{"/renew"}}}},
		{"clear_proxy_override", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", `Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyOverride -ErrorAction SilentlyContinue`}}}},
		{"reset_credential_cache", nil, []commandSpec{{name: "klist", args: []string{"purge"}}}},
		{"restart_user_process", map[string]string{"process_name": "Notepad"}, []commandSpec{{name: "taskkill", args: []string{"/IM", "notepad.exe", "/F"}}, {name: "notepad.exe"}}},
		{"restart_user_process", map[string]string{"process_name": "Teams"}, []commandSpec{{name: "taskkill", args: []string{"/IM", "ms-teams.exe", "/F"}}, {name: "cmd.exe", args: []string{"/c", "start", "", "ms-teams:"}}}},
		{"disable_proxy", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", disableProxyScript}}}},
		{"refresh_certificate_store", nil, []commandSpec{{name: "certutil", args: []string{"-user", "-pulse"}}}},
		{"clear_temp_files", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", clearTempFilesScript}}}},
		{"clear_outlook_cache", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", clearOutlookCacheScript}}}},
		{"clear_teams_cache", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", clearTeamsCacheScript}}}},
		{"clear_icon_cache", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", clearIconCacheScript}}}},
		{"clear_print_queue", nil, []commandSpec{{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", clearPrintQueueScript}}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := actionCommands(test.name, test.params)
			if err != nil || !reflect.DeepEqual(got, test.want) {
				t.Fatalf("got %#v, %v; want %#v", got, err, test.want)
			}
		})
	}
}

func TestActionCommandsRejectsRetiredAndArbitraryInput(t *testing.T) {
	for _, action := range []string{"reset_resolver", "restart_service", "cmd.exe /c whoami"} {
		if _, err := actionCommands(action, nil); err == nil {
			t.Fatalf("accepted action %q", action)
		}
	}
	if _, err := actionCommands("restart_user_process", map[string]string{"processName": `cmd.exe /c whoami`}); err == nil {
		t.Fatal("accepted arbitrary process")
	}
	for _, process := range []string{"", "powershell", "winword", "notepad.exe", "notepad; whoami"} {
		if _, err := actionCommands("restart_user_process", map[string]string{"process_name": process}); err == nil {
			t.Fatalf("accepted unlisted process %q", process)
		}
	}
}

// Every action but restart_user_process must be a pure constant: hostile
// parameters cannot change a single argv element. restart_user_process is the
// one exception, and it selects a key rather than supplying a string.
func TestActionParametersCannotReachACommand(t *testing.T) {
	hostile := map[string]string{
		"process_name": "cmd.exe /c whoami",
		"processName":  "& calc.exe",
		"target":       "; whoami",
		"path":         `C:\Windows\System32`,
		"command":      "whoami",
		"facets":       `["resolver"]`,
	}
	for action := range actionFacets {
		if action == "restart_user_process" || action == "run_command" || guiSteps[action] {
			continue
		}
		clean, err := actionCommands(action, nil)
		if err != nil {
			t.Fatalf("%s: %v", action, err)
		}
		dirty, err := actionCommands(action, hostile)
		if err != nil || !reflect.DeepEqual(clean, dirty) {
			t.Fatalf("%s: parameters changed the argv: %#v vs %#v (%v)", action, clean, dirty, err)
		}
		for _, command := range clean {
			for _, arg := range command.args {
				for key, value := range hostile {
					if strings.Contains(arg, value) {
						t.Fatalf("%s: parameter %q reached argv %q", action, key, arg)
					}
				}
			}
		}
	}
}

// device_run_action names device_read_state as its verifier, so an action whose
// effect no facet observes cannot discharge that obligation and must not exist.
func TestEveryActionHasAVerifyingFacet(t *testing.T) {
	withExecutionEnabled(t, true)
	for action, facets := range actionFacets {
		if _, err := actionCommands(action, map[string]string{"process_name": "notepad", "control": "OK", "proposal_id": "p1", "command": `["ipconfig"]`}); err != nil {
			t.Errorf("%s is listed in actionFacets but is not dispatchable: %v", action, err)
		}
		if len(facets) == 0 {
			t.Errorf("%s has no verifying facet", action)
		}
		for _, facet := range facets {
			if !knownFacets[facet] {
				t.Errorf("%s names unknown facet %q", action, facet)
			}
		}
	}
	if len(actionFacets) != 18 {
		t.Fatalf("expected the widened action set, got %d actions", len(actionFacets))
	}
}

func TestEveryKnownFacetIsCollectable(t *testing.T) {
	for _, facet := range facetNames() {
		if facetScript(facet) == "" {
			t.Errorf("facet %q has no collection script", facet)
		}
	}
	if facetScript("software") != "" {
		t.Error("inventory kind exposed as a diagnostic facet")
	}
}

// The processes facet is the only thing that can verify restart_user_process, so
// it has to observe every process the allowlist can restart.
func TestProcessesFacetCoversTheAllowlist(t *testing.T) {
	script := processesScript()
	for _, key := range userProcessNames() {
		if !strings.Contains(script, "key='"+key+"'") {
			t.Errorf("processes facet does not observe %q", key)
		}
		process := strings.TrimSuffix(userProcesses[key].image, ".exe")
		if !strings.Contains(script, "process='"+process+"'") {
			t.Errorf("processes facet does not query %q", process)
		}
	}
	if len(userProcesses) != 8 {
		t.Fatalf("expected the widened process allowlist, got %d entries", len(userProcesses))
	}
}

func TestParseAllFacetFixtures(t *testing.T) {
	body, err := os.ReadFile("testdata/facets.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures map[string]json.RawMessage
	if err := json.Unmarshal(body, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, name := range facetNames() {
		t.Run(name, func(t *testing.T) {
			if len(fixtures[name]) == 0 {
				t.Fatalf("no fixture for facet %q", name)
			}
			if _, err := parseFacet(name, string(fixtures[name])); err != nil {
				t.Fatal(err)
			}
		})
	}
	resolver, err := parseFacet("resolver", string(fixtures["resolver"]))
	if err != nil || resolver.(*ResolverFacet).Servers["Conexión de área local"][0] != "2001:db8::53" {
		t.Fatalf("non-English fixture was not preserved: %#v, %v", resolver, err)
	}
}

func TestParseFacetRejectsConsoleProseAndUnknownFields(t *testing.T) {
	for _, raw := range []string{"Configuración IP de Windows", `{"enabled":false,"command":"whoami"}`} {
		if _, err := parseFacet("proxy", raw); err == nil {
			t.Fatalf("accepted %q", raw)
		}
	}
}

func TestBoundedRaw(t *testing.T) {
	raw := strings.Repeat("x", maxFacetRaw-1) + "é" + strings.Repeat("y", 20)
	got := boundedRaw(raw)
	if len(got) > maxFacetRaw || !utf8.ValidString(got) {
		t.Fatalf("invalid bounded raw: bytes=%d utf8=%v", len(got), utf8.ValidString(got))
	}
}

func TestCappedBuffer(t *testing.T) {
	var buffer cappedBuffer
	input := strings.Repeat("x", maxCommandOutput+17)
	n, err := buffer.Write([]byte(input))
	if err != nil || n != len(input) || buffer.Len() != maxCommandOutput || !buffer.overflow {
		t.Fatalf("n=%d err=%v len=%d overflow=%v", n, err, buffer.Len(), buffer.overflow)
	}
}

func TestReadStateCollectsFacetsConcurrently(t *testing.T) {
	original := facetReader
	defer func() { facetReader = original }()
	var active atomic.Int32
	var concurrent atomic.Bool
	facetReader = func(_ context.Context, name, _ string) FacetResult {
		if active.Add(1) > 1 {
			concurrent.Store(true)
		}
		time.Sleep(20 * time.Millisecond)
		active.Add(-1)
		return FacetResult{OK: true, Raw: name}
	}
	result, err := ReadState(context.Background(), []string{"resolver", "proxy"})
	if err != nil || !concurrent.Load() || len(result) != 2 {
		t.Fatalf("result=%#v err=%v concurrent=%v", result, err, concurrent.Load())
	}
}

func TestValidateTarget(t *testing.T) {
	for _, target := range []string{"intranet.example", "10.0.0.1", "2001:db8::1"} {
		if err := validateTarget(target); err != nil {
			t.Errorf("rejected %q: %v", target, err)
		}
	}
	for _, target := range []string{"", `localhost; whoami`, "-bad.example"} {
		if err := validateTarget(target); err == nil {
			t.Errorf("accepted %q", target)
		}
	}
}

// A GUI step is the one action family that carries caller text. It must reach
// PowerShell as an environment value and never as part of the command line,
// because an environment value cannot be parsed as code, and argv binding
// through -Command re-splits anything containing a space.
func TestGUIStepParametersTravelInTheEnvironment(t *testing.T) {
	hostile := map[string]string{
		"window":  `Notepad" ; Start-Process calc.exe #`,
		"control": `Text editor" ; whoami #`,
		"value":   `$(Get-Content secrets.txt)`,
	}
	for step := range guiSteps {
		commands, err := actionCommands(step, hostile)
		if err != nil || len(commands) != 1 {
			t.Fatalf("%s: %#v %v", step, commands, err)
		}
		command := commands[0]
		for _, arg := range command.args {
			for key, value := range hostile {
				if strings.Contains(arg, value) {
					t.Fatalf("%s: parameter %q reached argv", step, key)
				}
			}
		}
		joined := strings.Join(command.env, "\n")
		if !strings.Contains(joined, "AXIOMA_GUI_CONTROL="+hostile["control"]) {
			t.Fatalf("%s: control did not reach the environment: %v", step, command.env)
		}
		if !strings.Contains(joined, "AXIOMA_GUI_STEP="+strings.TrimPrefix(step, "gui_")) {
			t.Fatalf("%s: step name is not a binary constant: %v", step, command.env)
		}
		// The value only travels for the one step that has one.
		want := ""
		if step == "gui_set_control_value" {
			want = hostile["value"]
		}
		if !strings.Contains(joined, "AXIOMA_GUI_VALUE="+want+"\n") && !strings.HasSuffix(joined, "AXIOMA_GUI_VALUE="+want) {
			t.Fatalf("%s: unexpected value binding: %v", step, command.env)
		}
	}
}

func TestGUIStepRejectsUnusableParameters(t *testing.T) {
	if _, err := actionCommands("gui_invoke_control", nil); err == nil {
		t.Fatal("accepted a step with no control")
	}
	if _, err := actionCommands("gui_invoke_control", map[string]string{"control": "OK\r\nInjected"}); err == nil {
		t.Fatal("accepted a control name containing a control character")
	}
	if _, err := actionCommands("gui_invoke_control", map[string]string{"control": strings.Repeat("x", 257)}); err == nil {
		t.Fatal("accepted an unbounded control name")
	}
	if _, err := actionCommands("gui_set_control_value", map[string]string{"control": "Field", "value": strings.Repeat("x", 4097)}); err == nil {
		t.Fatal("accepted an unbounded value")
	}
}

// Every GUI step is verified by the screen facet, which is also the only thing
// that tells the model which control names exist to be named.
func TestGUIStepsAreVerifiedByTheScreenFacet(t *testing.T) {
	for step := range guiSteps {
		if got := actionFacets[step]; len(got) != 1 || got[0] != "screen" {
			t.Fatalf("%s is verified by %v", step, got)
		}
	}
	if facetScript("screen") == "" {
		t.Fatal("screen facet has no collection script")
	}
}
