package device

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"os"
	"time"

	"github.com/axioma/cli/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/status"
)

const (
	heartbeatInterval     = 20 * time.Second
	inventoryInterval     = 24 * time.Hour
	livenessTimeout       = 60 * time.Second
	stablePeriod          = 30 * time.Second
	baseBackoff           = time.Second
	maxBackoff            = 30 * time.Second
	defaultCommandTimeout = 30 * time.Second
	maxCommandTimeout     = 5 * time.Minute
	maxPendingCommands    = 100
)

type daemonTimings struct {
	heartbeat time.Duration
	inventory time.Duration
	liveness  time.Duration
	stable    time.Duration
}

var productionTimings = daemonTimings{
	heartbeat: heartbeatInterval,
	inventory: inventoryInterval,
	liveness:  livenessTimeout,
	stable:    stablePeriod,
}

var saveDaemonState = SaveDaemonState

type deviceStream interface {
	Send(*pb.DeviceMessage) error
	Recv() (*pb.GatewayMessage, error)
}

type terminalError struct{ error }

// RunDaemon holds the outbound device stream until ctx is cancelled. Connection
// failures are retried; local errors that would make execution unsafe are
// returned. Context cancellation is a clean shutdown and returns nil.
func RunDaemon(ctx context.Context, config Config, version string) error {
	id, err := Load(version)
	if err != nil {
		return err
	}
	backoff := baseBackoff
	for {
		if ctx.Err() != nil {
			return nil
		}
		started := time.Now()
		err = connect(ctx, config, &id, productionTimings)
		if stateErr := saveDaemonState(DaemonState{GRPCHost: config.GRPCHost, LastSeenSequence: id.LastSeenSequence, LastError: errorString(err)}); stateErr != nil {
			return fmt.Errorf("save daemon state: %w", stateErr)
		}
		if ctx.Err() != nil {
			return nil
		}
		var terminal terminalError
		if errors.As(err, &terminal) {
			return terminal.error
		}
		connectedFor := time.Since(started)
		if connectedFor >= productionTimings.stable {
			backoff = baseBackoff
		}
		delay := backoff + time.Duration(rand.Int64N(int64(backoff/2)+1))
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return nil
		case <-timer.C:
		}
		backoff = nextBackoff(backoff, connectedFor, productionTimings.stable)
	}
}

func nextBackoff(current, connectedFor, stable time.Duration) time.Duration {
	if connectedFor >= stable {
		return baseBackoff
	}
	current *= 2
	if current > maxBackoff {
		return maxBackoff
	}
	return current
}

func connect(ctx context.Context, config Config, id *Identity, timings daemonTimings) error {
	transport, err := transportCredentials(config)
	if err != nil {
		return terminalError{err}
	}
	conn, err := grpc.NewClient(config.GRPCHost,
		grpc.WithTransportCredentials(transport),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                timings.heartbeat,
			Timeout:             timings.liveness,
			PermitWithoutStream: true,
		}),
	)
	if err != nil {
		return fmt.Errorf("create grpc client: %w", err)
	}
	defer conn.Close()
	connCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	stream, err := pb.NewDeviceChannelClient(conn).Connect(connCtx)
	if err != nil {
		return authError("connect device stream", err)
	}
	return serveConnection(connCtx, cancel, stream, config.GRPCHost, id, timings, SaveSequence, execute, CollectInventory)
}

