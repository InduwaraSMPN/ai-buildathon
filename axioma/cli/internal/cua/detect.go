package cua

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

const DefaultURL = "http://127.0.0.1:8000"

type Availability struct {
	Available bool   `json:"available"`
	Version   string `json:"version,omitempty"`
}

type Detector struct {
	URL    string
	Client *http.Client
	TTL    time.Duration

	mu      sync.Mutex
	checked time.Time
	result  Availability
}

func NewDetector() *Detector {
	return &Detector{URL: DefaultURL, Client: &http.Client{Timeout: 2 * time.Second}, TTL: 5 * time.Second}
}

func (d *Detector) Detect(ctx context.Context) Availability {
	d.mu.Lock()
	defer d.mu.Unlock()
	if time.Since(d.checked) < d.TTL {
		return d.result
	}
	d.checked = time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.URL+"/cmd", bytes.NewBufferString(`{"command":"version","params":{}}`))
	if err != nil {
		d.result = Availability{}
		return d.result
	}
	resp, err := d.Client.Do(req)
	if err != nil {
		d.result = Availability{}
		return d.result
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		d.result = Availability{}
		return d.result
	}
	var status struct {
		Success bool   `json:"success"`
		Version string `json:"package"`
	}
	scanner := bufio.NewScanner(resp.Body)
	if scanner.Scan() {
		line := strings.TrimPrefix(scanner.Text(), "data: ")
		_ = json.Unmarshal([]byte(line), &status)
	}
	d.result = Availability{Available: status.Success, Version: status.Version}
	return d.result
}

func Check(ctx context.Context) (string, error) {
	result := NewDetector().Detect(ctx)
	if !result.Available {
		return "not installed (optional)", nil
	}
	if result.Version == "" {
		return "available", nil
	}
	return fmt.Sprintf("available (%s)", result.Version), nil
}
