package tui

import (
	"runtime"

	tea "charm.land/bubbletea/v2"

	"github.com/axioma/cli/internal/device"
)

// forget is injected so the confirmation flow can be tested without writing to
// the real state directory.
type disconnectModel struct {
	theme     theme
	identity  device.Identity
	gatewayAt string
	forget    func(device.Identity) error
	err       string
	done      bool
}

func NewDisconnect(identity device.Identity, gatewayAt string) tea.Model {
	return disconnectModel{
		theme:     newTheme(),
		identity:  identity,
		gatewayAt: gatewayAt,
		forget:    device.Forget,
	}
}

func (m disconnectModel) Init() tea.Cmd { return tea.RequestBackgroundColor }

func (m disconnectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	m.theme = m.theme.withBackground(msg)
	key, ok := msg.(tea.KeyPressMsg)
	if !ok || m.done {
		return m, nil
	}
	switch key.String() {
	case "ctrl+c", "esc", "n", "N":
		return m, tea.Quit
	// Deliberately not Enter. This clears the credential that took an enrolment
	// token to obtain, and Enter is the key someone presses to get past a screen
	// they have not read.
	case "y", "Y":
		if err := m.forget(m.identity); err != nil {
			m.err = err.Error()
			return m, nil
		}
		m.identity.EnrolmentToken, m.identity.Credential = "", ""
		m.done = true
		return m, tea.Quit
	}
	return m, nil
}

func (m disconnectModel) View() tea.View {
	out := m.theme.title().Render("axel-cli disconnect") + "\n\n"
	credential := m.theme.fail().Render("none stored")
	if m.identity.Credential != "" {
		credential = m.theme.pass().Render("stored")
	}
	if m.done {
		out += newTable().StyleFunc(keyValueStyles).Rows(
			[]string{"device", m.identity.DeviceID},
			[]string{"credential", m.theme.fail().Render("cleared")},
		).Render() + "\n\n" +
			m.theme.title().Render("The daemon must be stopped before this takes effect.") + "\n" +
			"A running daemon holds the stream it already opened and reads its identity\n" +
			"only at start-up, so it keeps working until it is stopped.\n"
		if runtime.GOOS == "windows" {
			out += "\n  schtasks.exe /End /TN \"Axiōma Axel Agent\"\n"
		}
		out += "\nRun axel-cli enroll with a fresh token to connect this computer again.\n"
		return tea.NewView(out)
	}

	out += newTable().StyleFunc(keyValueStyles).Rows(
		[]string{"device", m.identity.DeviceID},
		[]string{"host", m.identity.Hostname},
		[]string{"gateway", m.gatewayAt},
		[]string{"credential", credential},
	).Render() + "\n\n" +
		"This clears the credential this computer dials out with. The device id is\n" +
		"kept, so enrolling again reuses the same record rather than making a second\n" +
		"one for this machine.\n\n" +
		"Press y to disconnect; any other key cancels.\n"
	if m.err != "" {
		out += "\n" + m.theme.fail().Render(m.err) + "\n"
	}
	return tea.NewView(out)
}
