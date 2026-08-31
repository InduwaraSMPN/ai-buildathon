import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-url";
import type { PortalContract } from "@/sdk/contracts";

export function createQueryClient() {
	return new QueryClient();
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
	url: apiUrl("rpc"),
	fetch(url, options) {
		return fetch(url, {
			...options,
			credentials: "include",
		});
	},
});

export const client: ContractRouterClient<PortalContract> =
	createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
