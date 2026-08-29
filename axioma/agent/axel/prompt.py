"""Human-readable prompt construction from a complete run request."""

from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You are Axel, an IT support agent.

Given a ticket, gather evidence with read tools before acting. Act only when the
evidence identifies a specific cause and a specific fix. After any write, verify
with the read tool named by that write — a write returning success means the call
was accepted, not that the problem is fixed.

Prefer a typed action over driving a GUI. Computer-use is slow, non-deterministic,
and leaves you less able to say what changed; reach for it only after establishing
there is no API, CLI, or configuration path.

Escalate rather than act when the fix is a policy decision rather than a
correction. Changing a resource request, adding capacity, or anything whose right
answer depends on intent you do not have is a policy decision. Escalating with a
clear diagnosis is a good outcome, not a failure.

The transcript is read by IT staff and by the employee. Write reasoning for a
person: concise, specific, and grounded in observed evidence.

Select tools by name and supply typed parameters. You cannot compose commands."""


def build_user_prompt(
    *,
    title: str,
    body: str,
    device_id: str | None,
    context_json: str = "",
    record_type: str = "incident",
    impact: str = "medium",
    urgency: str = "medium",
    priority: str = "P3",
) -> str:
    """Render trusted ticket fields and explicitly-labelled prior platform beliefs."""
    context = _context(context_json)
    record_objective = (
        "restore service fast" if record_type == "incident" else "fulfil a pre-defined low-risk ask"
    )
    lines = [
        "# Ticket",
        f"Title: {title}",
        "Body:",
        body,
        "",
        "# Classification",
        f"Record type: {record_type} — objective: {record_objective}.",
        f"Impact: {impact}; urgency: {urgency}; derived priority: {priority}.",
        "These fields guide depth and speed; they never permit skipping verification.",
        f"Device ID: {device_id}" if device_id else "Device ID: none provided; do not invent one.",
        "",
        "# What the platform already believes (prior observations, not established fact)",
    ]
    observations = (
        context.get("observations", context.get("cmdb", []))
        if isinstance(context, dict)
        else context
    )
    if isinstance(observations, dict):
        observations = [observations]
    if not isinstance(observations, list) or not observations:
        lines.append("- No prior observations.")
    else:
        for item in observations[:20]:
            if isinstance(item, dict):
                observed_at = item.get("observed_at") or item.get("observedAt") or "time unknown"
                detail = item.get("observation") or item.get("summary") or item.get("name") or item
                lines.append(f"- [{observed_at}] {_compact(detail)}")
            else:
                lines.append(f"- [time unknown] {_compact(item)}")
    return "\n".join(lines)


def _context(raw: str) -> Any:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {"observations": [raw]}
    return value if isinstance(value, (dict, list)) else {"observations": [value]}


def _compact(value: object) -> str:
    text = (
        value if isinstance(value, str) else json.dumps(value, default=str, separators=(",", ":"))
    )
    return " ".join(str(text).split())[:500]
