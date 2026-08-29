package device

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/axioma/cli/internal/pb"
)

type fakeDeviceStream struct {
	recv   chan *pb.GatewayMessage
	sent   chan *pb.DeviceMessage
	closed chan struct{}
	once   sync.Once
}

func newFakeDeviceStream() *fakeDeviceStream {
	return &fakeDeviceStream{
		recv: make(chan *pb.GatewayMessage, 8), sent: make(chan *pb.DeviceMessage, 16), closed: make(chan struct{}),
	}
}

func (s *fakeDeviceStream) Send(msg *pb.DeviceMessage) error {
	select {
	case s.sent <- msg:
		return nil
	case <-s.closed:
		return io.EOF
	}
}

func (s *fakeDeviceStream) Recv() (*pb.GatewayMessage, error) {
	select {
	case msg := <-s.recv:
		return msg, nil
	case <-s.closed:
		return nil, io.EOF
	}
}

func (s *fakeDeviceStream) close() { s.once.Do(func() { close(s.closed) }) }

func gatewayCommand(sequence uint64) *pb.GatewayMessage {
	return &pb.GatewayMessage{Payload: &pb.GatewayMessage_Command{Command: &pb.DeviceCommand{
		CommandId: "c", Sequence: sequence, Action: "flush_dns",
	}}}
}

func TestExecuteRejectsComputerUse(t *testing.T) {
	result := execute(context.Background(), &pb.DeviceCommand{CommandId: "c1", Sequence: 7, ComputerUse: true})
	if result.Ok || result.Sequence != 7 || !strings.Contains(result.Error, "computer-use") {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestSplitFacets(t *testing.T) {
	facets, err := splitFacets(`["resolver","processes"]`)
	if err != nil || len(facets) != 2 || facets[0] != "resolver" || facets[1] != "processes" {
		t.Fatalf("unexpected facets: %#v, %v", facets, err)
	}
	for _, raw := range []string{"", `[]`, `["bogus"]`, `{}`, `not-json`} {
		if _, err := splitFacets(raw); err == nil {
			t.Errorf("splitFacets(%q) succeeded", raw)
		}
	}
}

func TestActionOKAllFacetsFail(t *testing.T) {
	failed := map[string]any{
		"resolver":  FacetResult{Error: "failed"},
		"processes": FacetResult{Error: "failed"},
	}
	if actionOK(failed) {
		t.Fatal("all-failed facet aggregate reported success")
	}
	failed["resolver"] = FacetResult{OK: true}
	if !actionOK(failed) {
		t.Fatal("partially successful facet aggregate reported failure")
	}
}

func TestCommandTimeoutSelection(t *testing.T) {
	for _, test := range []struct {
		seconds uint32
		want    time.Duration
	}{
		{0, 30 * time.Second},
		{60, time.Minute},
		{600, 5 * time.Minute},
	} {
		if got := commandTimeout(test.seconds); got != test.want {
			t.Errorf("commandTimeout(%d) = %s, want %s", test.seconds, got, test.want)
		}
	}
}

func TestBackoffResetsOnlyAfterStablePeriod(t *testing.T) {
	if got := nextBackoff(8*time.Second, 29*time.Second, 30*time.Second); got != 16*time.Second {
		t.Fatalf("unstable connection reset backoff: %s", got)
	}
	if got := nextBackoff(16*time.Second, 30*time.Second, 30*time.Second); got != time.Second {
		t.Fatalf("stable connection did not reset backoff: %s", got)
	}
	if got := nextBackoff(30*time.Second, 0, 30*time.Second); got != 30*time.Second {
		t.Fatalf("backoff exceeded cap: %s", got)
	}
}

func TestServeConnectionPersistsBeforeExecuteAndAcknowledgesDuplicate(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	id := Identity{DeviceID: "device"}
	var persisted atomic.Bool
	var executions atomic.Int32
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &id,
			daemonTimings{heartbeat: time.Hour, liveness: time.Hour},
			func(_ Identity, sequence uint64) error {
				if sequence != 1 {
					t.Errorf("persist sequence = %d", sequence)
				}
				persisted.Store(true)
				return nil
			},
			func(_ context.Context, command *pb.DeviceCommand) *pb.CommandResult {
				if !persisted.Load() {
					t.Error("command executed before sequence persisted")
				}
				executions.Add(1)
				return &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence, Ok: true}
			})
	}()
	<-stream.sent // hello
	stream.recv <- gatewayCommand(1)
	waitForResult(t, stream.sent)
	stream.recv <- gatewayCommand(1)
	duplicate := waitForResult(t, stream.sent)
	if duplicate.Ok || !strings.Contains(duplicate.OutputJson, "indeterminate") {
		t.Fatalf("duplicate was not acknowledged as indeterminate: %+v", duplicate)
	}
	if executions.Load() != 1 {
		t.Fatalf("duplicate reran command: %d executions", executions.Load())
	}
	cancel()
	stream.close()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("serveConnection returned %v", err)
	}
}

func TestServeConnectionDoesNotExecuteWhenPersistenceFails(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	var executions atomic.Int32
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &Identity{DeviceID: "device"},
			daemonTimings{heartbeat: time.Hour, liveness: time.Hour},
			func(Identity, uint64) error { return errors.New("disk full") },
			func(context.Context, *pb.DeviceCommand) *pb.CommandResult {
				executions.Add(1)
				return nil
			})
	}()
	<-stream.sent
	stream.recv <- gatewayCommand(1)
	if err := <-done; err == nil || !strings.Contains(err.Error(), "persist sequence") {
		t.Fatalf("serveConnection returned %v", err)
	}
	if executions.Load() != 0 {
		t.Fatal("command executed after persistence failure")
	}
}

func TestServeConnectionDetectsSilentGateway(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &Identity{DeviceID: "device"},
			daemonTimings{heartbeat: time.Hour, liveness: 10 * time.Millisecond},
			func(Identity, uint64) error { return nil }, execute)
	}()
	<-stream.sent
	select {
	case err := <-done:
		if err == nil || !strings.Contains(err.Error(), "gateway silent") {
			t.Fatalf("serveConnection returned %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("silent gateway was not detected")
	}
}

func TestServeConnectionHeartbeatsDuringActionAndCancels(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	id := Identity{DeviceID: "device"}
	started := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &id,
			daemonTimings{heartbeat: 5 * time.Millisecond, liveness: time.Second},
			func(Identity, uint64) error { return nil },
			func(ctx context.Context, command *pb.DeviceCommand) *pb.CommandResult {
				close(started)
				<-ctx.Done()
				return &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence}
			})
	}()
	<-stream.sent // hello
	stream.recv <- gatewayCommand(1)
	<-started
	select {
	case msg := <-stream.sent:
		if msg.GetHeartbeat() == nil {
			t.Fatalf("expected heartbeat while action ran, got %v", msg)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("heartbeat starved by action")
	}
	cancel()
	stream.close()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("serveConnection returned %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("cancellation did not stop connection")
	}
}

func waitForResult(t *testing.T, sent <-chan *pb.DeviceMessage) *pb.CommandResult {
	t.Helper()
	deadline := time.After(time.Second)
	for {
		select {
		case msg := <-sent:
			if result := msg.GetResult(); result != nil {
				return result
			}
		case <-deadline:
			t.Fatal("timed out waiting for result")
		}
	}
}
