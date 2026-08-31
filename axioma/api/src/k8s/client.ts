import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { aesGcmProviderSecretLoader } from "@/auth/providers";
import { env } from "@/env";

/**
 * One environment's connection to a Kubernetes API. `id` is the cache key and
 * matches `environments.id`; `key` is the stable, human-meaningful name
 * (`prod`, `staging`, `eu-prod`) that tool inputs and the agent may reference.
 */
export type EnvironmentConnection = {
	id: string;
	key: string;
	connectionType: "in_cluster" | "kubeconfig" | "default";
	contextName?: string;
	/** Encrypted kubeconfig YAML or bare bearer token; decrypted by the factory. */
	credentialEncrypted?: string;
	/** Already-decrypted kubeconfig YAML or token, when the caller has it. */
	credential?: string;
	/** API endpoint for a token-only kubeconfig credential. */
	server?: string;
	/** Bearer token for a token-only kubeconfig credential. */
	token?: string;
};

export type EnvironmentMode = "act" | "shadow";

export type KubernetesClients = { coreApi: CoreV1Api; appsApi: AppsV1Api };

export type BuildOptions = {
	/** Base64-encoded 32-byte AES key; defaults to AXIOMA_PROVIDER_ENCRYPTION_KEY. */
	secretKey?: string;
	/** Bootstrap overrides for the single-environment fallback ("default"). */
	bootstrap?: { kubeconfigPath?: string; context?: string };
};

// A small bound so a deployed API cannot grow an unbounded map of client
// objects; 16 environments is far beyond any single customer.
export const CLIENT_CACHE_MAX = 16;

/** The single-environment bootstrap connection used when nothing is resolved. */
export function defaultEnvironmentConnection(): EnvironmentConnection {
	return { id: "bootstrap", key: "default", connectionType: "default" };
}

