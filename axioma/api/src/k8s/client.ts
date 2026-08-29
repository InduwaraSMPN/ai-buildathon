import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { env } from "@/env";

let clients: { coreApi: CoreV1Api; appsApi: AppsV1Api } | undefined;

export function getKubernetesClients() {
	if (clients) return clients;
	const kubeConfig = new KubeConfig();
	if (env.KUBECONFIG) kubeConfig.loadFromFile(env.KUBECONFIG);
	else kubeConfig.loadFromDefault();
	if (env.AXIOMA_K8S_CONTEXT)
		kubeConfig.setCurrentContext(env.AXIOMA_K8S_CONTEXT);
	clients = {
		coreApi: kubeConfig.makeApiClient(CoreV1Api),
		appsApi: kubeConfig.makeApiClient(AppsV1Api),
	};
	return clients;
}
