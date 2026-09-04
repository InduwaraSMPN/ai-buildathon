import {
	PatchStrategy,
	setHeaderOptions,
	type V1Deployment,
} from "@kubernetes/client-node";
import { z } from "zod";
import { env } from "@/env";
import {
	defaultEnvironmentConnection,
	type EnvironmentConnection,
	getKubernetesClients,
} from "@/k8s/client";

// The environment a cluster call runs against. `executeTool` (or the caller)
// resolves and injects the authoritative connection; when absent the cluster
// tools fall back to the single-environment bootstrap so an existing deployment
// keeps working unchanged.
export type EnvironmentContext = {
	connection: EnvironmentConnection;
	key?: string;
};
export type ClusterToolCtx = { environment?: EnvironmentContext };

const environmentInput = z.string().min(1).optional();

export const readPodsInput = z.object({
	namespace: z.string().min(1),
	label_selector: z.string().optional(),
	environment: environmentInput,
});
export const readDeploymentInput = z.object({
	namespace: z.string().min(1),
	name: z.string().min(1),
	environment: environmentInput,
});
export const patchImageInput = readDeploymentInput.extend({
	container_index: z.number().int().nonnegative(),
	image: z.string().min(1),
});

const POD_PAGE_LIMIT = 200;
/**
 * Long enough for a cold image pull. The previous 15 seconds routinely expired
 * on a patch that had already been applied, so the agent saw a failure for a
 * change the cluster had accepted and retried it.
 */
const ROLLOUT_CEILING_MS = 180_000;

function resolveConnection(ctx?: ClusterToolCtx): EnvironmentConnection {
	return ctx?.environment?.connection ?? defaultEnvironmentConnection();
}

const managedNamespaces = (): string[] =>
	(env.AXIOMA_K8S_NAMESPACES ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);

/**
 * The namespace is model-supplied and the chart's per-namespace Role only binds
 * the in-cluster ServiceAccount — under `kubeconfig` mode the pod uses a mounted
 * credential instead and that Role is inert, so a prompt-injected ticket could
 * otherwise reach `kube-system`. This is the allowlist the documentation already
 * describes, enforced where the call is made rather than only in RBAC.
 */
function assertManagedNamespace(namespace: string): void {
	const allowed = managedNamespaces();
	if (!allowed.length || allowed.includes(namespace)) return;
	throw new Error(
		`namespace ${namespace} is not managed by this deployment; allowed: ${allowed.join(", ")}`,
	);
}

export async function readPods(
	input: z.infer<typeof readPodsInput>,
	ctx?: ClusterToolCtx,
) {
	assertManagedNamespace(input.namespace);
	const connection = resolveConnection(ctx);
	const { coreApi } = getKubernetesClients(connection);
	// Bounded: an unfiltered list of a large namespace is materialised whole and
	// then serialised into a model payload.
	const result = await coreApi.listNamespacedPod({
		namespace: input.namespace,
		labelSelector: input.label_selector,
		limit: POD_PAGE_LIMIT,
	});
	return result.items.map((pod) => ({
		name: pod.metadata?.name ?? "",
		phase: pod.status?.phase ?? null,
		containerStatuses: (pod.status?.containerStatuses ?? []).map((status) => ({
			state: status.state,
			lastState: status.lastState,
			restartCount: status.restartCount,
		})),
		conditions: (pod.status?.conditions ?? [])
			.filter((condition) => condition.type === "PodScheduled")
			.map(({ reason, message, status }) => ({ reason, message, status })),
	}));
}

export async function readDeployment(
	input: z.infer<typeof readDeploymentInput>,
	ctx?: ClusterToolCtx,
) {
	assertManagedNamespace(input.namespace);
	const connection = resolveConnection(ctx);
	const { appsApi } = getKubernetesClients(connection);
	const deployment = await appsApi.readNamespacedDeployment(input);
	return deploymentObservation(deployment);
}

export function deploymentObservation(deployment: V1Deployment) {
	return {
		name: deployment.metadata?.name ?? "",
		containers: (deployment.spec?.template.spec?.containers ?? []).map(
			({ name, image }) => ({ name, image }),
		),
		replicas: deployment.spec?.replicas ?? 0,
		readyReplicas: deployment.status?.readyReplicas ?? 0,
		updatedReplicas: deployment.status?.updatedReplicas ?? 0,
		conditions: deployment.status?.conditions ?? [],
		revision:
			deployment.metadata?.annotations?.["deployment.kubernetes.io/revision"] ??
			null,
	};
}

export async function patchImage(
	input: z.infer<typeof patchImageInput>,
	ctx?: ClusterToolCtx,
) {
	assertManagedNamespace(input.namespace);
	const connection = resolveConnection(ctx);
	const { appsApi } = getKubernetesClients(connection);
	const body = [
		{
			op: "replace",
			path: `/spec/template/spec/containers/${input.container_index}/image`,
			value: input.image,
		},
	];
	const request = { name: input.name, namespace: input.namespace, body };
	const headers = setHeaderOptions("Content-Type", PatchStrategy.JsonPatch);
	const dryRun = await appsApi.patchNamespacedDeployment(
		{ ...request, dryRun: "All" },
		headers,
	);
	const applied = await appsApi.patchNamespacedDeployment(request, headers);
	return {
		dryRun: deploymentObservation(dryRun),
		applied: deploymentObservation(applied),
		...(await pollRollout(input.namespace, input.name, connection)),
	};
}

// `connection` threads the environment for the whole rollout so every read in
// the polling loop (and the verification it feeds) stays on the same cluster.
export async function pollRollout(
	namespace: string,
	name: string,
	connection?: EnvironmentConnection,
	ceilingMs = ROLLOUT_CEILING_MS,
) {
	const rollout: Awaited<ReturnType<typeof readDeployment>>[] = [];
	const deadline = Date.now() + ceilingMs;
	do {
		const observation = await readDeployment(
			{ namespace, name },
			connection ? { environment: { connection } } : undefined,
		);
		rollout.push(observation);
		if (
			observation.replicas > 0 &&
			observation.readyReplicas === observation.replicas
		)
			return { rollout, rolloutTimedOut: false };
		await new Promise((resolve) => setTimeout(resolve, 2_000));
	} while (Date.now() < deadline);
	// Not an error: the patch has already been applied by the time this runs, so
	// throwing told the agent a completed write had failed and invited a retry
	// against a cluster that had already changed. The caller reads the flag and
	// verifies with its own read, which is what the prompt already requires.
	return { rollout, rolloutTimedOut: true };
}
