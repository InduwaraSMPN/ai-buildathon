package device

import "testing"

func TestParseInventory(t *testing.T) {
	tests := []struct {
		name  string
		raw   string
		check func(t *testing.T, value any)
	}{
		{"disks", `{"disks":[{"device_id":"\\\\.\\PHYSICALDRIVE0","model":"NVMe Drive","serial_number":"ABC123","interface":"SCSI","media_type":"Fixed hard disk media","size_bytes":512110190592}]}`, func(t *testing.T, value any) {
			disk := value.(*DisksInventory).Disks[0]
			if disk.SerialNumber != "ABC123" || disk.SizeBytes != 512110190592 {
				t.Fatalf("unexpected disk: %+v", disk)
			}
		}},
		{"hardware", `{"manufacturer":"Contoso","model":"Laptop 1","serial_number":"SERIAL","bios_version":"1.2.3","os_architecture":"64-bit","total_memory_bytes":17179869184,"processors":[{"name":"CPU","manufacturer":"GenuineIntel","cores":8,"logical_processors":12}]}`, func(t *testing.T, value any) {
			hardware := value.(*HardwareInventory)
			if hardware.Model != "Laptop 1" || hardware.Processors[0].LogicalProcessors != 12 {
				t.Fatalf("unexpected hardware: %+v", hardware)
			}
		}},
		{"software", `{"applications":[{"name":"Editor","version":"4.2","publisher":"Contoso","install_date":"20260829"}]}`, func(t *testing.T, value any) {
			software := value.(*SoftwareInventory).Applications[0]
			if software.Name != "Editor" || software.Version != "4.2" {
				t.Fatalf("unexpected software: %+v", software)
			}
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value, err := parseInventory(test.name, test.raw)
			if err != nil {
				t.Fatal(err)
			}
			test.check(t, value)
		})
	}
}

func TestParseInventoryRejectsUnexpectedAndTrailingData(t *testing.T) {
	for _, raw := range []string{
		`{"applications":[],"command":"whoami"}`,
		`{"applications":[]} trailing`,
		`not json`,
	} {
		if _, err := parseInventory("software", raw); err == nil {
			t.Fatalf("accepted %q", raw)
		}
	}
	if _, err := parseInventory("unknown", `{}`); err == nil {
		t.Fatal("accepted unknown inventory kind")
	}
}

func TestInventoryRemainsSeparateFromDiagnosticFacets(t *testing.T) {
	for _, name := range []string{"disks", "hardware", "software"} {
		if knownFacets[name] {
			t.Fatalf("inventory %q exposed as diagnostic facet", name)
		}
	}
	if _, err := splitFacets(`"software"`); err == nil {
		t.Fatal("software inventory accepted by device_read_state")
	}
}