// CheckAuth opens the real TLS channel and verifies that the gateway accepts the
// currently persisted identity. It does not consume a new credential.
func CheckAuth(ctx context.Context, config Config, id Identity) (string, error) {
	transport, err := transportCredentials(config)
	if err != nil {
		return "", err
	}
	conn, err := grpc.NewClient(config.GRPCHost, grpc.WithTransportCredentials(transport))
	if err != nil {
		return "", fmt.Errorf("create grpc client: %w", err)
	}
	defer conn.Close()
	stream, err := pb.NewDeviceChannelClient(conn).Connect(ctx)
	if err != nil {
		return "", authError("connect device stream", err)
	}
	if err := stream.Send(&pb.DeviceMessage{Payload: &pb.DeviceMessage_Hello{Hello: &pb.DeviceHello{
		DeviceId: id.DeviceID, Hostname: id.Hostname, Username: id.Username, Platform: id.Platform,
		Release: id.Release, AgentVersion: id.AgentVersion, LastSeenSequence: id.LastSeenSequence,
		Credential: id.Credential,
	}}}); err != nil {
		return "", authError("send device hello", err)
	}
	msg, err := stream.Recv()
	if err != nil {
		return "", authError("receive gateway authentication", err)
	}
	if enrollment := msg.GetEnrollment(); enrollment != nil && !enrollment.AuthValid {
		return "", fmt.Errorf("gateway rejected device credential")
	}
	return "TLS verified; credential accepted", nil
}

func transportCredentials(config Config) (credentials.TransportCredentials, error) {
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: config.TLSServerName}
	if config.CAFile != "" {
		pem, err := os.ReadFile(config.CAFile)
		if err != nil {
			return nil, fmt.Errorf("read customer CA: %w", err)
		}
		roots, err := x509.SystemCertPool()
		if err != nil || roots == nil {
			roots = x509.NewCertPool()
		}
		if !roots.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("customer CA contains no certificates")
		}
		tlsConfig.RootCAs = roots
	}
	return credentials.NewTLS(tlsConfig), nil
}

func authError(operation string, err error) error {
	if code := status.Code(err); code == codes.Unauthenticated || code == codes.PermissionDenied {
		return terminalError{fmt.Errorf("%s: authentication refused: %w", operation, err)}
	}
	return fmt.Errorf("%s: %w", operation, err)
}

