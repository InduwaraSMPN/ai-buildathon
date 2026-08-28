// Package device owns the agent's identity and the actions it can perform on
// the machine it runs on.
package device

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
)

// Identity is what the agent reports when it dials the gateway.
type Identity struct {
	DeviceID     string `json:"deviceId"`
	Hostname     string `json:"-"`
	Username     string `json:"-"`
	Platform     string `json:"-"`
	Release      string `json:"-"`
	AgentVersion string `json:"-"`
}

// StateDir is where the agent keeps its identity and local state.
//
// On Windows this is under the user profile, which is deliberate: the agent runs
// as the logged-in user so it can see that user's network configuration and
// applications, and its identity should have the same lifetime.
func StateDir() (string, error) {
	if base := os.Getenv("LOCALAPPDATA"); base != "" {
		return filepath.Join(base, "axioma"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate home directory: %w", err)
	}
	return filepath.Join(home, ".local", "share", "axioma"), nil
}

// Load returns the persisted device identity, minting one on first run.
//
// The ID survives restarts, agent upgrades, and network roaming, and dies with
// the user profile — the right lifetime for "this person's laptop". A hardware
// ID would outlive a reimage and clone with a VM image, which is worse on both
// counts and is a privacy artifact besides.
func Load(agentVersion string) (Identity, error) {
	dir, err := StateDir()
	if err != nil {
		return Identity{}, err
	}
	path := filepath.Join(dir, "device.json")

	id := Identity{
		Platform:     runtime.GOOS,
		Release:      runtime.GOARCH,
		AgentVersion: agentVersion,
	}

	if host, err := os.Hostname(); err == nil {
		id.Hostname = host
	}
	if u, err := user.Current(); err == nil {
		id.Username = u.Username
	}

	if raw, err := os.ReadFile(path); err == nil {
		var stored Identity
		if json.Unmarshal(raw, &stored) == nil && stored.DeviceID != "" {
			id.DeviceID = stored.DeviceID
			return id, nil
		}
	}

	generated, err := newID()
	if err != nil {
		return Identity{}, err
	}
	id.DeviceID = generated

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Identity{}, fmt.Errorf("create state dir: %w", err)
	}
	body, err := json.MarshalIndent(Identity{DeviceID: id.DeviceID}, "", "  ")
	if err != nil {
		return Identity{}, err
	}
	if err := os.WriteFile(path, body, 0o600); err != nil {
		return Identity{}, fmt.Errorf("persist device id: %w", err)
	}
	return id, nil
}

func newID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate device id: %w", err)
	}
	// RFC 4122 version 4.
	buf[6] = (buf[6] & 0x0f) | 0x40
	buf[8] = (buf[8] & 0x3f) | 0x80
	h := hex.EncodeToString(buf)
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[0:8], h[8:12], h[12:16], h[16:20], h[20:32]), nil
}
