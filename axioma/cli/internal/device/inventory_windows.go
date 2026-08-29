//go:build windows

package device

import (
	"context"
	"fmt"
)

const disksInventoryScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $items=@(Get-CimInstance Win32_DiskDrive|ForEach-Object{@{device_id=[string]$_.DeviceID;model=[string]$_.Model;serial_number=([string]$_.SerialNumber).Trim();interface=[string]$_.InterfaceType;media_type=[string]$_.MediaType;size_bytes=[uint64]$_.Size}}); @{disks=$items}|ConvertTo-Json -Compress -Depth 4`
const hardwareInventoryScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $system=Get-CimInstance Win32_ComputerSystem; $bios=Get-CimInstance Win32_BIOS; $os=Get-CimInstance Win32_OperatingSystem; $processors=@(Get-CimInstance Win32_Processor|ForEach-Object{@{name=[string]$_.Name;manufacturer=[string]$_.Manufacturer;cores=[uint32]$_.NumberOfCores;logical_processors=[uint32]$_.NumberOfLogicalProcessors}}); @{manufacturer=[string]$system.Manufacturer;model=[string]$system.Model;serial_number=([string]$bios.SerialNumber).Trim();bios_version=[string]$bios.SMBIOSBIOSVersion;os_architecture=[string]$os.OSArchitecture;total_memory_bytes=[uint64]$system.TotalPhysicalMemory;processors=$processors}|ConvertTo-Json -Compress -Depth 4`
const softwareInventoryScript = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $ErrorActionPreference='Stop'; $paths=@('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'); $items=@(Get-ItemProperty $paths -ErrorAction SilentlyContinue|Where-Object{$_.DisplayName}|Sort-Object DisplayName,DisplayVersion -Unique|ForEach-Object{@{name=[string]$_.DisplayName;version=[string]$_.DisplayVersion;publisher=[string]$_.Publisher;install_date=[string]$_.InstallDate}}); @{applications=$items}|ConvertTo-Json -Compress -Depth 4`

func inventoryCommand(name string) (commandSpec, error) {
	script := map[string]string{
		"disks": disksInventoryScript, "hardware": hardwareInventoryScript, "software": softwareInventoryScript,
	}[name]
	if script == "" {
		return commandSpec{}, fmt.Errorf("unknown inventory: %s", name)
	}
	return commandSpec{name: "powershell.exe", args: []string{"-NoProfile", "-NonInteractive", "-Command", script}}, nil
}

func readInventory(ctx context.Context, name string) InventoryResult {
	command, err := inventoryCommand(name)
	if err != nil {
		return InventoryResult{Error: err.Error()}
	}
	result, err := runCommand(ctx, command.name, command.args...)
	if err != nil || !result.OK {
		return InventoryResult{Raw: boundedRaw(result.Detail), Error: result.Detail}
	}
	data, err := parseInventory(name, result.Detail)
	if err != nil {
		return InventoryResult{Raw: boundedRaw(result.Detail), Error: err.Error()}
	}
	return InventoryResult{OK: true, Data: data, Raw: boundedRaw(result.Detail)}
}
