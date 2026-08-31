package tui

import (
	"context"
	"testing"
)

func TestDoctorCheckUsesParentContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	model := NewDoctor(ctx, []Check{{Name: "canceled", Run: func(ctx context.Context) (string, error) {
		<-ctx.Done()
		return "", ctx.Err()
	}}}).(doctorModel)
	// Init batches the background-colour request with the first check; the
	// check-running command is what this test is about.
	result := model.runNext()().(checkResult)
	if result.detail != context.Canceled.Error() {
		t.Fatalf("check result = %+v", result)
	}
}
