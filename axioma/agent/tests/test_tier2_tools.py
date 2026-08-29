from __future__ import annotations

import pytest

from axel import tools


def test_ticket_read_messages_is_strict_public_read_tool() -> None:
    tool = tools.resolve("ticket_read_messages")
    assert tool is not None
    assert tool.effect is tools.Effect.READ
    assert tool.schema_model.model_validate({"ticket_id": "T-1"}).ticket_id == "T-1"
    with pytest.raises(ValueError):
        tool.schema_model.model_validate({"ticket_id": "", "extra": True})
