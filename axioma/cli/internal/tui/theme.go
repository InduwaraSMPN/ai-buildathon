package tui

import (
	"charm.land/lipgloss/v2"
	"charm.land/lipgloss/v2/table"

	tea "charm.land/bubbletea/v2"
)

// The palette lives here so the CLI has one place a token is decided, mirroring
// the token files the web frontends keep. Status colours come in light/dark
// pairs: light terminals get the brand colours, dark terminals get lightened
// variants of the same hues. Lip Gloss v2 has no AdaptiveColor; a pair is
// resolved with LightDark once the terminal's background is known. Views assume
// a dark terminal — Lip Gloss's own fallback — until Bubble Tea reports the
// real background as tea.BackgroundColorMsg.
var (
	// Brand green #008236; the dark variant keeps the hue and lifts the
	// lightness so it stays readable on dark terminals.
	okLight = lipgloss.Color("#008236")
	okDark  = lipgloss.Color("#00cc66")
	// Destructive red matching the platform's --destructive token: light
	// oklch(0.577 0.245 27.325) ≈ #dc2626, dark oklch(0.704 0.191 22.216) ≈ #f87171.
	errLight = lipgloss.Color("#dc2626")
	errDark  = lipgloss.Color("#f87171")
)

// theme renders the shared styles for one terminal background.
type theme struct {
	dark bool
}

// newTheme assumes a dark background. Asking the terminal directly would block
// on consoles that never answer the colour query, so the real answer is taken
// from tea.BackgroundColorMsg instead: request it from Init and fold it into
// the theme with withBackground.
func newTheme() theme { return theme{dark: true} }

// withBackground folds a Bubble Tea message into the theme.
func (t theme) withBackground(msg tea.Msg) theme {
	if bg, ok := msg.(tea.BackgroundColorMsg); ok {
		t.dark = bg.IsDark()
	}
	return t
}

func (t theme) title() lipgloss.Style { return lipgloss.NewStyle().Bold(true) }

func (t theme) pass() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.LightDark(t.dark)(okLight, okDark))
}

func (t theme) fail() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.LightDark(t.dark)(errLight, errDark))
}

func (t theme) pending() lipgloss.Style { return lipgloss.NewStyle().Faint(true) }

// newTable returns a borderless table: the CLI separates columns with padding,
// not rules.
func newTable() *table.Table {
	return table.New().
		BorderTop(false).
		BorderBottom(false).
		BorderLeft(false).
		BorderRight(false).
		BorderColumn(false).
		BorderRow(false)
}

// keyValueStyles styles the two-column key/value tables: indent and gap on the
// key column, plain values.
func keyValueStyles(_, col int) lipgloss.Style {
	if col == 0 {
		return lipgloss.NewStyle().PaddingLeft(2).PaddingRight(2)
	}
	return lipgloss.NewStyle()
}
