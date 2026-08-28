import {
	AppsV1Api,
	CoreV1Api,
	KubeConfig,
	PatchStrategy,
	setHeaderOptions,
} from "@kubernetes/client-node";

/**
 * Kubernetes connector.
 *
 * Reads come from pod status rather than events wherever the signal exists there:
 * status is structured, events are prose. `containerStatuses[].state.waiting.reason`
 * gives ImagePullBackOff and CrashLoopBackOff directly, `lastState.terminated.reason`
 * gives OOMKilled, and `conditions[PodScheduled].reason` gives Unschedulable with the
 * scheduler's own message.
 *
 * Writes use JSON Patch with an explicit path rather than strategic merge. A JSON
 * Patch fails loudly if the object is not the shape the caller believed; strategic
 * merge applies silently and the mistake surfaces later.
 */

export interface ContainerStatusView {
	name: string;
	ready: boolean;
	restartCount: number;
	waitingReason: string | null;
	waitingMessage: string | null;
	lastTerminatedReason: string | null;
	lastTerminatedExitCode: number | null;
}

export interface PodView {
	name: string;
	phase: string;
	containerStatuses: ContainerStatusView[];
	scheduledCondition: {
		status: string;
		reason: string | null;
		message: string | null;
	} | null;
}

export interface DeploymentView {
	name: string;
	generation: number;
	observedGeneration: number;
	replicas: number;
	updatedReplicas: number;
	readyReplicas: number;
	unavailableReplicas: number;
	containers: { name: string; image: string }[];
}

export class KubernetesConnector {
	private readonly core: CoreV1Api;
	private readonly apps: AppsV1Api;

	constructor(kubeConfig?: KubeConfig) {
		const kc = kubeConfig ?? new KubeConfig();
		if (!kubeConfig) kc.loadFromDefault();
		this.core = kc.makeApiClient(CoreV1Api);
		this.apps = kc.makeApiClient(AppsV1Api);
	}

	async readPods(input: {
		namespace: string;
		labelSelector?: string;
	}): Promise<PodView[]> {
		const { items } = await this.core.listNamespacedPod({
			namespace: input.namespace,
			...(input.labelSelector ? { labelSelector: input.labelSelector } : {}),
		});

		return items.map((pod) => ({
			name: pod.metadata?.name ?? "",
			phase: pod.status?.phase ?? "Unknown",
			containerStatuses: (pod.status?.containerStatuses ?? []).map((cs) => ({
				name: cs.name,
				ready: cs.ready ?? false,
				restartCount: cs.restartCount ?? 0,
				waitingReason: cs.state?.waiting?.reason ?? null,
				waitingMessage: cs.state?.waiting?.message ?? null,
				lastTerminatedReason: cs.lastState?.terminated?.reason ?? null,
				lastTerminatedExitCode: cs.lastState?.terminated?.exitCode ?? null,
			})),
			scheduledCondition: (() => {
				const condition = pod.status?.conditions?.find(
					(c) => c.type === "PodScheduled",
				);
				if (!condition) return null;
				return {
					status: condition.status,
					reason: condition.reason ?? null,
					message: condition.message ?? null,
				};
			})(),
		}));
	}

	async readDeployment(input: {
		namespace: string;
		name: string;
	}): Promise<DeploymentView> {
		const d = await this.apps.readNamespacedDeployment({
			namespace: input.namespace,
			name: input.name,
		});

		return {
			name: d.metadata?.name ?? input.name,
			generation: d.metadata?.generation ?? 0,
			observedGeneration: d.status?.observedGeneration ?? 0,
			replicas: d.spec?.replicas ?? 0,
			updatedReplicas: d.status?.updatedReplicas ?? 0,
			readyReplicas: d.status?.readyReplicas ?? 0,
			unavailableReplicas: d.status?.unavailableReplicas ?? 0,
			containers: (d.spec?.template?.spec?.containers ?? []).map((c) => ({
				name: c.name,
				image: c.image ?? "",
			})),
		};
	}

	/**
	 * Replace a container image. Runs once with dryRun to confirm the patch is
	 * accepted against the live object, then for real.
	 */
	async patchImage(input: {
		namespace: string;
		name: string;
		containerIndex: number;
		image: string;
	}): Promise<{ applied: boolean; previousImage: string }> {
		const before = await this.readDeployment(input);
		const previousImage = before.containers[input.containerIndex]?.image ?? "";

		const body = [
			{
				op: "replace",
				path: `/spec/template/spec/containers/${input.containerIndex}/image`,
				value: input.image,
			},
		];

		const options = setHeaderOptions("Content-Type", PatchStrategy.JsonPatch);

		await this.apps.patchNamespacedDeployment(
			{
				name: input.name,
				namespace: input.namespace,
				dryRun: "All",
				fieldValidation: "Strict",
				body,
			},
			options,
		);

		await this.apps.patchNamespacedDeployment(
			{
				name: input.name,
				namespace: input.namespace,
				fieldValidation: "Strict",
				body,
			},
			options,
		);

		return { applied: true, previousImage };
	}

	/**
	 * Poll until the rollout settles or the deadline passes.
	 *
	 * Polling rather than watching: fewer moving parts, and the caller gets a
	 * progress stream for free.
	 */
	async waitForRollout(input: {
		namespace: string;
		name: string;
		deadlineMs?: number;
		intervalMs?: number;
		onProgress?: (view: DeploymentView) => void;
	}): Promise<{ ready: boolean; last: DeploymentView }> {
		const deadline = Date.now() + (input.deadlineMs ?? 120_000);
		const interval = input.intervalMs ?? 1_000;

		let last = await this.readDeployment(input);
		while (Date.now() < deadline) {
			last = await this.readDeployment(input);
			input.onProgress?.(last);

			const settled =
				last.observedGeneration >= last.generation &&
				last.updatedReplicas === last.replicas &&
				last.readyReplicas === last.replicas &&
				last.unavailableReplicas === 0;

			if (settled) return { ready: true, last };
			await new Promise((resolve) => setTimeout(resolve, interval));
		}

		return { ready: false, last };
	}
}
