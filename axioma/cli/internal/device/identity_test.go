package device

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestLoadQuarantinesCorruptIdentity(t *testing.T) {
	base := t.TempDir()
	t.Setenv("LOCALAPPDATA", base)
	dir := filepath.Join(base, "axioma")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "device.json")
	if err := os.WriteFile(path, []byte("not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load("test"); err == nil || !strings.Contains(err.Error(), "corrupt") {
		t.Fatalf("Load returned %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("corrupt identity remains at original path: %v", err)
	}
	matches, err := filepath.Glob(path + ".corrupt-*")
	if err != nil || len(matches) != 1 {
		t.Fatalf("quarantine files = %v, %v", matches, err)
	}
}

func TestSaveSequenceRefusesBackwardMove(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	if err := SaveSequence(Identity{DeviceID: "device", LastSeenSequence: 7}, 6); err == nil {
		t.Fatal("backward sequence was accepted")
	}
}

func TestSaveSequenceRefusesStaleWriter(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	id, err := Load("test")
	if err != nil {
		t.Fatal(err)
	}
	if err := SaveSequence(id, 9); err != nil {
		t.Fatal(err)
	}
	if err := SaveSequence(id, 8); err == nil {
		t.Fatal("stale identity regressed persisted sequence")
	}
	loaded, err := Load("test")
	if err != nil || loaded.LastSeenSequence != 9 {
		t.Fatalf("persisted sequence = %d, %v", loaded.LastSeenSequence, err)
	}
}

func TestSaveSequencePreservesCredentials(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	id, err := Load("test")
	if err != nil {
		t.Fatal(err)
	}
	if err := SaveCredentials(id, "short-lived", "long-lived"); err != nil {
		t.Fatal(err)
	}
	id.EnrolmentToken, id.Credential = "short-lived", "long-lived"
	if err := SaveSequence(id, 9); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load("test")
	if err != nil {
		t.Fatal(err)
	}
	if loaded.LastSeenSequence != 9 || loaded.EnrolmentToken != "short-lived" || loaded.Credential != "long-lived" {
		t.Fatalf("state not preserved: %+v", loaded)
	}
	info, err := os.Stat(filepath.Join(os.Getenv("LOCALAPPDATA"), "axioma", "device.json"))
	if err != nil {
		t.Fatal(err)
	}
	// Windows ACLs, rather than Unix mode bits, protect the profile-scoped file.
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("credential file mode = %v", info.Mode().Perm())
	}
}

func TestSaveCredentialsPreservesConcurrentSequence(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	id, err := Load("test")
	if err != nil {
		t.Fatal(err)
	}
	if err := SaveSequence(id, 9); err != nil {
		t.Fatal(err)
	}
	if err := SaveCredentials(id, "", "rotated"); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load("test")
	if err != nil || loaded.LastSeenSequence != 9 || loaded.Credential != "rotated" {
		t.Fatalf("concurrent state lost: %+v, %v", loaded, err)
	}
}
