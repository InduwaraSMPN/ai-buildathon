package device

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/axioma/cli/internal/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

const (
	heartbeatInterval     = 20 * time.Second
	livenessTimeout       = 60 * time.Second
	stablePeriod          = 30 * time.Second
	baseBackoff           = time.Second
	maxBackoff            = 30 * time.Second
	defaultCommandTimeout = 30 * time.Second
	maxCommandTimeout     = 5 * time.Minute
)

type daemonTimings struct {
	heartbeat time.Duration
	liveness  time.Duration
	stable    time.Duration
}

var productionTimings = daemonTimings{heartbeatInterval, livenessTimeout, stablePeriod}

type deviceStream interface {
	Send(*pb.DeviceMessage) error
	Recv() (*pb.GatewayMessage, error)
}

type terminalError struct{ error }

// RunDaemon holds the outbound device stream until ctx is cancelled. Connection
// failures are retried; local errors that would make execution unsafe are
// returned. Context cancellation is a clean shutdown and returns nil.
func RunDaemon(ctx context.Context, host, version string) error {
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
		err = connect(ctx, host, &id, productionTimings)
		_ = SaveDaemonState(DaemonState{GRPCHost: host, LastSeenSequence: id.LastSeenSequence, LastError: errorString(err)})
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

func connect(ctx context.Context, host string, id *Identity, timings daemonTimings) error {
	conn, err := grpc.NewClient(host,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
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
		return fmt.Errorf("connect device stream: %w", err)
	}
	return serveConnection(connCtx, cancel, stream, host, id, timings, SaveSequence, execute)
}

func serveConnection(ctx context.Context, cancel context.CancelFunc, stream deviceStream, host string, id *Identity, timings daemonTimings, saveSequence func(Identity, uint64) error, executeCommand func(context.Context, *pb.DeviceCommand) *pb.CommandResult) error {
	defer cancel()
	if err := stream.Send(&pb.DeviceMessage{Payload: &pb.DeviceMessage_Hello{Hello: &pb.DeviceHello{
		DeviceId: id.DeviceID, Hostname: id.Hostname, Username: id.Username,
		Platform: id.Platform, Release: id.Release, AgentVersion: id.AgentVersion,
		LastSeenSequence: id.LastSeenSequence, EnrolmentCode: id.EnrolmentCode,
	}}}); err != nil {
		return fmt.Errorf("send device hello: %w", err)
	}
	_ = SaveDaemonState(DaemonState{Connected: true, GRPCHost: host, LastSeenSequence: id.LastSeenSequence})

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
				result := executeCommand(ctx, command)
				select {
				case results <- result:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	heartbeats := time.NewTicker(timings.heartbeat)
	defer heartbeats.Stop()
	liveness := time.NewTimer(timings.liveness)
	defer liveness.Stop()
	var pending []*pb.DeviceCommand
	for {
		var jobOut chan *pb.DeviceCommand
		var next *pb.DeviceCommand
		if len(pending) > 0 {
			jobOut, next = jobs, pending[0]
		}
		var outbound *pb.DeviceMessage
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-recvErr:
			return fmt.Errorf("receive gateway message: %w", err)
		case <-liveness.C:
			return fmt.Errorf("gateway silent for %s", timings.liveness)
		case <-heartbeats.C:
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Heartbeat{Heartbeat: &pb.Heartbeat{UnixMs: time.Now().UnixMilli()}}}
		case jobOut <- next:
			pending = pending[1:]
			continue
		case result := <-results:
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Result{Result: result}}
		case msg := <-incoming:
			resetTimer(liveness, timings.liveness)
			command := msg.GetCommand()
			if command == nil {
				continue
			}
			if command.Sequence <= id.LastSeenSequence {
				outbound = duplicateAck(command)
				break
			}
			// Persistence is the at-most-once boundary: never execute unless the
			// sequence is durable first.
			if err := saveSequence(*id, command.Sequence); err != nil {
				return terminalError{fmt.Errorf("persist sequence %d: %w", command.Sequence, err)}
			}
			id.LastSeenSequence = command.Sequence
			_ = SaveDaemonState(DaemonState{Connected: true, GRPCHost: host, LastSeenSequence: id.LastSeenSequence})
			pending = append(pending, command)
			continue
		}
		// This loop is the stream's only sender; grpc permits one sender and one receiver.
		if err := stream.Send(outbound); err != nil {
			return fmt.Errorf("send device message: %w", err)
		}
	}
}

func duplicateAck(command *pb.DeviceCommand) *pb.DeviceMessage {
	return &pb.DeviceMessage{Payload: &pb.DeviceMessage_Result{Result: &pb.CommandResult{
		CommandId: command.CommandId, Sequence: command.Sequence,
		Error:      "sequence already accepted; result is unavailable and command was not re-run",
		OutputJson: `{"duplicate":true,"outcome":"indeterminate"}`,
	}}}
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
	case "read_state", "device.read_state":
		var facets []string
		facets, err = splitFacets(command.Parameters["facets"])
		if err == nil {
			output, err = ReadStateWithParams(ctx, facets, command.Parameters)
		}
	case "run_action", "device.run_action":
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
