import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { orpc } from "@/utils/orpc";

/**
 * Creating a connector.
 *
 * The client secret is a write-only field: it is sent, never read back, and no
 * procedure returns it. On edit it is left blank to keep the stored value,
 * which is why the label says so rather than leaving an empty box looking like
 * a cleared credential.
 *
 * The default environment is chosen from the environments that exist, and its
 * mode is shown beside it. Pointing the default at a shadow environment is the
 * difference between an unmapped ticket resolving to too little access and too
 * much, so the consequence is stated at the point of the choice rather than in
 * documentation nobody opens.
 */
export function ConnectorForm() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const environments = useQuery(orpc.listEnvironments.queryOptions({}));

	const [form, setForm] = useState({
		key: "",
		label: "",
		baseUrl: "",
		clientId: "",
		clientSecret: "",
		recordFilter: "",
		defaultEnvironmentId: "",
		fallbackReporterId: "",
	});

	const create = useMutation(
		orpc.createConnector.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listConnectors.key(),
				});
				toast.success("Connector created. Test the credential before syncing.");
				setOpen(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const set = (key: keyof typeof form) => (value: string) =>
		setForm((current) => ({ ...current, [key]: value }));

	const chosen = (environments.data ?? []).find(
		(environment) => environment.id === form.defaultEnvironmentId,
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm">Add connector</Button>} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add an ITSM connector</DialogTitle>
					<DialogDescription>
						Axiōma polls the customer's instance outbound. No inbound firewall
						change is needed, and no ITSM credential is ever reachable from a
						tool the agent selects.
					</DialogDescription>
				</DialogHeader>

				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="connector-key">Key</FieldLabel>
						<Input
							id="connector-key"
							value={form.key}
							onChange={(event) => set("key")(event.target.value)}
							placeholder="acme-servicenow"
						/>
						<FieldDescription>
							Stable identifier. Not shown to end users.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-label">Label</FieldLabel>
						<Input
							id="connector-label"
							value={form.label}
							onChange={(event) => set("label")(event.target.value)}
							placeholder="Acme ServiceNow"
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-url">Instance URL</FieldLabel>
						<Input
							id="connector-url"
							value={form.baseUrl}
							onChange={(event) => set("baseUrl")(event.target.value)}
							placeholder="https://acme.service-now.com"
						/>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-client">OAuth client ID</FieldLabel>
						<Input
							id="connector-client"
							value={form.clientId}
							onChange={(event) => set("clientId")(event.target.value)}
						/>
						<FieldDescription>
							Client credentials grant, registered as a confidential client. The
							service user needs read on the incident table and insert on
							sys_journal_field — nothing more for a shadow trial.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-secret">
							OAuth client secret
						</FieldLabel>
						<Input
							id="connector-secret"
							type="password"
							autoComplete="off"
							value={form.clientSecret}
							onChange={(event) => set("clientSecret")(event.target.value)}
						/>
						<FieldDescription>
							Stored encrypted and never returned by any screen or API.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-environment">
							Default environment
						</FieldLabel>
						<NativeSelect
							id="connector-environment"
							value={form.defaultEnvironmentId}
							onChange={(event) =>
								set("defaultEnvironmentId")(event.target.value)
							}
						>
							<NativeSelectOption value="">Choose…</NativeSelectOption>
							{(environments.data ?? []).map((environment) => (
								<NativeSelectOption key={environment.id} value={environment.id}>
									{environment.key} · {environment.mode}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<FieldDescription>
							{chosen?.mode === "act"
								? "This environment acts. Any ticket that matches no routing rule will be worked for real — point the default at a shadow environment unless that is what you intend."
								: "Anything that matches no routing rule resolves here. A shadow default means an unmapped ticket gets too little access rather than too much."}
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-reporter">
							Fallback reporter
						</FieldLabel>
						<Input
							id="connector-reporter"
							value={form.fallbackReporterId}
							onChange={(event) =>
								set("fallbackReporterId")(event.target.value)
							}
						/>
						<FieldDescription>
							Used only when a foreign requester cannot be matched by email.
							Every synced ticket must land on a real user.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel htmlFor="connector-filter">Record filter</FieldLabel>
						<Input
							id="connector-filter"
							value={form.recordFilter}
							onChange={(event) => set("recordFilter")(event.target.value)}
							placeholder="active=true^assignment_group=Service Desk"
						/>
						<FieldDescription>
							Vendor-native query narrowing which records this connector owns.
							Leave empty to take every changed incident.
						</FieldDescription>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						disabled={
							create.isPending ||
							!form.key ||
							!form.label ||
							!form.baseUrl ||
							!form.clientId ||
							!form.clientSecret ||
							!form.defaultEnvironmentId ||
							!form.fallbackReporterId
						}
						onClick={() =>
							create.mutate({
								...form,
								vendor: "servicenow",
								pollIntervalSeconds: 120,
								createCeiling: 50,
								dispatchCeiling: 3,
							})
						}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
