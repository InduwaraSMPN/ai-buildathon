package device

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	maxFacetRaw      = 4096
	maxCommandOutput = 64 * 1024
)

// Result is what the agent reports back for one command.
type Result struct {
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

type commandSpec struct {
	name string
	args []string
	// env carries caller-supplied values into a script as data. Nothing the
	// caller supplies is ever concatenated into args: an environment value
	// cannot be parsed as code, and argv binding through
	// powershell.exe -Command re-splits anything containing a space.
	env []string
}

// userProcess is one allowlisted application. Both fields are written into this
// binary: image is the taskkill target, launch is the argv that starts it again.
// Caller input only ever selects a key in userProcesses.
type userProcess struct {
	image  string
	launch commandSpec
}

// shellStart launches through cmd's start verb, which resolves App Paths
// registrations and protocol handlers that are not on PATH. The target is a
// constant from this file, never caller input.
func shellStart(target string) commandSpec {
	return commandSpec{name: "cmd.exe", args: []string{"/c", "start", "", target}}
}

// The applications employees actually report as hung or stuck. Restarting one is
// non-admin and its effect is observable through the processes facet.
var userProcesses = map[string]userProcess{
	"notepad":  {image: "notepad.exe", launch: commandSpec{name: "notepad.exe"}},
	"explorer": {image: "explorer.exe", launch: commandSpec{name: "explorer.exe"}},
	"outlook":  {image: "outlook.exe", launch: shellStart("outlook.exe")},
	"teams":    {image: "ms-teams.exe", launch: shellStart("ms-teams:")},
	"onedrive": {image: "onedrive.exe", launch: shellStart(`%LOCALAPPDATA%\Microsoft\OneDrive\OneDrive.exe`)},
	"msedge":   {image: "msedge.exe", launch: shellStart("msedge.exe")},
	"chrome":   {image: "chrome.exe", launch: shellStart("chrome.exe")},
	"slack":    {image: "slack.exe", launch: shellStart(`%LOCALAPPDATA%\slack\slack.exe`)},
}

// userProcessNames returns the allowlist keys in a stable order. The processes
// facet reads this so the facet always observes exactly what the action can
// restart — an action whose effect no facet can see must not exist.
func userProcessNames() []string {
	names := make([]string, 0, len(userProcesses))
	for name := range userProcesses {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

const powershellPrefix = "powershell.exe"

func powershellAction(script string) commandSpec {
	return commandSpec{name: powershellPrefix, args: []string{"-NoProfile", "-NonInteractive", "-Command", script}}
}

// Every script below is a constant. None of them interpolates caller input.
const (
	clearProxyOverrideScript = `Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyOverride -ErrorAction SilentlyContinue`
	disableProxyScript       = `Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyEnable -Value 0 -Type DWord`
	clearTempFilesScript     = `Get-ChildItem -LiteralPath $env:TEMP -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue`
	clearOutlookCacheScript  = `$path = Join-Path $env:LOCALAPPDATA 'Microsoft\Outlook\RoamCache'; if (Test-Path -LiteralPath $path) { Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }`
	clearTeamsCacheScript    = `$path = Join-Path $env:LOCALAPPDATA 'Packages\MSTeams_8wekyb3d8bbwe\LocalCache'; if (Test-Path -LiteralPath $path) { Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }`
	clearIconCacheScript     = `$path = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer'; if (Test-Path -LiteralPath $path) { Get-ChildItem -LiteralPath $path -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'iconcache*' -or $_.Name -like 'thumbcache*' } | Remove-Item -Force -ErrorAction SilentlyContinue }`
	clearPrintQueueScript    = `Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Remove-CimInstance -ErrorAction SilentlyContinue`
)

// guiSteps are the tier-two actions. Each drives one UI Automation pattern on a
// control the screen facet has already reported, so the caller selects a name
// out of a set the device produced rather than supplying anything executable.
// The step name itself is a constant from this map, never caller input.
var guiSteps = map[string]bool{
	"gui_invoke_control":    true,
	"gui_set_control_value": true,
	"gui_toggle_control":    true,
	"gui_select_item":       true,
	"gui_expand_control":    true,
}

// guiStepCommand binds the window, control, and value as environment values.
func guiStepCommand(action string, params map[string]string) ([]commandSpec, error) {
	window, err := validateUIText("window", params["window"], false)
	if err != nil {
		return nil, err
	}
	control, err := validateUIText("control", params["control"], true)
	if err != nil {
		return nil, err
	}
	value := params["value"]
	if action == "gui_set_control_value" {
		if value, err = validateUIValue(value); err != nil {
			return nil, err
		}
	} else {
		value = ""
	}
	return []commandSpec{{
		name: powershellPrefix,
		args: []string{"-NoProfile", "-NonInteractive", "-Command", guiStepScript},
		env: []string{
			"AXIOMA_GUI_STEP=" + strings.TrimPrefix(action, "gui_"),
			"AXIOMA_GUI_WINDOW=" + window,
			"AXIOMA_GUI_CONTROL=" + control,
			"AXIOMA_GUI_VALUE=" + value,
		},
	}}, nil
}

// validateUIText bounds a window or control name. It never has to defend against
// shell metacharacters, because the value travels in the environment and is only
// ever compared against names the accessibility tree reported — but a control
// character in an environment value is still worth refusing.
func validateUIText(field, value string, required bool) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		if required {
			return "", fmt.Errorf("%s is required", field)
		}
		return "", nil
	}
	if len(value) > 256 {
		return "", fmt.Errorf("%s is too long", field)
	}
	for _, r := range value {
		if r < 0x20 || r == 0x7f {
			return "", fmt.Errorf("%s contains a control character", field)
		}
	}
	return value, nil
}

func validateUIValue(value string) (string, error) {
	if len(value) > 4096 {
		return "", fmt.Errorf("value is too long")
	}
	for _, r := range value {
		if (r < 0x20 && r != '\t') || r == 0x7f {
			return "", fmt.Errorf("value contains a control character")
		}
	}
	return value, nil
}

// executionMarker is the device's own opt-in. General execution is off unless an
// operator placed this file on this machine, and the check is here as well as in
// the API deliberately: the API deciding alone would make one compromised
// gateway enough. Its contents are irrelevant; its existence is the consent.
const executionMarker = "execution-enabled"

var executionEnabled = func() bool {
	dir, err := StateDir()
	if err != nil {
		return false
	}
	_, err = os.Stat(filepath.Join(dir, executionMarker))
	return err == nil
}

// runCommandSpec builds the one action that carries a real argument vector. It
// runs only what a human approved: the API sends the argv together with the
// proposal that authorised it, and a command arriving without that reference is
// refused here regardless of what the gateway believes.
func runCommandSpec(params map[string]string) ([]commandSpec, error) {
	if strings.TrimSpace(params["proposal_id"]) == "" {
		return nil, fmt.Errorf("run_command requires an approved proposal; refusing")
	}
	if !executionEnabled() {
		return nil, fmt.Errorf("general execution is not enabled on this device")
	}
	var argv []string
	if err := json.Unmarshal([]byte(params["command"]), &argv); err != nil {
		return nil, fmt.Errorf("command must be an argument vector")
	}
	if len(argv) == 0 || len(argv) > 32 {
		return nil, fmt.Errorf("command must have between 1 and 32 arguments")
	}
	for _, part := range argv {
		if part == "" || len(part) > 1024 {
			return nil, fmt.Errorf("each argument must be between 1 and 1024 characters")
		}
		for _, r := range part {
			if r < 0x20 || r == 0x7f {
				return nil, fmt.Errorf("an argument may not contain a control character")
			}
		}
	}
	// exec runs the program directly. No shell is started, so nothing in argv is
	// ever parsed as a command line.
	return []commandSpec{{name: argv[0], args: argv[1:]}}, nil
}

// actionFacets names the facets that observe each action's effect. device_run_action
// declares device_read_state as its verifier, and the loop enforces that obligation
// before a run may resolve, so an action with no observing facet cannot be added.
var actionFacets = map[string][]string{
	"run_command":               {"processes"},
	"gui_invoke_control":        {"screen"},
	"gui_set_control_value":     {"screen"},
	"gui_toggle_control":        {"screen"},
	"gui_select_item":           {"screen"},
	"gui_expand_control":        {"screen"},
	"flush_dns":                 {"resolver"},
	"renew_dhcp_lease":          {"adapters"},
	"clear_proxy_override":      {"proxy"},
	"reset_credential_cache":    {"identity"},
	"restart_user_process":      {"processes"},
	"disable_proxy":             {"proxy"},
	"refresh_certificate_store": {"certificates"},
	"clear_temp_files":          {"storage"},
	"clear_outlook_cache":       {"app_cache"},
	"clear_teams_cache":         {"app_cache"},
	"clear_icon_cache":          {"app_cache"},
	"clear_print_queue":         {"printing"},
}

// actionCommands returns only argument vectors written into this binary. Caller
// input can select an allowlisted process, but can never become a command.
func actionCommands(action string, params map[string]string) ([]commandSpec, error) {
	switch action {
	case "flush_dns":
		return []commandSpec{{name: "ipconfig", args: []string{"/flushdns"}}}, nil
	case "renew_dhcp_lease":
		return []commandSpec{{name: "ipconfig", args: []string{"/renew"}}}, nil
	case "clear_proxy_override":
		return []commandSpec{powershellAction(clearProxyOverrideScript)}, nil
	case "reset_credential_cache":
		return []commandSpec{{name: "klist", args: []string{"purge"}}}, nil
	case "disable_proxy":
		return []commandSpec{powershellAction(disableProxyScript)}, nil
	case "refresh_certificate_store":
		return []commandSpec{{name: "certutil", args: []string{"-user", "-pulse"}}}, nil
	case "clear_temp_files":
		return []commandSpec{powershellAction(clearTempFilesScript)}, nil
	case "clear_outlook_cache":
		return []commandSpec{powershellAction(clearOutlookCacheScript)}, nil
	case "clear_teams_cache":
		return []commandSpec{powershellAction(clearTeamsCacheScript)}, nil
	case "clear_icon_cache":
		return []commandSpec{powershellAction(clearIconCacheScript)}, nil
	case "clear_print_queue":
		return []commandSpec{powershellAction(clearPrintQueueScript)}, nil
	case "run_command":
		return runCommandSpec(params)
	case "gui_invoke_control", "gui_set_control_value", "gui_toggle_control", "gui_select_item", "gui_expand_control":
		return guiStepCommand(action, params)
	case "restart_user_process":
		process := params["process_name"]
		if process == "" { // compatibility with the existing flattened parameter convention
			process = params["processName"]
		}
		process = strings.ToLower(process)
		start, ok := userProcesses[process]
		if !ok {
			if process == "" {
				return nil, fmt.Errorf("process_name is required")
			}
			return nil, fmt.Errorf("process not allowlisted: %s", process)
		}
		return []commandSpec{
			{name: "taskkill", args: []string{"/IM", start.image, "/F"}},
			start.launch,
		}, nil
	default:
		return nil, fmt.Errorf("unknown action: %s", action)
	}
}

// RunAction performs a shipped, non-admin typed action.
func RunAction(ctx context.Context, action string, params map[string]string) (Result, error) {
	commands, err := actionCommands(action, params)
	if err != nil {
		return Result{Detail: err.Error()}, nil
	}
	return runAction(ctx, action, commands)
}

type FacetResult struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Raw   string `json:"raw,omitempty"`
	Error string `json:"error,omitempty"`
}

