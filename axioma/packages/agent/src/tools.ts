import { z } from "zod";

/**
 * The tool registry.
 *
 * Axel selects a tool by name and supplies parameters that are validated against
 * that tool's schema before anything executes. It does not compose commands,
 * shell strings, or arbitrary API calls, so a run is always replayable from the
 * transcript: tool name plus validated input is the whole story.
 *
 * `effect` separates reads from writes. Every write must name the read tool that
 * confirms it, because a write returning success means the call was accepted,
 * not that the problem is fixed.
 */

export type ToolEffect = "read" | "write";
export type ToolSurface = "cluster" | "device" | "cmdb";

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
	name: string;
	surface: ToolSurface;
	effect: ToolEffect;
	description: string;
	input: z.ZodType<TInput>;
	output: z.ZodType<TOutput>;
	/** For writes: the read tool that verifies the change landed. */
	verifiedBy?: string;
}

/**
 * Erased tool shape, for storing and iterating tools of differing input types.
 *
 * `never` would be wrong here — a concrete tool is not assignable to it — and
 * `unknown` fails on the contravariant input position. This is the one place the
 * registry gives up its parameter types; every call site re-narrows by parsing
 * through `input`, so nothing downstream depends on this looseness.
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous registry storage
export type AnyToolDefinition = ToolDefinition<any, any>;

function defineTool<TInput, TOutput>(
	definition: ToolDefinition<TInput, TOutput>,
): ToolDefinition<TInput, TOutput> {
	return definition;
}

const podRef = z.object({
	namespace: z.string().min(1),
	labelSelector: z.string().optional(),
});

const deploymentRef = z.object({
	namespace: z.string().min(1),
	name: z.string().min(1),
});

export const clusterReadPods = defineTool({
	name: "cluster.read_pods",
	surface: "cluster",
	effect: "read",
	description:
		"List pods with their phase, container statuses, and scheduling conditions. " +
		"Prefer this over events: status is structured, events are prose.",
	input: podRef,
	output: z.object({
		pods: z.array(
			z.object({
				name: z.string(),
				phase: z.string(),
				containerStatuses: z.array(
					z.object({
						name: z.string(),
						ready: z.boolean(),
						restartCount: z.number(),
						waitingReason: z.string().nullable(),
						waitingMessage: z.string().nullable(),
						lastTerminatedReason: z.string().nullable(),
						lastTerminatedExitCode: z.number().nullable(),
					}),
				),
				scheduledCondition: z
					.object({
						status: z.string(),
						reason: z.string().nullable(),
						message: z.string().nullable(),
					})
					.nullable(),
			}),
		),
	}),
});

export const clusterReadDeployment = defineTool({
	name: "cluster.read_deployment",
	surface: "cluster",
	effect: "read",
	description: "Read a deployment's spec and rollout status.",
	input: deploymentRef,
	output: z.object({
		name: z.string(),
		generation: z.number(),
		observedGeneration: z.number(),
		replicas: z.number(),
		updatedReplicas: z.number(),
		readyReplicas: z.number(),
		unavailableReplicas: z.number(),
		containers: z.array(z.object({ name: z.string(), image: z.string() })),
	}),
});

export const clusterPatchImage = defineTool({
	name: "cluster.patch_image",
	surface: "cluster",
	effect: "write",
	verifiedBy: "cluster.read_deployment",
	description:
		"Replace a container image on a deployment. Applied as a JSON Patch with an " +
		"explicit path so it fails loudly if the object is not the shape expected, and " +
		"run once with dryRun before running for real.",
	input: deploymentRef.extend({
		containerIndex: z.number().int().min(0),
		image: z.string().min(1),
	}),
	output: z.object({ applied: z.boolean(), previousImage: z.string() }),
});

export const deviceReadState = defineTool({
	name: "device.read_state",
	surface: "device",
	effect: "read",
	description:
		"Read device state through the CLI agent: network, DNS, services, reachability.",
	input: z.object({
		deviceId: z.string().min(1),
		facets: z
			.array(z.enum(["resolver", "adapters", "services", "reachability"]))
			.min(1),
	}),
	output: z.object({ facets: z.record(z.string(), z.unknown()) }),
});

export const deviceRunAction = defineTool({
	name: "device.run_action",
	surface: "device",
	effect: "write",
	verifiedBy: "device.read_state",
	description:
		"Run a named action on the device. The action is chosen from a fixed set the " +
		"CLI implements; parameters are typed. No command string crosses this boundary.",
	input: z.object({
		deviceId: z.string().min(1),
		action: z.enum(["flush_dns", "reset_resolver", "restart_service"]),
		parameters: z.record(z.string(), z.string()).default({}),
	}),
	output: z.object({ ok: z.boolean(), detail: z.string().optional() }),
});

export const cmdbRecordObservation = defineTool({
	name: "cmdb.record_observation",
	surface: "cmdb",
	effect: "write",
	description:
		"Record what was observed, with the run and step that observed it. Additive; " +
		"never overwrites a prior observation.",
	input: z.object({
		kind: z.enum(["service", "deployment", "pod", "device", "dependency"]),
		externalId: z.string().min(1),
		name: z.string().min(1),
		attributes: z.record(z.string(), z.unknown()).optional(),
		relatesToId: z.string().optional(),
		relationKind: z.string().optional(),
	}),
	output: z.object({ id: z.string() }),
});

export const TOOL_REGISTRY = {
	[clusterReadPods.name]: clusterReadPods,
	[clusterReadDeployment.name]: clusterReadDeployment,
	[clusterPatchImage.name]: clusterPatchImage,
	[deviceReadState.name]: deviceReadState,
	[deviceRunAction.name]: deviceRunAction,
	[cmdbRecordObservation.name]: cmdbRecordObservation,
} satisfies Record<string, AnyToolDefinition>;

export type ToolName = keyof typeof TOOL_REGISTRY;

export function resolveTool(name: string): AnyToolDefinition | undefined {
	return (TOOL_REGISTRY as Record<string, AnyToolDefinition>)[name];
}

export function listTools(): AnyToolDefinition[] {
	return Object.values(TOOL_REGISTRY);
}
