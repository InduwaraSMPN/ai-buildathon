import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

/**
 * The environment routing allowlist.
 *
 * Kept visually apart from field mapping because the two are not the same kind
 * of configuration: a wrong field mapping produces a mislabelled ticket, a
 * wrong route produces a write against the wrong cluster. The environment side
 * is a select over the environments that exist, so a route naming one that
 * does not cannot be entered — and the resolver ignores such a route anyway,
 * which is belt and braces on purpose.
 */
export function RouteEditor({
	connectorId,
	defaultEnvironmentKey,
	defaultEnvironmentMode,
}: {
	connectorId: string;
	defaultEnvironmentKey: string;
	defaultEnvironmentMode: string;
}) {
	const queryClient = useQueryClient();
	const routes = useQuery(
		orpc.listEnvironmentRoutes.queryOptions({ input: { connectorId } }),
	);
	const environments = useQuery(orpc.listEnvironments.queryOptions({}));
	const [draft, setDraft] = useState({
		sourceField: "assignment_group",
		sourceValue: "",
		environmentId: "",
	});

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.listEnvironmentRoutes.key(),
		});

	const upsert = useMutation(
		orpc.upsertEnvironmentRoute.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setDraft((current) => ({ ...current, sourceValue: "" }));
				toast.success("Route saved");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		orpc.deleteEnvironmentRoute.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Route removed");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const rows = routes.data ?? [];

	return (
		<div className="flex flex-col gap-3">
			<p className="text-muted-foreground text-sm">
				Unmatched tickets resolve to{" "}
				<Badge tone={defaultEnvironmentMode === "shadow" ? "info" : "warning"}>
					{defaultEnvironmentKey} · {defaultEnvironmentMode}
				</Badge>
				. Adding a route pointing at an acting environment is what graduates one
				slice of traffic — everything else keeps falling through to the default.
			</p>

			{rows.length ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Order</TableHead>
							<TableHead>Foreign field</TableHead>
							<TableHead>Value</TableHead>
							<TableHead>Environment</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((route) => (
							<TableRow key={route.id}>
								<TableCell>{route.position}</TableCell>
								<TableCell className="font-mono text-xs">
									{route.sourceField}
								</TableCell>
								<TableCell>{route.sourceValue}</TableCell>
								<TableCell>
									<Badge
										tone={
											route.environmentMode === "shadow" ? "info" : "warning"
										}
									>
										{route.environmentKey} · {route.environmentMode}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									<Button
										size="sm"
										variant="ghost"
										disabled={remove.isPending}
										onClick={() => remove.mutate({ routeId: route.id })}
									>
										Remove
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<p className="text-muted-foreground text-sm">
					No routes. Every synced ticket resolves to the default.
				</p>
			)}

			<div className="flex flex-wrap items-end gap-2 border p-3">
				<label className="flex flex-col gap-1 text-xs">
					Foreign field
					<Input
						value={draft.sourceField}
						onChange={(event) =>
							setDraft({ ...draft, sourceField: event.target.value })
						}
						className="w-48"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Value
					<Input
						value={draft.sourceValue}
						onChange={(event) =>
							setDraft({ ...draft, sourceValue: event.target.value })
						}
						placeholder="Checkout Platform"
						className="w-48"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Environment
					<NativeSelect
						value={draft.environmentId}
						onChange={(event) =>
							setDraft({ ...draft, environmentId: event.target.value })
						}
						className="w-48"
					>
						<NativeSelectOption value="">Choose…</NativeSelectOption>
						{(environments.data ?? []).map((environment) => (
							<NativeSelectOption key={environment.id} value={environment.id}>
								{environment.key} · {environment.mode}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</label>
				<Button
					size="sm"
					disabled={
						upsert.isPending ||
						!draft.sourceField ||
						!draft.sourceValue ||
						!draft.environmentId
					}
					onClick={() =>
						upsert.mutate({
							connectorId,
							...draft,
							position: rows.length * 10,
						})
					}
				>
					Add route
				</Button>
			</div>
		</div>
	);
}
