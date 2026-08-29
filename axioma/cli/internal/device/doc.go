// Package device maintains the local device identity and executes allowlisted
// commands received from the gateway.
//
// Command execution and result delivery are at-most-once. The sequence is
// persisted before execution, so a crash during execution loses that command
// rather than repeating it. If execution succeeds but its result is lost, the
// gateway receives only a duplicate acknowledgement on replay and the API may
// time out. Stronger delivery requires durable results and idempotency keys.
package device
