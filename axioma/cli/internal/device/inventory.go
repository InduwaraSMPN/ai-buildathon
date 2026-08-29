package device

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// Inventory is collected for the asset register on its own schedule. It is not
// a diagnostic facet and must not be exposed through ReadState.
type Inventory struct {
	Disks    InventoryResult `json:"disks"`
	Hardware InventoryResult `json:"hardware"`
	Software InventoryResult `json:"software"`
}

type InventoryResult struct {
	OK    bool   `json:"ok"`
	Data  any    `json:"data,omitempty"`
	Raw   string `json:"raw,omitempty"`
	Error string `json:"error,omitempty"`
}

type Disk struct {
	DeviceID     string `json:"device_id"`
	Model        string `json:"model,omitempty"`
	SerialNumber string `json:"serial_number,omitempty"`
	Interface    string `json:"interface,omitempty"`
	MediaType    string `json:"media_type,omitempty"`
	SizeBytes    uint64 `json:"size_bytes"`
}

type DisksInventory struct {
	Disks []Disk `json:"disks"`
}

type Processor struct {
	Name              string `json:"name"`
	Manufacturer      string `json:"manufacturer,omitempty"`
	Cores             uint32 `json:"cores"`
	LogicalProcessors uint32 `json:"logical_processors"`
}

type HardwareInventory struct {
	Manufacturer     string      `json:"manufacturer,omitempty"`
	Model            string      `json:"model,omitempty"`
	SerialNumber     string      `json:"serial_number,omitempty"`
	BIOSVersion      string      `json:"bios_version,omitempty"`
	OSArchitecture   string      `json:"os_architecture,omitempty"`
	TotalMemoryBytes uint64      `json:"total_memory_bytes"`
	Processors       []Processor `json:"processors"`
}

type Software struct {
	Name        string `json:"name"`
	Version     string `json:"version,omitempty"`
	Publisher   string `json:"publisher,omitempty"`
	InstallDate string `json:"install_date,omitempty"`
}

type SoftwareInventory struct {
	Applications []Software `json:"applications"`
}

// CollectInventory gathers register data independently of diagnostic commands.
func CollectInventory(ctx context.Context) Inventory {
	return Inventory{
		Disks:    readInventory(ctx, "disks"),
		Hardware: readInventory(ctx, "hardware"),
		Software: readInventory(ctx, "software"),
	}
}

func parseInventory(name, raw string) (any, error) {
	var dst any
	switch name {
	case "disks":
		dst = &DisksInventory{}
	case "hardware":
		dst = &HardwareInventory{}
	case "software":
		dst = &SoftwareInventory{}
	default:
		return nil, fmt.Errorf("unknown inventory: %s", name)
	}
	decoder := json.NewDecoder(bytes.NewBufferString(strings.TrimSpace(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return nil, fmt.Errorf("parse %s inventory: %w", name, err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return nil, fmt.Errorf("parse %s inventory: trailing data", name)
	}
	return dst, nil
}