func serveConnection(ctx context.Context, cancel context.CancelFunc, stream deviceStream, host string, id *Identity, timings daemonTimings, saveSequence func(Identity, uint64) error, executeCommand func(context.Context, *pb.DeviceCommand) *pb.CommandResult, collectors ...func(context.Context) Inventory) error {
	defer cancel()
	collectInventory := func(context.Context) Inventory { return Inventory{} }
	if len(collectors) > 0 {
		collectInventory = collectors[0]
	}
	if timings.inventory <= 0 {
		timings.inventory = inventoryInterval
	}
	if err := stream.Send(&pb.DeviceMessage{Payload: &pb.DeviceMessage_Hello{Hello: &pb.DeviceHello{
		DeviceId: id.DeviceID, Hostname: id.Hostname, Username: id.Username,
		Platform: id.Platform, Release: id.Release, AgentVersion: id.AgentVersion,
		LastSeenSequence: id.LastSeenSequence, EnrolmentToken: id.EnrolmentToken, Credential: id.Credential,
	}}}); err != nil {
		return authError("send device hello", err)
	}
	if err := saveDaemonState(DaemonState{Connected: true, GRPCHost: host, LastSeenSequence: id.LastSeenSequence}); err != nil {
		return terminalError{fmt.Errorf("save daemon state: %w", err)}
	}

	incoming := make(chan *pb.GatewayMessage)
	recvErr := make(chan error, 1)
	go func() {
		for {
			msg, err := stream.Recv()
			if err != nil {
				select {
				case recvErr <- err:
				case <-ctx.Done():
				}
				return
			}
			select {
			case incoming <- msg:
			case <-ctx.Done():
				return
			}
		}
	}()

	jobs := make(chan *pb.DeviceCommand)
	results := make(chan *pb.CommandResult)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case command := <-jobs:
				commandCtx, cancel := context.WithTimeout(ctx, commandTimeout(command.TimeoutSeconds))
				result := executeCommand(commandCtx, command)
				cancel()
				select {
				case results <- result:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	inventoryJobs := make(chan struct{})
	inventoryReports := make(chan *pb.InventoryReport)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-inventoryJobs:
				collectedAt := time.Now()
				inventoryCtx, cancel := context.WithTimeout(ctx, inventoryTimeout)
				inventory := collectInventory(inventoryCtx)
				cancel()
				payload, err := json.Marshal(inventory)
				if err != nil {
					continue
				}
				reportID, err := newID()
				if err != nil {
					continue
				}
				select {
				case inventoryReports <- &pb.InventoryReport{ReportId: reportID, CollectedUnixMs: collectedAt.UnixMilli(), InventoryJson: string(payload)}:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	heartbeats := time.NewTicker(timings.heartbeat)
	defer heartbeats.Stop()
	inventories := time.NewTicker(timings.inventory)
	defer inventories.Stop()
	liveness := time.NewTimer(timings.liveness)
	defer liveness.Stop()
	var pending []*pb.DeviceCommand
	inventoryPending := true
	for {
		var jobOut chan *pb.DeviceCommand
		var next *pb.DeviceCommand
		if len(pending) > 0 {
			jobOut, next = jobs, pending[0]
		}
		var inventoryOut chan struct{}
		if inventoryPending {
			inventoryOut = inventoryJobs
		}
		var outbound *pb.DeviceMessage
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-recvErr:
			return authError("receive gateway message", err)
		case <-liveness.C:
			return fmt.Errorf("gateway silent for %s", timings.liveness)
		case <-heartbeats.C:
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Heartbeat{Heartbeat: &pb.Heartbeat{UnixMs: time.Now().UnixMilli()}}}
		case <-inventories.C:
			inventoryPending = true
			continue
		case inventoryOut <- struct{}{}:
			inventoryPending = false
			continue
		case report := <-inventoryReports:
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Inventory{Inventory: report}}
		case jobOut <- next:
			pending = pending[1:]
			continue
		case result := <-results:
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Result{Result: result}}
		case msg := <-incoming:
			resetTimer(liveness, timings.liveness)
			if enrollment := msg.GetEnrollment(); enrollment != nil {
				if enrollment.Credential != "" {
					if err := SaveCredentials(*id, "", enrollment.Credential); err != nil {
						return terminalError{fmt.Errorf("persist device credential: %w", err)}
					}
					id.EnrolmentToken, id.Credential = "", enrollment.Credential
				} else if enrollment.CodeExpired {
					return terminalError{fmt.Errorf("enrolment token was refused or expired; run axel-cli enroll again")}
				} else if !enrollment.AuthValid && id.Credential != "" {
					return terminalError{fmt.Errorf("device credential was refused; re-enrolment is required")}
				}
				continue
			}
			command := msg.GetCommand()
			if command == nil {
				continue
			}
			if command.Sequence <= id.LastSeenSequence {
				outbound = duplicateAck(command)
				break
			}
			if len(pending) >= maxPendingCommands {
				outbound = rejectedCommand(command, "device command queue is full; command was not accepted")
				break
			}
			// Persistence is the at-most-once boundary: never execute unless the
			// sequence is durable first.
			if err := saveSequence(*id, command.Sequence); err != nil {
				return terminalError{fmt.Errorf("persist sequence %d: %w", command.Sequence, err)}
			}
			id.LastSeenSequence = command.Sequence
			if err := saveDaemonState(DaemonState{Connected: true, GRPCHost: host, LastSeenSequence: id.LastSeenSequence}); err != nil {
				return terminalError{fmt.Errorf("save daemon state: %w", err)}
			}
			pending = append(pending, command)
			continue
		}
		// This loop is the stream's only sender; grpc permits one sender and one receiver.
		if err := stream.Send(outbound); err != nil {
			return fmt.Errorf("send device message: %w", err)
		}
	}
}

// duplicateAck answers a replayed sequence without re-running the command. The
// original result is gone, so the outcome is genuinely indeterminate; the
// explanation travels in the structured payload as well as the error field so
// consumers reading either place see why.
// commandStatusIndeterminate must stay spelled exactly as it is in
// COMMAND_STATUSES in api/src/shared; the API rejects anything else.
const commandStatusIndeterminate = "indeterminate"

