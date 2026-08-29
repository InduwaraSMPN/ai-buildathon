"""The tool registry.

Axel selects a tool by name and supplies parameters that are validated against
that tool's schema before anything leaves the process. It does not compose
commands, shell strings, or API calls, so a run is always replayable from the
transcript: tool name plus validated input is the whole story.

Nothing here executes. Every tool is a *request* the agent sends to the API over
the back-channel, and the API owns the side effect. The agent has no database
connection, no cluster credentials, and no path to a device.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictToolInput(BaseModel):
    """Base for inputs exposed through strict function calling."""

    model_config = ConfigDict(extra="forbid")


class Effect(StrEnum):
    READ = "read"
    WRITE = "write"


class Surface(StrEnum):
    CLUSTER = "cluster"
    DEVICE = "device"
    CMDB = "cmdb"


# --- cluster -----------------------------------------------------------------


class ClusterReadPods(StrictToolInput):
    namespace: str = Field(min_length=1)
    label_selector: str | None = None


class ClusterReadDeployment(StrictToolInput):
    namespace: str = Field(min_length=1)
    name: str = Field(min_length=1)


class ClusterPatchImage(StrictToolInput):
    namespace: str = Field(min_length=1)
    name: str = Field(min_length=1)
    container_index: int = Field(ge=0)
    image: str = Field(min_length=1)


# --- device ------------------------------------------------------------------


class DeviceReadState(StrictToolInput):
    device_id: str = Field(min_length=1)
    facets: list[
        Literal["resolver", "adapters", "reachability", "proxy", "identity", "processes"]
    ] = Field(min_length=1)
    target: str | None = Field(default=None, min_length=1, max_length=253)


class DeviceRunAction(StrictToolInput):
    """Tier one: a named action the device implements. No command string."""

    device_id: str = Field(min_length=1)
    action: Literal[
        "flush_dns",
        "renew_dhcp_lease",
        "clear_proxy_override",
        "reset_credential_cache",
        "restart_user_process",
    ]
    parameters: dict[str, str] = Field(default_factory=dict)


class DeviceComputerUse(StrictToolInput):
    """Tier two: only when no programmatic path exists.

    Slow, non-deterministic, costs vision tokens per step, and leaves you less
    able to say precisely what changed. Reach for it after establishing there is
    no API, CLI, or registry path — not because it is available.
    """

    device_id: str = Field(min_length=1)
    objective: str = Field(min_length=1)
    timeout_seconds: int = Field(default=120, ge=10, le=600)


# --- cmdb --------------------------------------------------------------------


class CmdbRecordObservation(StrictToolInput):
    kind: Literal["service", "deployment", "pod", "device", "dependency"]
    external_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    attributes: dict[str, object] | None = None
    relates_to_id: str | None = None
    relation_kind: str | None = None


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
            name="cluster.read_pods",
            surface=Surface.CLUSTER,
            effect=Effect.READ,
            description=(
                "List pods with phase, container statuses, and scheduling conditions. "
                "Prefer this over events: status is structured, events are prose."
            ),
            schema_model=ClusterReadPods,
        ),
        Tool(
            name="cluster.read_deployment",
            surface=Surface.CLUSTER,
            effect=Effect.READ,
            description="Read a deployment's spec and rollout status.",
            schema_model=ClusterReadDeployment,
        ),
        Tool(
            name="cluster.patch_image",
            surface=Surface.CLUSTER,
            effect=Effect.WRITE,
            description=(
                "Replace a container image. Applied as a JSON Patch with an explicit path, "
                "so it fails loudly if the object is not the shape expected."
            ),
            schema_model=ClusterPatchImage,
            verified_by="cluster.read_deployment",
        ),
        Tool(
            name="device.read_state",
            surface=Surface.DEVICE,
            effect=Effect.READ,
            description="Read device state: resolver, adapters, services, reachability.",
            schema_model=DeviceReadState,
        ),
        Tool(
            name="device.run_action",
            surface=Surface.DEVICE,
            effect=Effect.WRITE,
            description="Run a named action from the device's fixed set.",
            schema_model=DeviceRunAction,
            verified_by="device.read_state",
        ),
        Tool(
            name="device.computer_use",
            surface=Surface.DEVICE,
            effect=Effect.WRITE,
            description=(
                "Drive the device GUI toward an objective. Use only when no typed action "
                "exists. Not available on every device."
            ),
            schema_model=DeviceComputerUse,
            verified_by="device.read_state",
        ),
        Tool(
            name="cmdb.record_observation",
            surface=Surface.CMDB,
            effect=Effect.WRITE,
            description="Record what was observed, with the run and step that observed it.",
            schema_model=CmdbRecordObservation,
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
            "required": list(properties),
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
