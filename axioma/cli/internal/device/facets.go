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
