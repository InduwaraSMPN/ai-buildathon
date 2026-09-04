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
	rows := [][]string{
		{"device", m.identity.DeviceID},
		{"host", m.identity.Hostname},
		{"gateway", m.state.GRPCHost},
		{"daemon", connection},
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
	if m.state.ClaimCode != "" {
		out += "\nEnter the claim code in the portal to link this computer to your account.\n"
	}
	return tea.NewView(out)
}
