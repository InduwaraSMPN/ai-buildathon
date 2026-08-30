package cua

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCheckReusesDefaultDetector(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		_, _ = w.Write([]byte(`data: {"success":true,"package":"1.2.3"}`))
	}))
	defer server.Close()
	original := defaultDetector
	defer func() { defaultDetector = original }()
	defaultDetector = &Detector{URL: server.URL, Client: server.Client(), TTL: time.Hour}
	for range 2 {
		if got, err := Check(context.Background()); err != nil || got != "available (1.2.3)" {
			t.Fatalf("Check() = %q, %v", got, err)
		}
	}
	if calls != 1 {
		t.Fatalf("Check made %d requests", calls)
	}
}

func TestDetectorCachesAndRefreshes(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		_, _ = w.Write([]byte(`data: {"success":true,"package":"1.2.3","protocol":"1"}`))
	}))
	defer server.Close()
	d := &Detector{URL: server.URL, Client: server.Client(), TTL: time.Hour}
	if got := d.Detect(context.Background()); !got.Available || got.Version != "1.2.3" {
		t.Fatalf("unexpected detection: %+v", got)
	}
	_ = d.Detect(context.Background())
	if calls != 1 {
		t.Fatalf("expected cached detection, got %d calls", calls)
	}
	d.TTL = 0
	_ = d.Detect(context.Background())
	if calls != 2 {
		t.Fatalf("expected refreshed detection, got %d calls", calls)
	}
}
