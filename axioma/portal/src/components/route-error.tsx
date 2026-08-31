import { useRouter } from "@tanstack/react-router";
import { ErrorState, PageShell } from "@/components/ticket-ui";

export function RouteError({ error }: { error?: Error | null }) {
	const router = useRouter();
	return (
		<PageShell>
			<ErrorState retry={() => router.invalidate()} error={error} />
		</PageShell>
	);
}
