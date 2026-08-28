// Package tui holds the operator-facing terminal interface.
//
// Only the operator commands live here. The daemon runs as a logon Scheduled
// Task with no terminal attached, so nothing in this package is reachable from
// it — that separation is deliberate and worth keeping.
package tui

import (
	"context"
	"fmt"
	"os/exec"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

var (
	titleStyle   = lipgloss.NewStyle().Bold(true)
	passStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("2"))
	failStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("1"))
	pendingStyle = lipgloss.NewStyle().Faint(true)
	detailStyle  = lipgloss.NewStyle().Faint(true)
)

// Check is one thing doctor verifies about this machine.
type Check struct {
	Name string
	Run  func(ctx context.Context) (string, error)
}

type checkState struct {
	name   string
	done   bool
	ok     bool
	detail string
}

type checkResult struct {
	index  int
	ok     bool
	detail string
}

type doctorModel struct {
	checks []Check
	states []checkState
	next   int
}

// NewDoctor builds the doctor view over a set of checks.
func NewDoctor(checks []Check) tea.Model {
	states := make([]checkState, len(checks))
	for i, c := range checks {
		states[i] = checkState{name: c.Name}
	}
	return doctorModel{checks: checks, states: states}
}

func (m doctorModel) Init() tea.Cmd {
	return m.runNext()
}

// Checks run one at a time rather than concurrently. Doctor is diagnostic, and
// a deterministic order is worth more here than finishing a few milliseconds
// sooner — a reader needs to know which check the failure belongs to.
func (m doctorModel) runNext() tea.Cmd {
	if m.next >= len(m.checks) {
		return tea.Quit
	}
	index := m.next
	check := m.checks[index]
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		detail, err := check.Run(ctx)
		if err != nil {
			return checkResult{index: index, ok: false, detail: err.Error()}
		}
		return checkResult{index: index, ok: true, detail: detail}
	}
}

func (m doctorModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		if s := msg.String(); s == "q" || s == "ctrl+c" || s == "esc" {
			return m, tea.Quit
		}
		return m, nil

	case checkResult:
		m.states[msg.index].done = true
		m.states[msg.index].ok = msg.ok
		m.states[msg.index].detail = msg.detail
		m.next = msg.index + 1
		return m, m.runNext()
	}
	return m, nil
}

func (m doctorModel) View() tea.View {
	out := titleStyle.Render("axel-cli doctor") + "\n\n"

	for _, s := range m.states {
		switch {
		case !s.done:
			out += pendingStyle.Render(fmt.Sprintf("  ...  %s", s.name)) + "\n"
		case s.ok:
			out += passStyle.Render("   ok  ") + s.name
			if s.detail != "" {
				out += "  " + detailStyle.Render(s.detail)
			}
			out += "\n"
		default:
			out += failStyle.Render(" fail  ") + s.name + "\n"
			if s.detail != "" {
				out += "        " + detailStyle.Render(s.detail) + "\n"
			}
		}
	}

	return tea.NewView(out)
}

// BinaryPresent checks that a command a device action depends on exists. An
// action whose binary is missing fails at dispatch time on a real ticket, which
// is the worst moment to discover it.
func BinaryPresent(name string) func(context.Context) (string, error) {
	return func(_ context.Context) (string, error) {
		path, err := exec.LookPath(name)
		if err != nil {
			return "", fmt.Errorf("%s not found on PATH", name)
		}
		return path, nil
	}
}