func duplicateAck(command *pb.DeviceCommand) *pb.DeviceMessage {
	message := "sequence already accepted; result is unavailable and command was not re-run"
	outbound := rejectedCommand(command, message,
		fmt.Sprintf(`{"duplicate":true,"outcome":%q,"detail":%q}`,
			commandStatusIndeterminate, message))
	// Say it in the field the API reads, not only in the payload: without this
	// a replay persists as a plain failure, which claims the command did not
	// run when nobody knows either way.
	outbound.GetResult().Status = commandStatusIndeterminate
	return outbound
}

func rejectedCommand(command *pb.DeviceCommand, message string, output ...string) *pb.DeviceMessage {
	result := &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence, Error: message}
	if len(output) > 0 {
		result.OutputJson = output[0]
	}
	return &pb.DeviceMessage{Payload: &pb.DeviceMessage_Result{Result: result}}
}

func resetTimer(timer *time.Timer, duration time.Duration) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(duration)
}

func commandTimeout(seconds uint32) time.Duration {
	if seconds == 0 {
		return defaultCommandTimeout
	}
	timeout := time.Duration(seconds) * time.Second
	if timeout > maxCommandTimeout {
		return maxCommandTimeout
	}
	return timeout
}

func execute(parent context.Context, command *pb.DeviceCommand) *pb.CommandResult {
	result := &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence}
	if command.ComputerUse {
		result.Error = "computer-use is not installed; this device supports typed actions only"
		return result
	}
	ctx, cancel := context.WithTimeout(parent, commandTimeout(command.TimeoutSeconds))
	defer cancel()

	var output any
	var err error
	switch command.Action {
	case "read_state", "device_read_state":
		var facets []string
		facets, err = splitFacets(command.Parameters["facets"])
		if err == nil {
			output, err = ReadStateWithParams(ctx, facets, command.Parameters)
		}
	case "run_action", "device_run_action":
		action := command.Parameters["action"]
		params := make(map[string]string, len(command.Parameters))
		for key, value := range command.Parameters {
			if key != "action" && key != "facets" {
				params[key] = value
			}
		}
		output, err = RunAction(ctx, action, params)
	default:
		output, err = RunAction(ctx, command.Action, command.Parameters)
	}
	if err != nil {
		result.Error = err.Error()
		return result
	}
	body, err := json.Marshal(output)
	if err != nil {
		result.Error = "encode result: " + err.Error()
		return result
	}
	result.Ok = actionOK(output)
	result.OutputJson = string(body)
	if !result.Ok {
		if action, ok := output.(Result); ok {
			result.Error = action.Detail
		} else {
			result.Error = "action failed"
		}
	}
	return result
}

func splitFacets(raw string) ([]string, error) {
	var facets []string
	if err := json.Unmarshal([]byte(raw), &facets); err != nil {
		if knownFacets[raw] {
			facets = []string{raw}
		} else {
			return nil, fmt.Errorf("invalid facets: %q", raw)
		}
	}
	if len(facets) == 0 {
		return nil, fmt.Errorf("at least one facet is required")
	}
	for _, facet := range facets {
		if !knownFacets[facet] {
			return nil, fmt.Errorf("unknown facet: %s", facet)
		}
	}
	return facets, nil
}

func actionOK(output any) bool {
	if aggregate, ok := output.(interface{ actionOK() bool }); ok {
		return aggregate.actionOK()
	}
	if aggregate, ok := output.(interface{ ActionOK() bool }); ok {
		return aggregate.ActionOK()
	}
	if result, ok := output.(Result); ok {
		return result.OK
	}
	if facets, ok := output.(map[string]any); ok {
		for _, facet := range facets {
			if result, ok := facet.(FacetResult); ok && result.OK {
				return true
			}
		}
		return false
	}
	return true
}

func errorString(err error) string {
	if err == nil || errors.Is(err, context.Canceled) {
		return ""
	}
	return err.Error()
}
