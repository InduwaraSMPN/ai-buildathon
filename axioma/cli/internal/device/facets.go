package device

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

type cappedBuffer struct {
	bytes.Buffer
	overflow bool
}

func (b *cappedBuffer) Write(p []byte) (int, error) {
	n := len(p)
	remaining := maxCommandOutput - b.Len()
	if remaining > 0 {
		if len(p) > remaining {
			p = p[:remaining]
		}
		_, _ = b.Buffer.Write(p)
	}
	if n > remaining {
		b.overflow = true
	}
	return n, nil
}

type ResolverFacet struct {
	Servers          map[string][]string `json:"servers"`
	SuffixSearchList []string            `json:"suffix_search_list"`
	CachedEntries    int                 `json:"cached_entries"`
}

type Adapter struct {
	Name        string `json:"name"`
	Status      string `json:"status"`
	IPv4        string `json:"ipv4,omitempty"`
	Gateway     string `json:"gateway,omitempty"`
	DHCPEnabled bool   `json:"dhcp_enabled"`
	LeaseExpiry string `json:"lease_expiry,omitempty"`
}

type AdaptersFacet struct {
	Adapters []Adapter `json:"adapters"`
}

type ReachabilityFacet struct {
	Target          string   `json:"target"`
	ResolvedAddress string   `json:"resolved_address,omitempty"`
	PacketLoss      float64  `json:"packet_loss_percent"`
	MeanLatencyMS   *float64 `json:"mean_latency_ms,omitempty"`
}

type ProxyFacet struct {
	Enabled  bool   `json:"enabled"`
	Server   string `json:"server,omitempty"`
	Override string `json:"override,omitempty"`
}

type IdentityFacet struct {
	Name            string `json:"name"`
	SID             string `json:"sid"`
	KerberosTickets int    `json:"kerberos_tickets"`
}

type Process struct {
	Name    string `json:"name"`
	PID     int    `json:"pid"`
	Running bool   `json:"running"`
}

type ProcessesFacet struct {
	Processes []Process `json:"processes"`
}

type Certificate struct {
	Subject    string `json:"subject"`
	Issuer     string `json:"issuer,omitempty"`
	Thumbprint string `json:"thumbprint"`
	NotAfter   string `json:"not_after"`
	Expired    bool   `json:"expired"`
}

type CertificatesFacet struct {
	Store        string        `json:"store"`
	Count        int           `json:"count"`
	Certificates []Certificate `json:"certificates"`
}

// StorageFacet is live free space and the user temp footprint. The disks
// inventory is a hardware register and stays out of the diagnostic vocabulary.
type StorageFacet struct {
	SystemDrive string `json:"system_drive"`
	FreeBytes   int64  `json:"free_bytes"`
	TotalBytes  int64  `json:"total_bytes"`
	TempPath    string `json:"temp_path"`
	TempBytes   int64  `json:"temp_bytes"`
	TempFiles   int    `json:"temp_files"`
}

type AppCache struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Exists bool   `json:"exists"`
	Bytes  int64  `json:"bytes"`
	Files  int    `json:"files"`
}

type AppCacheFacet struct {
	Caches []AppCache `json:"caches"`
}

type Printer struct {
	Name   string `json:"name"`
	Status string `json:"status,omitempty"`
	Jobs   int    `json:"jobs"`
}

type PrintingFacet struct {
	Printers       []Printer `json:"printers"`
	DefaultPrinter string    `json:"default_printer,omitempty"`
	QueuedJobs     int       `json:"queued_jobs"`
}

type ScreenControl struct {
	Name    string   `json:"name"`
	Role    string   `json:"role"`
	Enabled bool     `json:"enabled"`
	Actions []string `json:"actions"`
}

// ScreenFacet is the accessibility tree of one window, reduced to the controls a
// GUI step can act on. It is what verifies a gui_* action, and it is also what
// makes one selectable: a step names a control this facet reported.
type ScreenFacet struct {
	Window    string          `json:"window"`
	Controls  []ScreenControl `json:"controls"`
	Truncated bool            `json:"truncated"`
}

func parseFacet(name, raw string) (any, error) {
	var dst any
	switch name {
	case "resolver":
		dst = &ResolverFacet{}
	case "adapters":
		dst = &AdaptersFacet{}
	case "reachability":
		dst = &ReachabilityFacet{}
	case "proxy":
		dst = &ProxyFacet{}
	case "identity":
		dst = &IdentityFacet{}
	case "processes":
		dst = &ProcessesFacet{}
	case "certificates":
		dst = &CertificatesFacet{}
	case "storage":
		dst = &StorageFacet{}
	case "app_cache":
		dst = &AppCacheFacet{}
	case "printing":
		dst = &PrintingFacet{}
	case "screen":
		dst = &ScreenFacet{}
	default:
		return nil, fmt.Errorf("unknown facet: %s", name)
	}
	decoder := json.NewDecoder(bytes.NewBufferString(strings.TrimSpace(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return nil, fmt.Errorf("parse %s facet: %w", name, err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return nil, fmt.Errorf("parse %s facet: trailing data", name)
	}
	return dst, nil
}

func boundedRaw(raw string) string {
	raw = strings.TrimSpace(raw)
	if len(raw) <= maxFacetRaw {
		return raw
	}
	cut := maxFacetRaw
	for cut > 0 && !utf8.ValidString(raw[:cut]) {
		cut--
	}
	return raw[:cut]
}
