package device

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	GRPCHost string `json:"grpcHost"`
}

func LoadConfig() (Config, error) {
	dir, err := StateDir()
	if err != nil {
		return Config{}, err
	}
	raw, err := os.ReadFile(filepath.Join(dir, "config.json"))
	if errors.Is(err, os.ErrNotExist) {
		return Config{}, nil
	}
	if err != nil {
		return Config{}, err
	}
	var config Config
	if err := json.Unmarshal(raw, &config); err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}
	return config, nil
}

func SaveConfig(config Config) error {
	config.GRPCHost = strings.TrimSpace(config.GRPCHost)
	if config.GRPCHost == "" {
		return fmt.Errorf("gateway address is required")
	}
	dir, err := StateDir()
	if err != nil {
		return err
	}
	return writeJSON(filepath.Join(dir, "config.json"), config)
}
