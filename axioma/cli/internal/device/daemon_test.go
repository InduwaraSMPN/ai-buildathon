package device

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/axioma/cli/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"
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

// A transport-level auth rejection must be retriable. The gateway answers
// UNAUTHENTICATED both when it refuses a credential and when it cannot check one
// — a database failover does exactly that — and a terminal classification here
// exited every daemon that happened to reconnect during the outage, with no
// restart until the employee next logged on.
func TestAuthRefusalIsRetriable(t *testing.T) {
	for _, code := range []codes.Code{codes.Unauthenticated, codes.PermissionDenied} {
		err := authError("connect", status.Error(code, "refused"))
		var terminal terminalError
		if errors.As(err, &terminal) {
			t.Fatalf("%s was terminal: %v", code, err)
		}
		if !isAuthRefusal(err) {
			t.Fatalf("%s was not recognised as an auth refusal", code)
		}
	}
	if isAuthRefusal(status.Error(codes.Unavailable, "down")) {
		t.Fatal("a network error was classified as an auth refusal")
	}
}

type tlsDeviceServer struct {
	pb.UnimplementedDeviceChannelServer
}

func (tlsDeviceServer) Connect(stream pb.DeviceChannel_ConnectServer) error {
	if _, err := stream.Recv(); err != nil {
		return err
	}
	return stream.Send(&pb.GatewayMessage{Payload: &pb.GatewayMessage_Enrollment{Enrollment: &pb.DeviceEnrollment{AuthValid: true}}})
}

