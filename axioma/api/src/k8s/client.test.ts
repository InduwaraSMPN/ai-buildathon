import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	buildKubeConfig,
	CLIENT_CACHE_MAX,
	clientsCacheSize,
	createClientCache,
	createKubernetesClient,
	decryptEnvironmentCredential,
	type EnvironmentConnection,
	evictKubernetesClients,
	getKubernetesClients,
} from "./client";

const KEY = Buffer.alloc(32, 0x7a).toString("base64"); // 32 bytes of 0x7a

export function encryptForTest(plain: string, key = KEY): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
	const ciphertext = Buffer.concat([
		cipher.update(plain, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return `v1:${iv.toString("base64url")}:${ciphertext.toString("base64url")}:${tag.toString("base64url")}`;
}

const KUBECONFIG_YAML = `
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://example.invalid:6443
  name: fake
contexts:
- context:
    cluster: fake
    user: fake
  name: fake
current-context: fake
users:
- name: fake
  user:
    token: abcdef
`;

const kubeconfigConnection = (
	id: string,
	key = `env-${id}`,
): EnvironmentConnection => ({
	id,
	key,
	connectionType: "kubeconfig",
	credential: KUBECONFIG_YAML,
});

test("decrypts credentials and surfaces an invalid-format error clearly", () => {
	assert.equal(
		decryptEnvironmentCredential(encryptForTest("s3cret"), KEY),
		"s3cret",
	);
	assert.throws(
		() => decryptEnvironmentCredential("not-a-v1:value", KEY),
		/Invalid encrypted provider secret format/,
	);
	assert.throws(
		() =>
			decryptEnvironmentCredential(
				encryptForTest("x"),
				Buffer.alloc(32, 0).toString("base64"),
			),
		/invalid|failed|auth tag/i,
	);
});

test("decrypt failure reports a missing encryption key distinctly", () => {
	assert.throws(
		() => decryptEnvironmentCredential(encryptForTest("x"), ""),
		/AXIOMA_PROVIDER_ENCRYPTION_KEY is not configured/,
	);
});

test("kubeconfig credential builds a client without touching the network", () => {
	const clients = createKubernetesClient(kubeconfigConnection("a"));
	assert.ok(clients.coreApi);
	assert.ok(clients.appsApi);
	assert.notEqual(clients.coreApi, undefined);
	assert.notEqual(clients.appsApi, undefined);
});

test("two environments resolve to two different client instances", () => {
	const cache = createClientCache();
	const a = kubeconfigConnection("a");
	const b = kubeconfigConnection("b");
	const A = cache.get(a);
	const B = cache.get(b);
	assert.notEqual(A, B);
	assert.notEqual(A.coreApi, B.coreApi);
	assert.equal(cache.size, 2);
});

test("the cache reuses unchanged connections and refreshes changed credentials", () => {
	const cache = createClientCache();
	const connection = kubeconfigConnection("a");
	const first = cache.get(connection);
	assert.equal(first, cache.get(connection));
	assert.notEqual(
		first,
		cache.get({
			...connection,
			credential: KUBECONFIG_YAML.replace("abcdef", "rotated"),
		}),
	);
});

test("eviction drops one environment and evictAll clears the cache", () => {
	const cache = createClientCache();
	cache.get(kubeconfigConnection("a"));
	cache.get(kubeconfigConnection("b"));
	assert.equal(cache.size, 2);
	cache.evict("a");
	assert.equal(cache.size, 1);
	const rebuilt = cache.get(kubeconfigConnection("a"));
	assert.ok(rebuilt);
	cache.evictAll();
	assert.equal(cache.size, 0);
});

test("the cache is bounded and evicts the oldest entry when full", () => {
	const cache = createClientCache({ maxSize: 2 });
	cache.get(kubeconfigConnection("a"));
	cache.get(kubeconfigConnection("b"));
	cache.get(kubeconfigConnection("c"));
	assert.equal(cache.size, 2);
	// "a" was evicted; re-requesting it rebuilds rather than reusing.
	assert.ok(cache.get(kubeconfigConnection("a")));
});

test("in-cluster mode builds a client from the standard service env vars", () => {
	const prevHost = process.env.KUBERNETES_SERVICE_HOST;
	const prevPort = process.env.KUBERNETES_SERVICE_PORT;
	try {
		process.env.KUBERNETES_SERVICE_HOST = "10.0.0.1";
		process.env.KUBERNETES_SERVICE_PORT = "443";
		const config = buildKubeConfig({
			id: "in",
			key: "in",
			connectionType: "in_cluster",
		});
		assert.ok(config.getCurrentCluster());
		const clients = createKubernetesClient({
			id: "in",
			key: "in",
			connectionType: "in_cluster",
		});
		assert.ok(clients.coreApi);
	} finally {
		if (prevHost === undefined) delete process.env.KUBERNETES_SERVICE_HOST;
		else process.env.KUBERNETES_SERVICE_HOST = prevHost;
		if (prevPort === undefined) delete process.env.KUBERNETES_SERVICE_PORT;
		else process.env.KUBERNETES_SERVICE_PORT = prevPort;
	}
});

test("token-plus-endpoint mode builds a client via loadFromClusterAndUser", () => {
	const clients = createKubernetesClient({
		id: "t",
		key: "eu-prod",
		connectionType: "kubeconfig",
		server: "https://kube.example.invalid:6443",
		token: "bearer-token",
	});
	assert.ok(clients.coreApi);
	assert.ok(clients.appsApi);
});

test("JSON endpoint+token credential builds a client and wires server/token", () => {
	const credential = JSON.stringify({
		server: "https://eu.example.invalid:6443",
		token: "json-token",
		namespace: "prod",
	});
	const config = buildKubeConfig({
		id: "json",
		key: "json",
		connectionType: "kubeconfig",
		credential,
	});
	assert.equal(
		config.getCurrentCluster()?.server,
		"https://eu.example.invalid:6443",
	);
	assert.equal(config.getCurrentUser()?.token, "json-token");
	const current = config.getCurrentContext();
	assert.equal(config.getContextObject(current)?.namespace, "prod");
	assert.ok(
		createKubernetesClient({
			id: "json",
			key: "json",
			connectionType: "kubeconfig",
			credential,
		}).coreApi,
	);
});

test("encrypted JSON endpoint+token credential decrypts and builds", () => {
	const credential = JSON.stringify({
		server: "https://enc.example.invalid:6443",
		token: "enc-token",
	});
	const connection: EnvironmentConnection = {
		id: "enc",
		key: "enc",
		connectionType: "kubeconfig",
		credentialEncrypted: encryptForTest(credential),
	};
	assert.ok(createKubernetesClient(connection, { secretKey: KEY }).coreApi);
	const config = buildKubeConfig(connection, { secretKey: KEY });
	assert.equal(
		config.getCurrentCluster()?.server,
		"https://enc.example.invalid:6443",
	);
});

test("a credentials-without-server connection is a clear error", () => {
	assert.throws(
		() =>
			buildKubeConfig({
				id: "nosrv",
				key: "nosrv",
				connectionType: "kubeconfig",
				credential: JSON.stringify({ token: "abc" }),
			}),
		/credentials but no server URL/,
	);
});

test("a bare token alongside a server URL builds a client", () => {
	const config = buildKubeConfig({
		id: "bare",
		key: "bare",
		connectionType: "kubeconfig",
		server: "https://bare.example.invalid:6443",
		credential: "plain-token",
	});
	assert.equal(
		config.getCurrentCluster()?.server,
		"https://bare.example.invalid:6443",
	);
	assert.equal(config.getCurrentUser()?.token, "plain-token");
});

test("bare-token credential without a server is a clear error", () => {
	assert.throws(
		() =>
			createKubernetesClient({
				id: "bare",
				key: "bare",
				connectionType: "kubeconfig",
				credential: "just-a-token",
			}),
		/credentials but no server URL/,
	);
});

test("environment credential that no longer decrypts surfaces clearly", () => {
	assert.throws(
		() =>
			createKubernetesClient(
				{
					id: "bad",
					key: "bad",
					connectionType: "kubeconfig",
					credentialEncrypted: "v1:abc:def:ghij",
				},
				{ secretKey: KEY },
			),
		/Failed to decrypt environment credentials/,
	);
});

test("bootstrap fallback uses an explicit kubeconfig path", () => {
	const dir = mkdtempSync(join(tmpdir(), "axioma-k8s-"));
	try {
		const path = join(dir, "config");
		writeFileSync(path, KUBECONFIG_YAML);
		const config = buildKubeConfig(
			{ id: "bootstrap", key: "default", connectionType: "default" },
			{ bootstrap: { kubeconfigPath: path } },
		);
		assert.ok(config.getCurrentCluster());
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("default singleton cache exposes eviction and size", () => {
	const id = `singleton-${Math.random().toString(36).slice(2)}`;
	getKubernetesClients({
		id,
		key: id,
		connectionType: "kubeconfig",
		credential: KUBECONFIG_YAML,
	});
	assert.ok(clientsCacheSize() >= 1);
	const before = clientsCacheSize();
	evictKubernetesClients(id);
	assert.ok(clientsCacheSize() <= before);
});

test("CLIENT_CACHE_MAX is a positive bound", () => {
	assert.ok(CLIENT_CACHE_MAX > 0);
	assert.equal(createClientCache({ maxSize: 3 }).maxSize, 3);
});
