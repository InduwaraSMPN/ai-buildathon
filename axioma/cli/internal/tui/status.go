package tui

import (
	"fmt"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/device"
)

type statusModel struct {
	theme    theme
	identity device.Identity
	state    device.DaemonState
}

func NewStatus(identity device.Identity, state device.DaemonState) tea.Model {
	return statusModel{theme: newTheme(), identity: identity, state: state}
}

// Init quits immediately: status is a render-once snapshot, not an interactive
// view, so there is no key handling to do.
func (m statusModel) Init() tea.Cmd { return tea.Quit }

func (m statusModel) Update(tea.Msg) (tea.Model, tea.Cmd) { return m, nil }

func (m statusModel) View() tea.View {
	connection := m.theme.fail().Render("disconnected")
	if m.state.Connected {
		connection = m.theme.pass().Render("connected")
	}
	updated := "never"
	if !m.state.UpdatedAt.IsZero() {
		updated = m.state.UpdatedAt.Local().Format("2006-01-02 15:04:05")
	}
	// Two bindings, and they move independently. `daemon` is the machine's link
	// to the gateway, held by enrolment and the device credential. `account` is
	// the employee's claim on it, held by `owner_id` in the portal. Releasing the
	// machine in the portal clears the second and leaves the first untouched, so
	// a status showing only the connection reads as healthy while the device is
	// invisible to the portal, to the intake device picker, and to Axel.
	account := m.theme.fail().Render("not linked")
	if m.state.Claimed {
		account = m.theme.pass().Render("linked")
	}
	rows := [][]string{
		{"device", m.identity.DeviceID},
		{"host", m.identity.Hostname},
		{"gateway", m.state.GRPCHost},
		{"daemon", connection},
		{"account", account},
		{"sequence", fmt.Sprintf("%d", m.identity.LastSeenSequence)},
		{"last update", updated},
	}
	// Shown until the employee claims the machine. The gateway clears the code on
	// a successful claim, and the daemon stops reporting it from then on.
	if m.state.ClaimCode != "" {
		rows = append(rows, []string{"claim code", m.theme.pass().Render(m.state.ClaimCode)})
	}
	if m.state.LastError != "" {
		rows = append(rows, []string{"last error", m.theme.fail().Render(m.state.LastError)})
	}
	t := newTable().StyleFunc(keyValueStyles).Rows(rows...)

	out := m.theme.title().Render("axel-cli status") + "\n\n" + t.Render() + "\n"
	switch {
	case m.state.ClaimCode != "":
		out += "\nEnter the claim code in the portal to link this computer to your account.\n"
	case !m.state.Claimed:
		// No code to type and nobody owns the machine: either it was released in
		// the portal while this stream was up, or the last code expired. The
		// gateway mints a fresh one on any hello from an unowned device, so a
		// reconnect is the whole fix — it is just not automatic, because the
		// daemon holds one long stream.
		out += "\nThis computer is enrolled with the gateway but not linked to an account.\nRestart the axel-cli daemon to get a new claim code, then enter it in the portal.\n"
	}
	return tea.NewView(out)
}
