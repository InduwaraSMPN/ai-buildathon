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
import { ITSM_MAPPABLE_FIELDS, ITSM_UNMAPPED_POLICIES } from "@/sdk/shared";
import { orpc } from "@/utils/orpc";

/**
 * Field and value mapping.
 *
 * The target is a select over the mappable fields, so an invalid target is
 * unrepresentable rather than merely rejected. `priority` is deliberately
 * absent from that vocabulary — it is derived from impact and urgency, so
 * offering it would let an administrator configure something the system cannot
 * honour. The note below says so, because an absent option with no explanation
 * looks like an oversight.
 *
 * Value maps are entered as `foreign = ours` lines. A free-text pair list beats
 * a row-per-value form here: a real status vocabulary is a dozen entries and
 * pasting them is faster than twelve clicks.
 */
function parseValueMap(text: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const [from, ...rest] = line.split("=");
		const to = rest.join("=").trim();
		if (!from?.trim() || !to) continue;
		map[from.trim()] = to;
	}
	return map;
}

const formatValueMap = (map: Record<string, string>) =>
	Object.entries(map)
		.map(([from, to]) => `${from} = ${to}`)
		.join("\n");

export function MappingEditor({ connectorId }: { connectorId: string }) {
	const queryClient = useQueryClient();
	const mappings = useQuery(
		orpc.listFieldMappings.queryOptions({ input: { connectorId } }),
	);
	const [draft, setDraft] = useState({
		sourceField: "",
		targetField: "status" as (typeof ITSM_MAPPABLE_FIELDS)[number],
		valueMap: "",
		onUnmapped: "quarantine" as (typeof ITSM_UNMAPPED_POLICIES)[number],
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.listFieldMappings.key() });

	const upsert = useMutation(
		orpc.upsertFieldMapping.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setDraft({ ...draft, sourceField: "", valueMap: "" });
				toast.success("Mapping saved");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		orpc.deleteFieldMapping.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Mapping removed");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const rows = mappings.data ?? [];

	return (
		<div className="flex flex-col gap-3">
			<p className="text-muted-foreground text-sm">
				Priority is not in this list because it cannot be mapped: it is derived
				from impact and urgency, so a foreign priority has to be mapped into
				those two and re-derived. The result will not always equal the foreign
				value. Status is open vocabulary — add the customer's status names to
				the status table and map onto them.
			</p>

			{rows.length ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Foreign field</TableHead>
							<TableHead>Our field</TableHead>
							<TableHead>Values</TableHead>
							<TableHead>Unmapped</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((mapping) => (
							<TableRow key={mapping.id}>
								<TableCell className="font-mono text-xs">
									{mapping.sourceField}
								</TableCell>
								<TableCell>{mapping.targetField}</TableCell>
								<TableCell className="text-muted-foreground text-xs">
									{formatValueMap(mapping.valueMap) || "—"}
								</TableCell>
								<TableCell>
									<Badge variant="secondary">{mapping.onUnmapped}</Badge>
								</TableCell>
								<TableCell className="text-right">
									<Button
										size="sm"
										variant="ghost"
										disabled={remove.isPending}
										onClick={() => remove.mutate({ mappingId: mapping.id })}
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
					No field mappings. Every synced ticket takes our defaults.
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
						placeholder="state"
						className="w-40"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Our field
					<NativeSelect
						value={draft.targetField}
						onChange={(event) =>
							setDraft({
								...draft,
								targetField: event.target
									.value as (typeof ITSM_MAPPABLE_FIELDS)[number],
							})
						}
						className="w-44"
					>
						{ITSM_MAPPABLE_FIELDS.map((field) => (
							<NativeSelectOption key={field} value={field}>
								{field}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Values, one per line as `foreign = ours`
					<textarea
						value={draft.valueMap}
						onChange={(event) =>
							setDraft({ ...draft, valueMap: event.target.value })
						}
						placeholder={"Resolved = resolved\nClosed Complete = closed"}
						rows={3}
						className="w-72 border bg-transparent p-2 font-mono text-xs"
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					Unmapped value
					<NativeSelect
						value={draft.onUnmapped}
						onChange={(event) =>
							setDraft({
								...draft,
								onUnmapped: event.target
									.value as (typeof ITSM_UNMAPPED_POLICIES)[number],
							})
						}
						className="w-40"
					>
						{ITSM_UNMAPPED_POLICIES.map((policy) => (
							<NativeSelectOption key={policy} value={policy}>
								{policy}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</label>
				<Button
					size="sm"
					disabled={upsert.isPending || !draft.sourceField}
					onClick={() =>
						upsert.mutate({
							connectorId,
							sourceField: draft.sourceField,
							targetField: draft.targetField,
							valueMap: parseValueMap(draft.valueMap),
							onUnmapped: draft.onUnmapped,
							defaultValue: null,
						})
					}
				>
					Save mapping
				</Button>
			</div>
			<p className="text-muted-foreground text-xs">
				`quarantine` keeps a ticket whose value has no mapping and tells you
				what to fix. `reject` loses it; `default` lies about it.
			</p>
		</div>
	);
}
