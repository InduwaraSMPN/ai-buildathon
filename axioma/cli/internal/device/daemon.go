package device

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"log"
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
	sendTimeout           = 30 * time.Second
	stablePeriod          = 30 * time.Second
	baseBackoff           = time.Second
	maxBackoff            = 30 * time.Second
	maxAuthBackoff        = 15 * time.Minute
	defaultCommandTimeout = 30 * time.Second
	maxCommandTimeout     = 5 * time.Minute
	maxPendingCommands    = 100
	outboundBuffer        = 32
	inventoryRetryDelay   = 5 * time.Minute
	credentialWriteTries  = 5
	credentialWriteDelay  = 100 * time.Millisecond
)

type daemonTimings struct {
	heartbeat time.Duration
	inventory time.Duration
	liveness  time.Duration
	send      time.Duration
	stable    time.Duration
}

var productionTimings = daemonTimings{
	heartbeat: heartbeatInterval,
	inventory: inventoryInterval,
	liveness:  livenessTimeout,
	send:      sendTimeout,
	stable:    stablePeriod,
}

var (
	saveDaemonState = SaveDaemonState
	loadDaemonState = LoadDaemonState
	saveCredentials = SaveCredentials
)

type deviceStream interface {
	Send(*pb.DeviceMessage) error
	Recv() (*pb.GatewayMessage, error)
}

type terminalError struct{ error }

