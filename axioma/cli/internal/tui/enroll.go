package tui

import (
	"strings"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/device"
)

type enrollModel struct {
	theme    theme
	identity device.Identity
	config   device.Config
	token    string
	field    int
	err      string
	done     bool
}

func NewEnroll(identity device.Identity, config device.Config) tea.Model {
	return enrollModel{theme: newTheme(), identity: identity, config: config}
}

func (m enrollModel) Init() tea.Cmd { return tea.RequestBackgroundColor }

func (m enrollModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	m.theme = m.theme.withBackground(msg)
	key, ok := msg.(tea.KeyPressMsg)
	if !ok || m.done {
		return m, nil
	}
	switch key.String() {
	case "ctrl+c", "esc":
		return m, tea.Quit
	case "tab", "shift+tab", "up", "down":
		m.field = 1 - m.field
	case "enter":
		m.config.GRPCHost = strings.TrimSpace(m.config.GRPCHost)
		m.token = strings.TrimSpace(m.token)
		if m.config.GRPCHost == "" {
			m.err = "gateway address is required"
			return m, nil
		}
		if m.token == "" {
			m.err = "enrolment token is required"
			return m, nil
		}
		if err := device.SaveConfig(m.config); err != nil {
			m.err = err.Error()
			return m, nil
		}
		if err := device.SaveCredentials(m.identity, m.token, ""); err != nil {
			m.err = err.Error()
			return m, nil
		}
		m.identity.EnrolmentToken, m.identity.Credential = m.token, ""
		m.done = true
		return m, tea.Quit
	case "backspace":
		if m.field == 0 && len(m.config.GRPCHost) > 0 {
			m.config.GRPCHost = m.config.GRPCHost[:len(m.config.GRPCHost)-1]
		} else if m.field == 1 && len(m.token) > 0 {
			m.token = m.token[:len(m.token)-1]
		}
	default:
		if key.Text != "" {
			if m.field == 0 {
				m.config.GRPCHost += key.Text
			} else {
				m.token += key.Text
			}
		}
	}
	return m, nil
}

func (m enrollModel) View() tea.View {
	out := m.theme.title().Render("axel-cli enroll") + "\n\n"
	if m.done {
		t := newTable().StyleFunc(keyValueStyles).Rows(
			[]string{"device", m.identity.DeviceID},
			[]string{"gateway", m.config.GRPCHost},
			[]string{"token", "stored for one connection"},
		)
		out += t.Render() + "\nStart or restart the daemon to complete enrolment.\n"
	} else {
		// Same table as the completed state, so the fields do not shift when
		// enrolment finishes. The cursor is a column rather than hand-inserted
		// padding, which is what let these two rows drift out of alignment.
		cursor := []string{" ", " "}
		cursor[m.field] = ">"
		t := newTable().StyleFunc(keyValueStyles).Rows(
			[]string{cursor[0] + " gateway", m.config.GRPCHost},
			[]string{cursor[1] + " token", m.token},
		)
		out += t.Render() + "\n\nTab switches fields; Enter stores the token; Esc cancels.\n"
	}
	if m.err != "" {
		out += "\n" + m.theme.fail().Render(m.err) + "\n"
	}
	return tea.NewView(out)
}
