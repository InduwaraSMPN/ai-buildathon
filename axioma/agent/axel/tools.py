"""The tool registry.

Axel selects a tool by name and supplies parameters that are validated against
that tool's schema before anything leaves the process. It does not compose
commands, shell strings, or API calls, so a run is always replayable from the
transcript: tool name plus validated input is the whole story.

Nothing here executes. Every tool is a *request* the agent sends to the API over
the back-channel, and the API owns the side effect. The agent has no database
connection, no cluster credentials, and no path to a device_
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictToolInput(BaseModel):
    """Base for inputs exposed through strict function calling."""

    model_config = ConfigDict(extra="forbid")


class Effect(StrEnum):
    READ = "read"
    WRITE = "write"


class Surface(StrEnum):
    TICKET = "ticket"
    CLUSTER = "cluster"
    DEVICE = "device"
    CMDB = "cmdb"
    KNOWLEDGE = "knowledge"


# --- ticket ------------------------------------------------------------------


class TicketReadMessages(StrictToolInput):
    ticket_id: str = Field(min_length=1)


# --- knowledge ---------------------------------------------------------------


class KnowledgeSearch(StrictToolInput):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=8, ge=1, le=20)


class KnowledgeFetch(StrictToolInput):
    source: Literal["known_error", "article", "resolved_ticket", "agent_run", "document"]
    id: str = Field(min_length=1)


# --- cluster -----------------------------------------------------------------


class ClusterReadPods(StrictToolInput):
    namespace: str = Field(min_length=1)
    label_selector: str | None = None
    # Stable environment key resolved by the server, e.g. "prod" or "staging".
    # Optional: the server defaults the run's resolved environment when omitted,
    # so omitting it can never reach a different cluster than the one the run targets.
    environment: str | None = Field(default=None, min_length=1)


class ClusterReadDeployment(StrictToolInput):
    namespace: str = Field(min_length=1)
    name: str = Field(min_length=1)
    environment: str | None = Field(default=None, min_length=1)


class ClusterPatchImage(StrictToolInput):
    namespace: str = Field(min_length=1)
    name: str = Field(min_length=1)
    container_index: int = Field(ge=0)
    image: str = Field(min_length=1)
    environment: str | None = Field(default=None, min_length=1)


# --- device ------------------------------------------------------------------


# The applications employees actually report as hung or stuck. The device holds the
# same allowlist and rejects anything unlisted, so a parameter only ever selects a
# key here — it never becomes a command.
DEVICE_GUI_STEPS: Final[tuple[str, ...]] = (
    "gui_invoke_control",
    "gui_set_control_value",
    "gui_toggle_control",
    "gui_select_item",
    "gui_expand_control",
)

DEVICE_USER_PROCESSES: Final[tuple[str, ...]] = (
    "notepad",
    "explorer",
    "outlook",
    "teams",
    "onedrive",
    "msedge",
    "chrome",
    "slack",
)


class DeviceReadState(StrictToolInput):
    device_id: str = Field(min_length=1)
    facets: list[
        Literal[
            "resolver",
            "adapters",
            "reachability",
            "proxy",
            "identity",
            "processes",
            "certificates",
            "storage",
            "app_cache",
            "printing",
            "screen",
        ]
    ] = Field(min_length=1)
    target: str | None = Field(default=None, min_length=1, max_length=253)
    window: str | None = Field(default=None, min_length=1, max_length=256)

    @model_validator(mode="after")
    def require_reachability_target(self) -> DeviceReadState:
        if "reachability" in self.facets and not self.target:
            raise ValueError("target is required for the reachability facet")
        return self


class DeviceRunAction(StrictToolInput):
    """Tier one: a named action the device implements. No command string."""

    device_id: str = Field(min_length=1)
    action: Literal[
        "flush_dns",
        "renew_dhcp_lease",
        "clear_proxy_override",
        "reset_credential_cache",
        "restart_user_process",
        "disable_proxy",
        "refresh_certificate_store",
        "clear_temp_files",
        "clear_outlook_cache",
        "clear_teams_cache",
        "clear_icon_cache",
        "clear_print_queue",
        "gui_invoke_control",
        "gui_set_control_value",
        "gui_toggle_control",
        "gui_select_item",
        "gui_expand_control",
    ]
    parameters: dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def require_action_parameters(self) -> DeviceRunAction:
        if self.action in DEVICE_GUI_STEPS and not self.parameters.get("control"):
            raise ValueError("control is required for a GUI step")
        if self.action == "gui_set_control_value" and "value" not in self.parameters:
            raise ValueError("value is required for gui_set_control_value")
        if self.action == "restart_user_process":
            process = (self.parameters.get("process_name") or "").lower()
            if not process:
                raise ValueError("process_name is required for restart_user_process")
            if process not in DEVICE_USER_PROCESSES:
                allowed = ", ".join(DEVICE_USER_PROCESSES)
                raise ValueError(f"process_name must be one of: {allowed}")
        return self


class DeviceComputerUse(StrictToolInput):
    """The pixel fallback, for a surface with no accessibility tree.

    Not the ordinary way to drive a GUI: the gui_ actions on device_run_action
    are, and they are typed and verifiable. Reach here only when the screen facet
    reports no controls for the window in question. Slow, non-deterministic,
    costs vision tokens per step, and currently refused by every device.
    """

    device_id: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    timeout_seconds: int = Field(default=120, ge=10, le=600)


class DeviceProposeCommand(StrictToolInput):
    """Propose a command for a person to authorise. This does not run anything.

    The typed actions cover almost everything; reach here only when no action and
    no GUI step fits, and the fix genuinely needs a command. Write reason for the
    IT staffer who has to decide, not for the transcript: what is wrong, why this
    exact command fixes it, and what it will change. They see the argument vector
    verbatim and approve or refuse it.

    After proposing, escalate with your diagnosis. The run ends; the command runs
    later only if someone approves it.
    """

    device_id: str = Field(min_length=1)
    command: list[str] = Field(min_length=1, max_length=32)
    reason: str = Field(min_length=20, max_length=2000)

    @model_validator(mode="after")
    def require_clean_arguments(self) -> DeviceProposeCommand:
        for part in self.command:
            if not part or len(part) > 1024:
                raise ValueError("each argument must be between 1 and 1024 characters")
            if any(ord(character) < 32 or ord(character) == 127 for character in part):
                raise ValueError("an argument may not contain a control character")
        return self


# --- cmdb --------------------------------------------------------------------


class CmdbRelationship(StrictToolInput):
    type_key: str = Field(min_length=1)
    target_object_id: str = Field(min_length=1)
    property_key: str | None = Field(default=None, min_length=1)


class CmdbRecordObservation(StrictToolInput):
    class_key: str = Field(min_length=1)
    external_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    attributes: dict[str, object] | None = None
    relationships: list[CmdbRelationship] | None = None


class CmdbImpact(StrictToolInput):
    object_id: str = Field(min_length=1)
    max_depth: int = Field(default=5, ge=0, le=10)


class Tool(BaseModel):
    name: str
    surface: Surface
    effect: Effect
    description: str
    schema_model: type[BaseModel]
    # For writes: the read tool that confirms the change landed. A write
    # returning success means the call was accepted, not that it worked.
    verified_by: str | None = None


REGISTRY: dict[str, Tool] = {
    t.name: t
    for t in [
        Tool(
            name="ticket_read_messages",
            surface=Surface.TICKET,
            effect=Effect.READ,
            description=(
                "Read public case-log messages for the current ticket. "
                "Private entries are never returned and this tool cannot write."
            ),
            schema_model=TicketReadMessages,
        ),
        Tool(
            name="knowledge_search",
            surface=Surface.KNOWLEDGE,
            effect=Effect.READ,
            description=(
                "Search the authorized knowledge corpus before exploratory reads. "
                "Cite a matching result by source, identifier, and title."
            ),
            schema_model=KnowledgeSearch,
        ),
        Tool(
            name="knowledge_fetch",
            surface=Surface.KNOWLEDGE,
            effect=Effect.READ,
            description="Fetch the full authorized item identified by a knowledge search result.",
            schema_model=KnowledgeFetch,
        ),
        Tool(
            name="cluster_read_pods",
            surface=Surface.CLUSTER,
            effect=Effect.READ,
            description=(
                "List pods with phase, container statuses, and scheduling conditions. "
                "Prefer this over events: status is structured, events are prose."
            ),
            schema_model=ClusterReadPods,
        ),
        Tool(
            name="cluster_read_deployment",
            surface=Surface.CLUSTER,
            effect=Effect.READ,
            description="Read a deployment's spec and rollout status.",
            schema_model=ClusterReadDeployment,
        ),
        Tool(
            name="cluster_patch_image",
            surface=Surface.CLUSTER,
            effect=Effect.WRITE,
            description=(
                "Replace a container image. Applied as a JSON Patch with an explicit path, "
                "so it fails loudly if the object is not the shape expected."
            ),
            schema_model=ClusterPatchImage,
            verified_by="cluster_read_deployment",
        ),
        Tool(
            name="device_read_state",
            surface=Surface.DEVICE,
            effect=Effect.READ,
            description=(
                "Read device state. Facets: resolver, adapters, reachability, proxy, "
                "identity, processes, certificates, storage, app_cache, printing, screen."
            ),
            schema_model=DeviceReadState,
        ),
        Tool(
            name="device_run_action",
            surface=Surface.DEVICE,
            effect=Effect.WRITE,
            description=(
                "Run a named action from the device's fixed set. Success means the command was "
                "accepted, not that it worked, so verify with device_read_state on the facet "
                "that observes this action — proxy for a proxy change, printing for the print "
                "queue, and so on."
            ),
            schema_model=DeviceRunAction,
            verified_by="device_read_state",
        ),
        Tool(
            name="device_computer_use",
            surface=Surface.DEVICE,
            effect=Effect.WRITE,
            description=(
                "Drive the device GUI toward an objective. Use only when no typed action "
                "exists. Not available on every device."
            ),
            schema_model=DeviceComputerUse,
            verified_by="device_read_state",
        ),
        Tool(
            name="device_propose_command",
            surface=Surface.DEVICE,
            effect=Effect.WRITE,
            description=(
                "Propose a command for a person to authorise. Nothing runs now. Use only "
                "when no typed action and no GUI step fits, then escalate with your diagnosis."
            ),
            schema_model=DeviceProposeCommand,
        ),
        Tool(
            name="cmdb_record_observation",
            surface=Surface.CMDB,
            effect=Effect.WRITE,
            description="Record a typed CI observation and link it to the current ticket.",
            schema_model=CmdbRecordObservation,
        ),
        Tool(
            name="cmdb_impact",
            surface=Surface.CMDB,
            effect=Effect.READ,
            description="List CIs impacted by a CI, breadth-first with a bounded depth.",
            schema_model=CmdbImpact,
        ),
    ]
}


def resolve(name: str) -> Tool | None:
    return REGISTRY.get(name)


def as_llm_tools(*, strict: bool = True) -> list[dict[str, object]]:
    """Render tools with the reasoning envelope required by the agent loop."""
    definitions = []
    for tool in REGISTRY.values():
        schema = tool.schema_model.model_json_schema()
        properties = {"reasoning": {"type": "string", "minLength": 1}, **schema["properties"]}
        parameters = {
            **schema,
            "properties": properties,
            "required": (
                list(properties) if strict else ["reasoning", *schema.get("required", [])]
            ),
            "additionalProperties": False,
        }
        function: dict[str, object] = {
            "name": tool.name,
            "description": tool.description,
            "parameters": parameters,
        }
        function["strict"] = strict
        definitions.append({"type": "function", "function": function})
    return definitions
