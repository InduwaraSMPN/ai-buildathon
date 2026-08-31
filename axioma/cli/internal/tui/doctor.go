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
	theme  theme
	ctx    context.Context
	checks []Check
	states []checkState
	next   int
}

// NewDoctor builds the doctor view over a set of checks.
func NewDoctor(ctx context.Context, checks []Check) tea.Model {
	states := make([]checkState, len(checks))
	for i, c := range checks {
		states[i] = checkState{name: c.Name}
	}
	return doctorModel{theme: newTheme(), ctx: ctx, checks: checks, states: states}
}

func (m doctorModel) Init() tea.Cmd {
	return tea.Batch(tea.RequestBackgroundColor, m.runNext())
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
		ctx, cancel := context.WithTimeout(m.ctx, 10*time.Second)
		defer cancel()
		detail, err := check.Run(ctx)
		if err != nil {
			return checkResult{index: index, ok: false, detail: err.Error()}
		}
		return checkResult{index: index, ok: true, detail: detail}
	}
}

func (m doctorModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	m.theme = m.theme.withBackground(msg)
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
	// One row per check: status, name, detail. The table keeps the status
	// labels the same width and alignment however long the names get.
	rows := make([][]string, len(m.states))
	for i, s := range m.states {
		status := "..."
		if s.done {
			status = "fail"
			if s.ok {
				status = "ok"
			}
		}
		rows[i] = []string{status, s.name, s.detail}
	}
	t := newTable().StyleFunc(func(row, col int) lipgloss.Style {
		style := lipgloss.NewStyle()
		switch col {
		case 0:
			switch {
			case !m.states[row].done:
				style = m.theme.pending()
			case m.states[row].ok:
				style = m.theme.pass()
			default:
				style = m.theme.fail()
			}
		case 2:
			style = m.theme.pending()
		}
		if col < 2 {
			style = style.PaddingRight(2)
		}
		return style.PaddingLeft(2)
	}).
		Rows(rows...)

	return tea.NewView(m.theme.title().Render("axel-cli doctor") + "\n\n" + t.Render() + "\n")
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
