"""Schema coverage for the widened device surface: GUI steps and proposals."""

from __future__ import annotations

import pytest

from axel import tools


def test_gui_steps_require_a_control() -> None:
    for step in tools.DEVICE_GUI_STEPS:
        with pytest.raises(ValueError, match="control is required"):
            tools.DeviceRunAction(device_id="laptop-7", action=step, parameters={})


def test_setting_a_control_value_requires_a_value() -> None:
    with pytest.raises(ValueError, match="value is required"):
        tools.DeviceRunAction(
            device_id="laptop-7",
            action="gui_set_control_value",
            parameters={"control": "Proxy server"},
        )
    # An empty string is a value: clearing a field is a legitimate fix.
    action = tools.DeviceRunAction(
        device_id="laptop-7",
        action="gui_set_control_value",
        parameters={"control": "Proxy server", "value": ""},
    )
    assert action.parameters["value"] == ""


def test_the_screen_facet_is_selectable_and_takes_a_window() -> None:
    state = tools.DeviceReadState(
        device_id="laptop-7", facets=["screen"], window="Settings"
    )
    assert state.window == "Settings"
    # The window is optional; omitted means the foreground window.
    assert tools.DeviceReadState(device_id="laptop-7", facets=["screen"]).window is None


def test_the_model_cannot_select_the_approved_command_action() -> None:
    """run_command is dispatched by the API from an approved proposal.

    Axel proposing it directly would be the whole gate bypassed, so it is absent
    from the action literal rather than merely discouraged.
    """
    with pytest.raises(ValueError):
        tools.DeviceRunAction(
            device_id="laptop-7", action="run_command", parameters={"command": "[]"}
        )


def test_a_proposal_is_an_argument_vector_with_a_usable_reason() -> None:
    proposal = tools.DeviceProposeCommand(
        device_id="laptop-7",
        command=["ipconfig", "/flushdns"],
        reason="The resolver cache is stale and no typed action covers this adapter.",
    )
    assert proposal.command == ["ipconfig", "/flushdns"]
    # A command line is not an argument vector, but it is one long argument, so
    # what rejects it is the control-character and length bounds rather than a
    # shape check. Assert the bounds that do the work.
    with pytest.raises(ValueError):
        tools.DeviceProposeCommand(
            device_id="laptop-7",
            command=["ipconfig", "/flushdns\nwhoami"],
            reason="Trying to smuggle a second command past the approver.",
        )
    with pytest.raises(ValueError):
        tools.DeviceProposeCommand(
            device_id="laptop-7", command=[], reason="x" * 25
        )
    with pytest.raises(ValueError):
        tools.DeviceProposeCommand(
            device_id="laptop-7", command=["ipconfig"], reason="fix it"
        )


def test_proposing_is_registered_and_names_no_verifier() -> None:
    propose = tools.resolve("device_propose_command")
    assert propose is not None
    assert propose.effect is tools.Effect.WRITE
    # It changes nothing on the device, so there is nothing for a read to
    # confirm. Every other device write names device_read_state.
    assert propose.verified_by is None
    run_action = tools.resolve("device_run_action")
    assert run_action is not None and run_action.verified_by == "device_read_state"
