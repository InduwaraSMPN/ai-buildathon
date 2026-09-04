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
	"time"
)

// Identity is what the agent reports when it dials the gateway.
type Identity struct {
	DeviceID         string `json:"deviceId"`
	LastSeenSequence uint64 `json:"lastSeenSequence,omitempty"`
	EnrolmentToken   string `json:"enrolmentToken,omitempty"`
	Credential       string `json:"credential,omitempty"`
	Hostname         string `json:"-"`
	Username         string `json:"-"`
	Platform         string `json:"-"`
	Release          string `json:"-"`
	AgentVersion     string `json:"-"`
}

// DaemonState is the small persisted snapshot shown by `status`.
type DaemonState struct {
	Connected        bool      `json:"connected"`
	GRPCHost         string    `json:"grpcHost"`
	LastSeenSequence uint64    `json:"lastSeenSequence"`
	UpdatedAt        time.Time `json:"updatedAt"`
	LastError        string    `json:"lastError,omitempty"`
	// When the last inventory sweep succeeded. Persisted so a reconnect does not
	// re-run three PowerShell WMI queries: a gateway that accepts the stream and
	// then goes silent reconnects about once a minute, and an unconditional
	// sweep made that a continuous load on every laptop in the fleet.
	LastInventoryAt time.Time `json:"lastInventoryAt,omitempty"`
	// Shown by `axel-cli status` so the employee can type it into the portal and
	// claim this machine. Enrolment alone leaves the device unowned.
	ClaimCode string `json:"claimCode,omitempty"`
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
		Release:      osRelease(),
		AgentVersion: agentVersion,
	}

	if host, err := os.Hostname(); err == nil {
		id.Hostname = host
	}
	if u, err := user.Current(); err == nil {
		id.Username = u.Username
	}

	raw, err := os.ReadFile(path)
	if err == nil {
		var stored Identity
		if err := json.Unmarshal(raw, &stored); err == nil && stored.DeviceID != "" {
			id.DeviceID = stored.DeviceID
			id.LastSeenSequence = stored.LastSeenSequence
			id.EnrolmentToken = stored.EnrolmentToken
			id.Credential = stored.Credential
			return id, nil
		}
		backup := fmt.Sprintf("%s.corrupt-%s", path, time.Now().UTC().Format("20060102T150405.000000000Z"))
		if renameErr := os.Rename(path, backup); renameErr != nil {
			return Identity{}, fmt.Errorf("device identity is corrupt and could not be quarantined: %w", renameErr)
		}
		return Identity{}, fmt.Errorf("device identity is corrupt; moved to %s", backup)
	}
	if !os.IsNotExist(err) {
		return Identity{}, fmt.Errorf("read device identity: %w", err)
	}

	generated, err := newID()
	if err != nil {
		return Identity{}, err
	}
	id.DeviceID = generated

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Identity{}, fmt.Errorf("create state dir: %w", err)
	}
	if err := writeJSON(path, persistedIdentity(id)); err != nil {
		return Identity{}, fmt.Errorf("persist device id: %w", err)
	}
	return id, nil
}

// SaveSequence atomically advances the persisted command sequence.
func SaveSequence(id Identity, sequence uint64) error {
	if sequence < id.LastSeenSequence {
		return fmt.Errorf("sequence cannot move backwards: %d < %d", sequence, id.LastSeenSequence)
	}
	dir, err := StateDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "device.json")
	if raw, err := os.ReadFile(path); err == nil {
		var current Identity
		if json.Unmarshal(raw, &current) == nil && current.DeviceID == id.DeviceID {
			id.EnrolmentToken = current.EnrolmentToken
			id.Credential = current.Credential
			if sequence < current.LastSeenSequence {
				return fmt.Errorf("sequence cannot move backwards: %d < %d", sequence, current.LastSeenSequence)
			}
		}
	}
	id.LastSeenSequence = sequence
	return writeJSON(path, persistedIdentity(id))
}

// SaveCredentials atomically updates authentication material without regressing
// a sequence written concurrently by the daemon.
func SaveCredentials(id Identity, enrolmentToken, credential string) error {
	dir, err := StateDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "device.json")
	if raw, err := os.ReadFile(path); err == nil {
		var current Identity
		if json.Unmarshal(raw, &current) == nil && current.DeviceID == id.DeviceID && current.LastSeenSequence > id.LastSeenSequence {
			id.LastSeenSequence = current.LastSeenSequence
		}
	}
	id.EnrolmentToken = enrolmentToken
	id.Credential = credential
	return writeJSON(path, persistedIdentity(id))
}

func persistedIdentity(id Identity) Identity {
	return Identity{DeviceID: id.DeviceID, LastSeenSequence: id.LastSeenSequence, EnrolmentToken: id.EnrolmentToken, Credential: id.Credential}
}

func SaveDaemonState(state DaemonState) error {
	dir, err := StateDir()
	if err != nil {
		return err
	}
	state.UpdatedAt = time.Now()
	return writeJSON(filepath.Join(dir, "daemon.json"), state)
}

func LoadDaemonState() (DaemonState, error) {
	dir, err := StateDir()
	if err != nil {
		return DaemonState{}, err
	}
	raw, err := os.ReadFile(filepath.Join(dir, "daemon.json"))
	if err != nil {
		return DaemonState{}, err
	}
	var state DaemonState
	if err := json.Unmarshal(raw, &state); err != nil {
		return DaemonState{}, fmt.Errorf("read daemon state: %w", err)
	}
	return state, nil
}

func writeJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	body, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(body); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
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
