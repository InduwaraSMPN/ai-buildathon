import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { client } from "@/utils/orpc";

const capabilities = [
	"ticket.read.own",
	"ticket.read.all",
	"ticket.create",
	"ticket.update",
	"ticket.resolve",
	"ticket.close",
	"ticket.escalate",
	"ticket.reclassify",
	"ticket.assign",
	"ticket.reopen",
	"run.start",
	"run.cancel",
	"run.read",
	"device.read",
	"device.enroll",
	"device.command",
	"stats.read",
	"problem.manage",
	"change.manage",
	"change.approve",
	"knowledge.read",
	"knowledge.manage",
	"approval.read",
	"approval.decide",
	"catalogue.manage",
	"admin.roles",
	"admin.settings",
] as const;

type Role = Awaited<ReturnType<typeof client.listRoles>>[number];
type Capability = (typeof capabilities)[number];

export function RolesPage() {
	const queryClient = useQueryClient();
	const roles = useQuery({
		queryKey: ["roles"],
		queryFn: () => client.listRoles(),
	});
	const update = useMutation({
		mutationFn: (input: { roleId: string; capabilities: Capability[] }) =>
			client.updateRoleCapabilities(input),
		onSuccess: (role) => {
			queryClient.setQueryData<Role[]>(["roles"], (current = []) =>
				current.map((item) => (item.id === role.id ? role : item)),
			);
			toast.success("Role updated");
		},
		onError: (error) => toast.error(error.message),
	});
	if (roles.isPending)
		return (
			<PageContainer title="Roles">
				<PageState
					kind="loading"
					title="Loading roles"
					description="Retrieving capability grants…"
				/>
			</PageContainer>
		);
	if (roles.isError)
		return (
			<PageContainer title="Roles">
				<PageState
					kind="error"
					title="Roles unavailable"
					description={roles.error.message}
					onRetry={() => roles.refetch()}
				/>
			</PageContainer>
		);
	return (
		<PageContainer
			title="Roles"
			description="Capabilities granted to each platform role."
		>
			<div className="rounded-xl border bg-card shadow-sm">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="sticky left-0 bg-card">
								Capability
							</TableHead>
							{roles.data.map((role) => (
								<TableHead key={role.id}>{role.name}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{capabilities.map((capability) => (
							<TableRow key={capability}>
								<TableCell className="sticky left-0 bg-card font-mono">
									{capability}
								</TableCell>
								{roles.data.map((role) => (
									<TableCell key={role.id}>
										<Checkbox
											aria-label={`${capability} for ${role.name}`}
											checked={role.capabilities.includes(capability)}
											disabled={update.isPending}
											onCheckedChange={(checked) =>
												update.mutate({
													roleId: role.id,
													capabilities: checked
														? [...role.capabilities, capability]
														: role.capabilities.filter(
																(item) => item !== capability,
															),
												})
											}
										/>
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</PageContainer>
	);
}
