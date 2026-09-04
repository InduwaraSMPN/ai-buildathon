import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api-url";
import type { AppContract } from "@/sdk/contracts";

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				toast.error(`Error: ${error.message}`, {
					id: `query-error:${query.queryHash}`,
					action: {
						label: "retry",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
		// A mutation without its own handler would otherwise fail in silence — an
		// operator reading a rejected approval as recorded. React Query runs this
		// alongside a local `onError`, so those are left to report it themselves
		// rather than toasting the same failure twice.
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				if (mutation.options.onError) return;
				toast.error(error.message);
			},
		}),
	});
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

export const client: ContractRouterClient<AppContract> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
