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
)

const heartbeatInterval = 20 * time.Second

// RunDaemon holds the outbound device stream until ctx is cancelled.
func RunDaemon(ctx context.Context, host, version string) error {
	id, err := Load(version)
	if err != nil {
		return err
	}
	backoff := time.Second
	for ctx.Err() == nil {
		err = connect(ctx, host, &id)
		_ = SaveDaemonState(DaemonState{GRPCHost: host, LastSeenSequence: id.LastSeenSequence, LastError: errorString(err)})
		if ctx.Err() != nil {
			break
		}
		delay := backoff + time.Duration(rand.Int64N(int64(backoff/2)+1))
		select {
		case <-ctx.Done():
			break
		case <-time.After(delay):
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
	return nil
}

func connect(ctx context.Context, host string, id *Identity) error {
	conn, err := grpc.NewClient(host, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("create grpc client: %w", err)
	}
	defer conn.Close()
	stream, err := pb.NewDeviceChannelClient(conn).Connect(ctx)
	if err != nil {
		return fmt.Errorf("connect device stream: %w", err)
	}
	if err := stream.Send(&pb.DeviceMessage{Payload: &pb.DeviceMessage_Hello{Hello: &pb.DeviceHello{
		DeviceId: id.DeviceID, Hostname: id.Hostname, Username: id.Username,
		Platform: id.Platform, Release: id.Release, AgentVersion: id.AgentVersion,
		LastSeenSequence: id.LastSeenSequence,
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
				recvErr <- err
				return
			}
			select {
			case incoming <- msg:
			case <-ctx.Done():
				return
			}
		}
	}()

	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	for {
		var outbound *pb.DeviceMessage
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-recvErr:
			return fmt.Errorf("receive gateway message: %w", err)
		case <-ticker.C:
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Heartbeat{Heartbeat: &pb.Heartbeat{UnixMs: time.Now().UnixMilli()}}}
		case msg := <-incoming:
			command := msg.GetCommand()
			if command == nil {
				continue
			}
			result := &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence}
			if command.Sequence <= id.LastSeenSequence {
				result.Error = fmt.Sprintf("sequence %d already processed", command.Sequence)
			} else {
				result = execute(ctx, command)
			}
			if command.Sequence > id.LastSeenSequence {
				if err := SaveSequence(*id, command.Sequence); err != nil {
					result.Ok = false
					result.Error = "persist sequence: " + err.Error()
				} else {
					id.LastSeenSequence = command.Sequence
					_ = SaveDaemonState(DaemonState{Connected: true, GRPCHost: host, LastSeenSequence: id.LastSeenSequence})
				}
			}
			outbound = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Result{Result: result}}
		}
		// This loop is the stream's only sender; grpc permits one sender and one receiver.
		if err := stream.Send(outbound); err != nil {
			return fmt.Errorf("send device message: %w", err)
		}
	}
}

func execute(parent context.Context, command *pb.DeviceCommand) *pb.CommandResult {
	result := &pb.CommandResult{CommandId: command.CommandId, Sequence: command.Sequence}
	if command.ComputerUse {
		result.Error = "computer-use is not installed; this device supports typed actions only"
		return result
	}
	ctx := parent
	if command.TimeoutSeconds > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(parent, time.Duration(command.TimeoutSeconds)*time.Second)
		defer cancel()
	}

	var output any
	var err error
	switch command.Action {
	case "read_state", "device.read_state":
		output, err = ReadState(ctx, splitFacets(command.Parameters["facets"]))
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
		}
	}
	return result
}

func splitFacets(raw string) []string {
	var facets []string
	if json.Unmarshal([]byte(raw), &facets) == nil {
		return facets
	}
	for _, facet := range []string{"resolver", "adapters", "services", "reachability"} {
		if raw == facet {
			return []string{raw}
		}
	}
	return nil
}

func actionOK(output any) bool {
	if result, ok := output.(Result); ok {
		return result.OK
	}
	return true
}

func errorString(err error) string {
	if err == nil || errors.Is(err, context.Canceled) {
		return ""
	}
	return err.Error()
}