// RunDaemon holds the outbound device stream until ctx is cancelled. Connection
// failures are retried; local errors that would make execution unsafe are
// returned. Context cancellation is a clean shutdown and returns nil.
func RunDaemon(ctx context.Context, config Config, version string) error {
	// A daemon with no gateway used to dial localhost and report itself
	// healthy forever. There is nothing for it to do without one, and the
	// installer is what writes the file, so say which file is missing.
	if config.GRPCHost == "" {
		path, pathErr := ConfigPath()
		if pathErr != nil {
			return fmt.Errorf("no gateway is configured: %w", pathErr)
		}
		return fmt.Errorf("no gateway is configured; %s is missing or has no grpcHost", path)
	}
	id, err := Load(version)
	if err != nil {
		return err
	}
	backoff := baseBackoff
	authRefusals := 0
	for {
		if ctx.Err() != nil {
			return nil
		}
		started := time.Now()
		err = connect(ctx, config, &id, productionTimings)
		recordDaemonState(disconnectedState(config.GRPCHost, id.LastSeenSequence, err))
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
		delay := backoff
		// A transport-level refusal is not proof that this device is unwanted.
		// The gateway wraps its enrolment transaction in a catch that reports
		// any failure as UNAUTHENTICATED, so a database failover refuses every
		// device that happens to reconnect during it. Backing off for a long
		// time costs one device a slow recovery; exiting costs the fleet every
		// device until its user logs on again.
		if isAuthRefusal(err) {
			authRefusals++
			delay = authBackoff(authRefusals)
			log.Printf("axel-cli: gateway refused authentication (%d in a row); retrying in %s", authRefusals, delay)
		} else {
			authRefusals = 0
		}
		delay += time.Duration(rand.Int64N(int64(delay/2) + 1))
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

// authBackoff spaces out reconnection after consecutive authentication
// refusals. A credential that really is dead must not make the agent spin, and
// a fleet waiting out a gateway outage must not stampede when it returns.
func authBackoff(refusals int) time.Duration {
	delay := maxBackoff
	for range refusals - 1 {
		delay *= 2
		if delay >= maxAuthBackoff {
			return maxAuthBackoff
		}
	}
	return delay
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
	return fmt.Errorf("%s: %w", operation, err)
}

// isAuthRefusal reports a transport-level authentication rejection. It is
// deliberately not terminal: the gateway sends the same code when it cannot
// check a credential as when it refuses one, so the only refusals the device
// trusts as final are the in-band enrolment signals.
func isAuthRefusal(err error) bool {
	code := status.Code(err)
	return code == codes.Unauthenticated || code == codes.PermissionDenied
}

// disconnectedState builds the snapshot written between connections. The
// fields that outlive a single connection are read back off disk first: a
// fresh struct here wiped the claim code on the very first reconnect, and the
// employee has no other way to see it, so the machine stayed unowned and
// invisible to every owner-scoped read with nothing left to claim it with. The
// inventory clock is carried for the same reason it is persisted at all.
func disconnectedState(host string, sequence uint64, err error) DaemonState {
	state := DaemonState{GRPCHost: host, LastSeenSequence: sequence, LastError: errorString(err)}
	if stored, storedErr := loadDaemonState(); storedErr == nil {
		state.ClaimCode = stored.ClaimCode
		state.LastInventoryAt = stored.LastInventoryAt
	}
	return state
}

// recordDaemonState writes the snapshot `status` reads. It is cosmetic, and on
// Windows the write fails routinely — writeJSON ends in os.Rename, which a
// real-time scanner holding the destination open turns into a sharing
// violation — so the failure is reported and the agent carries on.
func recordDaemonState(state DaemonState) {
	if err := saveDaemonState(state); err != nil {
		log.Printf("axel-cli: save daemon state: %v", err)
	}
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
	if timings.send <= 0 {
		timings.send = sendTimeout
	}
	state := DaemonState{Connected: true, GRPCHost: host, LastSeenSequence: id.LastSeenSequence}
	stored, storedErr := loadDaemonState()
	if storedErr == nil {
		state.LastInventoryAt = stored.LastInventoryAt
		// The claim code belongs to the device, not to one connection. Rebuilding
		// it away on every connect left `status` with nothing to show from the
		// second connection onwards, which is the only place the employee reads
		// it.
		state.ClaimCode = stored.ClaimCode
	}

	// grpc permits one sender and one receiver, and SendMsg parks until the
	// stream context is cancelled once the flow-control window fills — a
	// gateway that accepts the stream and stops draining it is enough, and one
	// inventory report is half that window. Sending from the loop that owns the
	// liveness watchdog would leave nothing able to notice, so the sender lives
	// on its own goroutine and a send that overruns cancels the connection
	// rather than wedging the process until the next logon.
	outbound := make(chan *pb.DeviceMessage, outboundBuffer)
	sendErr := make(chan error, 1)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case message := <-outbound:
				stalled := time.AfterFunc(timings.send, func() {
					reportSendFailure(sendErr, fmt.Errorf("send device message: gateway stopped reading for %s", timings.send))
					cancel()
				})
				err := stream.Send(message)
				stalled.Stop()
				if err != nil {
					reportSendFailure(sendErr, authError("send device message", err))
					return
				}
			}
		}
	}()
	send := func(message *pb.DeviceMessage) bool {
		select {
		case outbound <- message:
			return true
		case <-ctx.Done():
			return false
		}
	}

	send(&pb.DeviceMessage{Payload: &pb.DeviceMessage_Hello{Hello: &pb.DeviceHello{
		DeviceId: id.DeviceID, Hostname: id.Hostname, Username: id.Username,
		Platform: id.Platform, Release: id.Release, AgentVersion: id.AgentVersion,
		LastSeenSequence: id.LastSeenSequence, EnrolmentToken: id.EnrolmentToken, Credential: id.Credential,
	}}})
	recordDaemonState(state)

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
	inventoryRetry := make(chan struct{}, 1)
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
				if err == nil {
					var reportID string
					if reportID, err = newID(); err == nil {
						select {
						case inventoryReports <- &pb.InventoryReport{ReportId: reportID, CollectedUnixMs: collectedAt.UnixMilli(), InventoryJson: string(payload)}:
						case <-ctx.Done():
							return
						}
						continue
					}
				}
				// The pending flag was already cleared to take this job, so
				// without re-arming nothing would report inventory again for
				// the life of the connection and nothing would say why.
				log.Printf("axel-cli: collect inventory: %v; retrying in %s", err, inventoryRetryDelay)
				time.AfterFunc(inventoryRetryDelay, func() {
					select {
					case inventoryRetry <- struct{}{}:
					default:
					}
				})
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
	accepted := id.LastSeenSequence
	// The inventory schedule belongs to the clock rather than to the
	// connection. Collecting on every connect turns a gateway that accepts the
	// stream and goes silent — one reconnect a minute — into three PowerShell
	// sweeps a minute on every device in the fleet.
	inventoryPending := storedErr != nil || time.Since(state.LastInventoryAt) >= timings.inventory
	for {
		var jobOut chan *pb.DeviceCommand
		var next *pb.DeviceCommand
		if len(pending) > 0 {
			// Persistence is the at-most-once boundary, and it belongs to the
			// moment a command is dequeued rather than the moment it is
			// accepted: the gateway replays only past the sequence the device
			// reported, so anything still queued when the stream drops has to
			// remain replayable.
			if pending[0].Sequence > id.LastSeenSequence {
				if err := saveSequence(*id, pending[0].Sequence); err != nil {
					return terminalError{fmt.Errorf("persist sequence %d: %w", pending[0].Sequence, err)}
				}
				id.LastSeenSequence = pending[0].Sequence
				state.LastSeenSequence = id.LastSeenSequence
				recordDaemonState(state)
			}
			jobOut, next = jobs, pending[0]
		}
		var inventoryOut chan struct{}
		if inventoryPending {
			inventoryOut = inventoryJobs
		}
		var message *pb.DeviceMessage
		select {
		case <-ctx.Done():
			select {
			case err := <-sendErr:
				return err
			default:
			}
			return ctx.Err()
		case err := <-sendErr:
			return err
		case err := <-recvErr:
			return authError("receive gateway message", err)
		case <-liveness.C:
			return fmt.Errorf("gateway silent for %s", timings.liveness)
		case <-heartbeats.C:
			message = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Heartbeat{Heartbeat: &pb.Heartbeat{UnixMs: time.Now().UnixMilli()}}}
		case <-inventories.C:
			inventoryPending = true
			continue
		case <-inventoryRetry:
			inventoryPending = true
			continue
		case inventoryOut <- struct{}{}:
			inventoryPending = false
			continue
		case report := <-inventoryReports:
			state.LastInventoryAt = time.UnixMilli(report.CollectedUnixMs)
			recordDaemonState(state)
			message = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Inventory{Inventory: report}}
		case jobOut <- next:
			pending = pending[1:]
			continue
		case result := <-results:
			message = &pb.DeviceMessage{Payload: &pb.DeviceMessage_Result{Result: result}}
		case msg := <-incoming:
			resetTimer(liveness, timings.liveness)
			if enrollment := msg.GetEnrollment(); enrollment != nil {
				if enrollment.Credential != "" {
					// The gateway consumes the single-use token before this
					// write, and the token is only cleared by the same atomic
					// write that stores the credential, so a transient failure
					// here must be retried rather than left as a device that
					// can never enrol again.
					if err := storeCredential(*id, enrollment.Credential); err != nil {
						return terminalError{fmt.Errorf("persist device credential: %w", err)}
					}
					id.EnrolmentToken, id.Credential = "", enrollment.Credential
				} else if enrollment.CodeExpired {
					return terminalError{fmt.Errorf("enrolment token was refused or expired; run axel-cli enroll again")}
				} else if !enrollment.AuthValid && id.Credential != "" {
					return terminalError{fmt.Errorf("device credential was refused; re-enrolment is required")}
				}
				// Enrolment binds this machine to the gateway; it does not say
				// whose machine it is. The employee types this code into the
				// portal to claim it, and `axel-cli status` is where they read
				// it, so it is persisted with the rest of the snapshot. The
				// gateway re-issues one on any connection where the device is
				// still unowned, so a code can arrive without a credential and
				// must be stored then too; once someone has claimed the machine
				// there is nothing left to type and the stale code is dropped.
				switch {
				case enrollment.ClaimCode != "" && enrollment.ClaimCode != state.ClaimCode:
					state.ClaimCode = enrollment.ClaimCode
					recordDaemonState(state)
					log.Printf("axel-cli: claim code %s — enter it in the portal to link this computer to your account.", enrollment.ClaimCode)
				case enrollment.Claimed && state.ClaimCode != "":
					state.ClaimCode = ""
					recordDaemonState(state)
				}
				continue
			}
			command := msg.GetCommand()
			if command == nil {
				continue
			}
			if command.Sequence <= accepted {
				message = duplicateAck(command)
				break
			}
			if len(pending) >= maxPendingCommands {
				message = rejectedCommand(command, "device command queue is full; command was not accepted")
				break
			}
			accepted = command.Sequence
			pending = append(pending, command)
			continue
		}
		send(message)
	}
}

func reportSendFailure(sendErr chan error, err error) {
	select {
	case sendErr <- err:
	default:
	}
}

// storeCredential writes the issued credential, retrying the transient local
// failures that are routine on Windows. The enrolment token it replaces has
// already been spent at the gateway, so giving up on the first sharing
// violation costs an operator a new token and the employee another visit.
func storeCredential(id Identity, credential string) error {
	var err error
	for attempt := range credentialWriteTries {
		if attempt > 0 {
			time.Sleep(credentialWriteDelay << (attempt - 1))
		}
		if err = saveCredentials(id, "", credential); err == nil {
			return nil
		}
	}
	return err
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
