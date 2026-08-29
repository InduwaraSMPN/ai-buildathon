package device

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestActionCommands(t *testing.T) {
	tests := []struct {
		name   string
		params map[string]string
		want   []commandSpec
	}{
		{"flush_dns", nil, []commandSpec{{"ipconfig", []string{"/flushdns"}}}},
		{"renew_dhcp_lease", nil, []commandSpec{{"ipconfig", []string{"/renew"}}}},
		{"clear_proxy_override", nil, []commandSpec{{"powershell.exe", []string{"-NoProfile", "-NonInteractive", "-Command", `Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -Name ProxyOverride -ErrorAction SilentlyContinue`}}}},
		{"reset_credential_cache", nil, []commandSpec{{"klist", []string{"purge"}}}},
		{"restart_user_process", map[string]string{"process_name": "Notepad"}, []commandSpec{{"taskkill", []string{"/IM", "notepad.exe", "/F"}}, {"notepad.exe", nil}}},
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
	for _, name := range []string{"resolver", "adapters", "reachability", "proxy", "identity", "processes"} {
		t.Run(name, func(t *testing.T) {
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
