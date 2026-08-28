package tui

import (
	"fmt"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/device"
)

type statusModel struct {
	identity device.Identity
	state    device.DaemonState
}

func NewStatus(identity device.Identity, state device.DaemonState) tea.Model {
	return statusModel{identity: identity, state: state}
}

func (m statusModel) Init() tea.Cmd { return tea.Quit }

func (m statusModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if key, ok := msg.(tea.KeyPressMsg); ok {
		if key.String() == "q" || key.String() == "esc" || key.String() == "ctrl+c" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m statusModel) View() tea.View {
	connection := failStyle.Render("disconnected")
	if m.state.Connected {
		connection = passStyle.Render("connected")
	}
	updated := "never"
	if !m.state.UpdatedAt.IsZero() {
		updated = m.state.UpdatedAt.Local().Format("2006-01-02 15:04:05")
	}
	out := fmt.Sprintf("%s\n\n  device       %s\n  host         %s\n  gateway      %s\n  daemon       %s\n  sequence     %d\n  last update  %s\n",
		titleStyle.Render("axel-cli status"), m.identity.DeviceID, m.identity.Hostname,
		m.state.GRPCHost, connection, m.identity.LastSeenSequence, updated)
	if m.state.LastError != "" {
		out += "  last error   " + failStyle.Render(m.state.LastError) + "\n"
	}
	return tea.NewView(out)
}