export function decryptEnvironmentCredential(
	encrypted: string,
	key = env.AXIOMA_PROVIDER_ENCRYPTION_KEY,
): string {
	if (!key)
		throw new Error(
			"AXIOMA_PROVIDER_ENCRYPTION_KEY is not configured; cannot decrypt environment credentials",
		);
	try {
		return aesGcmProviderSecretLoader(key)(encrypted);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to decrypt environment credentials: ${detail}`, {
			cause: error,
		});
	}
}

function looksLikeKubeconfig(raw: string): boolean {
	return (
		raw.trimStart().startsWith("apiVersion:") ||
		raw.includes("clusters:") ||
		raw.includes("kind: Config")
	);
}

/** Endpoint+token credentials, typically stored encrypted as JSON. */
export type EndpointCredential = {
	server: string;
	token?: string;
	username?: string;
	password?: string;
	/** CA certificate as base64 (or raw PEM, which is base64-encoded here). */
	certificateAuthority?: string;
	insecureSkipTlsVerify?: boolean;
	contextName?: string;
	namespace?: string;
};

function parseEndpointCredential(raw: string): EndpointCredential | undefined {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (
			parsed &&
			typeof parsed === "object" &&
			typeof (parsed as EndpointCredential).server === "string"
		)
			return parsed as EndpointCredential;
	} catch {
		// Not JSON — treat as a bare token (or kubeconfig text) below.
	}
	return undefined;
}

function normalizeCaData(value: string): string {
	return value.includes("-----BEGIN")
		? Buffer.from(value, "utf8").toString("base64")
		: value;
}

function applyServerTokenConnection(
	config: KubeConfig,
	options: {
		name: string;
		server: string;
		token?: string;
		username?: string;
		password?: string;
		ca?: string;
		insecure?: boolean;
		contextName?: string;
		namespace?: string;
	},
) {
	const { name, server } = options;
	config.addCluster({
		name,
		server,
		skipTLSVerify: options.insecure ?? false,
		...(options.ca ? { caData: normalizeCaData(options.ca) } : {}),
	});
	config.addUser({
		name,
		...(options.token ? { token: options.token } : {}),
		...(options.password
			? { username: options.username, password: options.password }
			: {}),
	});
	const contextName = options.contextName ?? name;
	config.addContext({
		name: contextName,
		cluster: name,
		user: name,
		...(options.namespace ? { namespace: options.namespace } : {}),
	});
	config.setCurrentContext(contextName);
}

/**
 * Build a `KubeConfig` for a connection. Calling this never dials the cluster —
 * it only wires configuration, so it is testable without a live cluster.
 *
 * The `kubeconfig` connection type accepts either a full kubeconfig document or
 * an endpoint+token credential (a JSON object like `{"server","token",...}` or a
 * bare token alongside `connection.server`).
 */
export function buildKubeConfig(
	connection: EnvironmentConnection,
	opts: BuildOptions = {},
): KubeConfig {
	const config = new KubeConfig();
	switch (connection.connectionType) {
		case "in_cluster":
			config.loadFromCluster();
			break;
		case "kubeconfig": {
			const raw =
				connection.credential ??
				(connection.credentialEncrypted
					? decryptEnvironmentCredential(
							connection.credentialEncrypted,
							opts.secretKey,
						)
					: undefined);
			const name = connection.key || connection.id;
			if (raw && looksLikeKubeconfig(raw)) {
				config.loadFromString(raw);
				if (connection.contextName)
					config.setCurrentContext(connection.contextName);
				break;
			}
			if (raw) {
				// JSON endpoint+token credential (or a bare token).
				const endpoint = parseEndpointCredential(raw);
				const server = endpoint?.server ?? connection.server;
				if (!server)
					throw new Error(
						`Environment "${connection.key}" provides credentials but no server URL`,
					);
				applyServerTokenConnection(config, {
					name,
					server,
					token:
						endpoint?.token ?? connection.token ?? (endpoint ? undefined : raw),
					username: endpoint?.username,
					password: endpoint?.password,
					ca: endpoint?.certificateAuthority,
					insecure: endpoint?.insecureSkipTlsVerify,
					contextName: connection.contextName ?? endpoint?.contextName,
					namespace: endpoint?.namespace,
				});
				break;
			}
			if (connection.server) {
				applyServerTokenConnection(config, {
					name,
					server: connection.server,
					token: connection.token,
					contextName: connection.contextName,
				});
				break;
			}
			throw new Error(
				`Environment "${connection.key}" has kubeconfig credentials but no usable kubeconfig, server, or token`,
			);
		}
		case "default": {
			const kubeconfigPath = opts.bootstrap?.kubeconfigPath ?? env.KUBECONFIG;
			if (kubeconfigPath) config.loadFromFile(kubeconfigPath);
			else config.loadFromDefault();
			const context = opts.bootstrap?.context ?? env.AXIOMA_K8S_CONTEXT;
			if (context) config.setCurrentContext(context);
			break;
		}
	}
	return config;
}

export function createKubernetesClient(
	connection: EnvironmentConnection,
	opts: BuildOptions = {},
): KubernetesClients {
	const config = buildKubeConfig(connection, opts);
	return {
		coreApi: config.makeApiClient(CoreV1Api),
		appsApi: config.makeApiClient(AppsV1Api),
	};
}

export type ClientCache = {
	/** Build (lazily) and cache a pair of clients, keyed by environment id. */
	get(connection: EnvironmentConnection): KubernetesClients;
	/** Drop one environment's cached clients; call on environment update/delete. */
	evict(id: string): void;
	/** Drop every cached client; call on mass reconfiguration or teardown. */
	evictAll(): void;
	readonly size: number;
	readonly maxSize: number;
};

export function createClientCache(
	opts: { maxSize?: number; secretKey?: string } = {},
): ClientCache {
	const maxSize = opts.maxSize ?? CLIENT_CACHE_MAX;
	const buildOptions: BuildOptions = { secretKey: opts.secretKey };
	const cache = new Map<string, KubernetesClients>();
	const key = (connection: EnvironmentConnection) => JSON.stringify(connection);
	return {
		get(connection) {
			const cacheKey = key(connection);
			const hit = cache.get(cacheKey);
			if (hit) return hit;
			const clients = createKubernetesClient(connection, buildOptions);
			cache.set(cacheKey, clients);
			if (cache.size > maxSize) {
				const oldest = cache.keys().next().value;
				if (oldest !== undefined) cache.delete(oldest);
			}
			return clients;
		},
		evict(id) {
			for (const key of cache.keys())
				if ((JSON.parse(key) as EnvironmentConnection).id === id)
					cache.delete(key);
		},
		evictAll() {
			cache.clear();
		},
		get size() {
			return cache.size;
		},
		maxSize,
	};
}

const defaultCache = createClientCache();

/**
 * Default singleton cache used by the cluster tools. `connection.id` keys it;
 * two environments therefore resolve to two independent clients.
 */
export function getKubernetesClients(connection: EnvironmentConnection) {
	return defaultCache.get(connection);
}

/** Evict one environment's cached clients (used on environment update/delete). */
export function evictKubernetesClients(id: string) {
	defaultCache.evict(id);
}

/** Evict every cached client. */
export function evictAllKubernetesClients() {
	defaultCache.evictAll();
}

/** Test/debug accessor for how many clients the default cache holds. */
export function clientsCacheSize() {
	return defaultCache.size;
}
