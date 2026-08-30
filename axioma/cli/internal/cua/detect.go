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
	if time.Since(d.checked) < d.TTL {
		result := d.result
		d.mu.Unlock()
		return result
	}
	d.mu.Unlock()

	result := d.detect(ctx)
	d.mu.Lock()
	d.checked, d.result = time.Now(), result
	d.mu.Unlock()
	return result
}

func (d *Detector) detect(ctx context.Context) Availability {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.URL+"/cmd", bytes.NewBufferString(`{"command":"version","params":{}}`))
	if err != nil {
		return Availability{}
	}
	resp, err := d.Client.Do(req)
	if err != nil {
		return Availability{}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Availability{}
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
	return Availability{Available: status.Success, Version: status.Version}
}

var defaultDetector = NewDetector()

func Check(ctx context.Context) (string, error) {
	result := defaultDetector.Detect(ctx)
	if !result.Available {
		return "not installed (optional)", nil
	}
	if result.Version == "" {
		return "available", nil
	}
	return fmt.Sprintf("available (%s)", result.Version), nil
}