func TestConfiguredCAAndHostnameVerification(t *testing.T) {
	caPEM, serverCert, serverKey := testCertificate(t, "localhost", true)
	untrustedCA, _, _ := testCertificate(t, "localhost", true)
	caFile := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(caFile, caPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	cert, err := tls.X509KeyPair(serverCert, serverKey)
	if err != nil {
		t.Fatal(err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := grpc.NewServer(grpc.Creds(credentials.NewTLS(&tls.Config{Certificates: []tls.Certificate{cert}})))
	pb.RegisterDeviceChannelServer(server, tlsDeviceServer{})
	go server.Serve(listener)
	defer server.Stop()
	defer listener.Close()

	address := listener.Addr().String()
	id := Identity{DeviceID: "device"}
	if got, err := CheckAuth(context.Background(), Config{GRPCHost: address, CAFile: caFile, TLSServerName: "localhost"}, id); err != nil || got == "" {
		t.Fatalf("matching configured CA/hostname failed: %q, %v", got, err)
	}

	untrustedFile := filepath.Join(t.TempDir(), "untrusted-ca.pem")
	if err := os.WriteFile(untrustedFile, untrustedCA, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := CheckAuth(context.Background(), Config{GRPCHost: address, CAFile: untrustedFile, TLSServerName: "localhost"}, id); err == nil {
		t.Fatal("untrusted CA was accepted")
	}
	if _, err := CheckAuth(context.Background(), Config{GRPCHost: address, CAFile: caFile, TLSServerName: "not-localhost"}, id); err == nil {
		t.Fatal("wrong TLS hostname was accepted")
	}
}

func testCertificate(t *testing.T, name string, ca bool) ([]byte, []byte, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: name}, DNSNames: []string{name}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), BasicConstraintsValid: true, IsCA: ca, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	return certPEM, certPEM, keyPEM
}

func TestTransportCredentialsRejectsInvalidCA(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(path, []byte("not a certificate"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := transportCredentials(Config{CAFile: path}); err == nil {
		t.Fatal("invalid customer CA was accepted")
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

// The daemon-state file is a cosmetic snapshot for `status`, and on Windows the
// rename behind it fails routinely whenever a real-time scanner holds the
// destination open. Treating that as terminal killed the agent — and, with no
// restart policy on the logon task, kept it dead — so the failure is now logged
// and the connection carries on.
func TestServeConnectionSurvivesDaemonStateFailure(t *testing.T) {
	original := saveDaemonState
	defer func() { saveDaemonState = original }()
	var attempts atomic.Int32
	saveDaemonState = func(DaemonState) error {
		attempts.Add(1)
		return errors.New("read only")
	}
	stream := newFakeDeviceStream()
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &Identity{DeviceID: "device"},
			daemonTimings{heartbeat: time.Hour, liveness: time.Hour},
			func(Identity, uint64) error { return nil }, execute)
	}()
	// The hello write is the first thing serveConnection does, and the state
	// write follows it, so seeing the hello means the failing write has happened.
	select {
	case <-stream.sent:
	case <-time.After(5 * time.Second):
		t.Fatal("serveConnection never sent its hello")
	}
	cancel()
	select {
	case err := <-done:
		var terminal terminalError
		if errors.As(err, &terminal) {
			t.Fatalf("a daemon-state write failure was terminal: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serveConnection did not return after cancellation")
	}
	if attempts.Load() == 0 {
		t.Fatal("the daemon state was never written")
	}
}

func TestServeConnectionStoresIssuedCredential(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	id := Identity{DeviceID: "device", EnrolmentToken: "short-lived"}
	if err := SaveCredentials(id, id.EnrolmentToken, ""); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &id,
			daemonTimings{heartbeat: time.Hour, liveness: time.Hour},
			func(Identity, uint64) error { return nil }, execute)
	}()
	hello := (<-stream.sent).GetHello()
	if hello.EnrolmentToken != "short-lived" || hello.Credential != "" {
		t.Fatalf("unexpected hello: %+v", hello)
	}
	stream.recv <- &pb.GatewayMessage{Payload: &pb.GatewayMessage_Enrollment{Enrollment: &pb.DeviceEnrollment{Claimed: true, Credential: "long-lived", AuthValid: true}}}
	deadline := time.Now().Add(time.Second)
	for id.Credential == "" && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	loaded, err := Load("test")
	if err != nil || loaded.EnrolmentToken != "" || loaded.Credential != "long-lived" {
		t.Fatalf("issued credential was not persisted: %#v, %v", loaded, err)
	}
	cancel()
	stream.close()
	<-done
}

func TestServeConnectionTreatsAuthRefusalAsTerminal(t *testing.T) {
	for _, enrollment := range []*pb.DeviceEnrollment{{CodeExpired: true}, {AuthValid: false}} {
		t.Run(fmt.Sprint(enrollment.CodeExpired), func(t *testing.T) {
			t.Setenv("LOCALAPPDATA", t.TempDir())
			stream := newFakeDeviceStream()
			defer stream.close()
			ctx, cancel := context.WithCancel(context.Background())
			id := Identity{DeviceID: "device", Credential: "credential"}
			done := make(chan error, 1)
			go func() {
				done <- serveConnection(ctx, cancel, stream, "test", &id,
					daemonTimings{heartbeat: time.Hour, liveness: time.Hour},
					func(Identity, uint64) error { return nil }, execute)
			}()
			<-stream.sent
			stream.recv <- &pb.GatewayMessage{Payload: &pb.GatewayMessage_Enrollment{Enrollment: enrollment}}
			var terminal terminalError
			if err := <-done; !errors.As(err, &terminal) {
				t.Fatalf("auth refusal was retriable: %v", err)
			}
		})
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
	// The payload alone is not enough: the API persists CommandResult.Status,
	// so a replay that only says "indeterminate" inside OutputJson still lands
	// as a plain failure.
	if duplicate.GetStatus() != commandStatusIndeterminate {
		t.Fatalf("duplicate status = %q, want %q", duplicate.GetStatus(), commandStatusIndeterminate)
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

func TestServeConnectionRejectsCommandsPastPendingCap(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	stream.recv = make(chan *pb.GatewayMessage, maxPendingCommands+2)
	stream.sent = make(chan *pb.DeviceMessage, maxPendingCommands+4)
	defer stream.close()
	ctx, cancel := context.WithCancel(context.Background())
	started := make(chan struct{})
	release := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &Identity{DeviceID: "device"},
			daemonTimings{heartbeat: time.Hour, liveness: time.Hour},
			func(Identity, uint64) error { return nil },
			func(ctx context.Context, command *pb.DeviceCommand) *pb.CommandResult {
				if command.Sequence == 1 {
					close(started)
					select {
					case <-release:
					case <-ctx.Done():
					}
				}
				return &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence, Ok: true}
			})
	}()
	<-stream.sent
	stream.recv <- gatewayCommand(1)
	<-started
	for sequence := uint64(2); sequence <= maxPendingCommands+2; sequence++ {
		stream.recv <- gatewayCommand(sequence)
	}
	result := waitForResult(t, stream.sent)
	if result.Sequence != maxPendingCommands+2 || !strings.Contains(result.Error, "queue is full") {
		t.Fatalf("unexpected rejection: %+v", result)
	}
	cancel()
	close(release)
	stream.close()
	<-done
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
	deadline := time.After(200 * time.Millisecond)
	for {
		select {
		case msg := <-stream.sent:
			if msg.GetHeartbeat() != nil {
				goto heartbeatReceived
			}
		case <-deadline:
			t.Fatal("heartbeat starved by action")
		}
	}

heartbeatReceived:
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

func TestServeConnectionSendsScheduledInventory(t *testing.T) {
	t.Setenv("LOCALAPPDATA", t.TempDir())
	stream := newFakeDeviceStream()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- serveConnection(ctx, cancel, stream, "test", &Identity{DeviceID: "device"},
			daemonTimings{heartbeat: time.Hour, inventory: time.Hour, liveness: time.Hour},
			func(Identity, uint64) error { return nil }, execute,
			func(context.Context) Inventory { return Inventory{Hardware: InventoryResult{OK: true}} })
	}()
	<-stream.sent // hello
	select {
	case msg := <-stream.sent:
		report := msg.GetInventory()
		if report == nil || report.ReportId == "" || report.CollectedUnixMs == 0 || !strings.Contains(report.InventoryJson, `"hardware":{"ok":true`) {
			t.Fatalf("unexpected inventory report: %+v", report)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for inventory")
	}
	cancel()
	stream.close()
	<-done
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