var knownFacets = map[string]bool{
	"resolver": true, "adapters": true, "reachability": true,
	"proxy": true, "identity": true, "processes": true,
	"certificates": true, "storage": true, "app_cache": true,
	"printing": true, "screen": true,
}

var facetReader = readFacet

// ReadState preserves the daemon-facing API. Parameterized callers should use
// ReadStateWithParams so reachability can receive its required target.
func ReadState(ctx context.Context, facets []string) (map[string]any, error) {
	return ReadStateWithParams(ctx, facets, nil)
}

func ReadStateWithParams(ctx context.Context, facets []string, params map[string]string) (map[string]any, error) {
	type facetResult struct {
		name   string
		result FacetResult
	}
	out := make(map[string]any, len(facets))
	results := make(chan facetResult, len(facets))
	pending := 0
	for _, facet := range facets {
		if !knownFacets[facet] {
			out[facet] = FacetResult{Error: "unknown facet: " + facet}
			continue
		}
		target := ""
		if facet == "reachability" {
			target = params["target"]
			if err := validateTarget(target); err != nil {
				out[facet] = FacetResult{Error: err.Error()}
				continue
			}
		}
		if facet == "screen" {
			window, err := validateUIText("window", params["window"], false)
			if err != nil {
				out[facet] = FacetResult{Error: err.Error()}
				continue
			}
			target = window
		}
		pending++
		go func() { results <- facetResult{facet, facetReader(ctx, facet, target)} }()
	}
	for range pending {
		result := <-results
		out[result.name] = result.result
	}
	return out, nil
}

func validateTarget(target string) error {
	if target == "" {
		return fmt.Errorf("target is required")
	}
	if len(target) > 253 {
		return fmt.Errorf("target is too long")
	}
	if net.ParseIP(target) != nil {
		return nil
	}
	for _, label := range strings.Split(target, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return fmt.Errorf("invalid target")
		}
		for _, r := range label {
			if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-') {
				return fmt.Errorf("invalid target")
			}
		}
	}
	return nil
}
