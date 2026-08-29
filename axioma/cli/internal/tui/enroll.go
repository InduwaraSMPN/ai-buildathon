package tui

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/device"
)

type enrollModel struct {
	identity device.Identity
	host     string
	err      string
	done     bool
}

func NewEnroll(identity device.Identity, defaultHost string) tea.Model {
	return enrollModel{identity: identity, host: defaultHost}
}

func (m enrollModel) Init() tea.Cmd { return nil }

func (m enrollModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyPressMsg)
	if !ok || m.done {
		return m, nil
	}
	switch key.String() {
	case "ctrl+c", "esc":
		return m, tea.Quit
	case "enter":
		m.host = strings.TrimSpace(m.host)
		if m.host == "" {
			m.err = "gateway address is required"
			return m, nil
		}
		if err := device.SaveConfig(device.Config{GRPCHost: m.host}); err != nil {
			m.err = err.Error()
			return m, nil
		}
		if err := device.EnsureEnrolmentCode(&m.identity); err != nil {
			m.err = err.Error()
			return m, nil
		}
		m.done = true
		return m, tea.Quit
	case "backspace":
		if len(m.host) > 0 {
			m.host = m.host[:len(m.host)-1]
		}
	default:
		if key.Text != "" {
			m.host += key.Text
		}
	}
	return m, nil
}

func (m enrollModel) View() tea.View {
	out := titleStyle.Render("axel-cli enroll") + "\n\n"
	if m.done {
		out += fmt.Sprintf("  device   %s\n  gateway  %s\n  code     %s\n\nRedeem this short-lived code in the signed-in portal.\n", m.identity.DeviceID, m.host, m.identity.EnrolmentCode)
	} else {
		out += "  gateway  " + m.host + "\n\nPress Enter to create an enrolment code; Esc cancels.\n"
	}
	if m.err != "" {
		out += "\n" + failStyle.Render(m.err) + "\n"
	}
	return tea.NewView(out)
}
