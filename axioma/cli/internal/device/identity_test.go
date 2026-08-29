package device

import (
	"os"
	"path/filepath"
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

func TestSaveSequencePreservesEnrolmentCode(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	id, err := Load("test")
	if err != nil {
		t.Fatal(err)
	}
	id.EnrolmentCode = "ABCDEF-1234"
	if err := SaveEnrolmentCode(id, id.EnrolmentCode); err != nil {
		t.Fatal(err)
	}
	if err := SaveSequence(id, 9); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load("test")
	if err != nil {
		t.Fatal(err)
	}
	if loaded.LastSeenSequence != 9 || loaded.EnrolmentCode != id.EnrolmentCode {
		t.Fatalf("state not preserved: %+v", loaded)
	}
}
