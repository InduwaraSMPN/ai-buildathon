import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { client } from "@/utils/orpc";

type Role = Awaited<ReturnType<typeof client.listRoles>>[number];
type Capability = Role["capabilities"][number];
type Team = Awaited<ReturnType<typeof client.listTeams>>[number];
type Person = Awaited<ReturnType<typeof client.listPeople>>[number];
type Department = Awaited<ReturnType<typeof client.listDepartments>>[number];
type CapabilityRow = { capability: Capability };

export function RolesPage() {
	const queryClient = useQueryClient();
	const [departmentName, setDepartmentName] = useState("");
	const [teamName, setTeamName] = useState("");
	const [panel, setPanel] = useState<
		null | "roles" | "people" | "departments" | "teams"
	>(null);
	const roles = useQuery({
		queryKey: ["roles"],
		queryFn: () => client.listRoles(),
	});
	const capabilities = useQuery({
		queryKey: ["capabilities"],
		queryFn: () => client.listCapabilities(),
	});
	const people = useQuery({
		queryKey: ["admin-people"],
		queryFn: () => client.listPeople(),
	});
	const teams = useQuery({
		queryKey: ["admin-teams"],
		queryFn: () => client.listTeams(),
	});
	const departments = useQuery({
		queryKey: ["admin-departments"],
		queryFn: () => client.listDepartments(),
	});
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["admin-people"] }),
			queryClient.invalidateQueries({ queryKey: ["admin-teams"] }),
			queryClient.invalidateQueries({ queryKey: ["admin-departments"] }),
		]);
	const updateRole = useMutation({
		mutationFn: (input: { roleId: string; capabilities: Capability[] }) =>
			client.updateRoleCapabilities(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["roles"] });
			toast.success("Role updated");
		},
		onError: (error) => toast.error(error.message),
	});
	const assignRole = useMutation({
		mutationFn: (input: Parameters<typeof client.assignRole>[0]) =>
			client.assignRole(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin-people"] });
			void queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
		},
		onError: (error) => toast.error(error.message),
	});
	const setKind = useMutation({
		mutationFn: (input: Parameters<typeof client.setUserKind>[0]) =>
			client.setUserKind(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin-people"] });
			toast.success("User kind updated");
		},
		onError: (error) => toast.error(error.message),
	});
	const createDepartment = useMutation({
		mutationFn: () => client.createDepartment({ name: departmentName }),
		onSuccess: () => {
			setDepartmentName("");
			void queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
		},
		onError: (error) => toast.error(error.message),
	});
	const createTeam = useMutation({
		mutationFn: () =>
			client.createTeam({
				name: teamName,
				departmentId: null,
				memberIds: [],
				roleIds: [],
			}),
		onSuccess: () => {
			setTeamName("");
			void queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
		},
		onError: (error) => toast.error(error.message),
	});
	const updateTeam = useMutation({
		mutationFn: (team: Team) => client.updateTeam(team),
		onSuccess: refresh,
		onError: (error) => toast.error(error.message),
	});
	const roleRows = roles.data ?? [];
	const peopleRows = people.data ?? [];
	const teamRows = teams.data ?? [];
	const departmentRows = departments.data ?? [];
	const capabilityRows = capabilities.data ?? [];

	const roleColumnWidth = useCallback(
		(fixed: number) =>
			roleRows.length ? (100 - fixed) / roleRows.length : undefined,
		[roleRows],
	);
	const capabilityColumns = useMemo<ColumnDef<CapabilityRow, unknown>[]>(
		() => [
			{
				accessorKey: "capability",
				header: "Capability",
				size: 30,
				cell: ({ row }) => (
					<span className="font-mono">{row.original.capability}</span>
				),
			},
			...roleRows.map((role) => ({
				id: role.id,
				header: role.name,
				size: roleColumnWidth(30),
				accessorFn: (row: CapabilityRow) =>
					role.capabilities.includes(row.capability),
				cell: ({ row }: { row: { original: CapabilityRow } }) => (
					<Checkbox
						aria-label={`${row.original.capability} for ${role.name}`}
						checked={role.capabilities.includes(row.original.capability)}
						disabled={updateRole.isPending}
						onCheckedChange={(checked) =>
							updateRole.mutate({
								roleId: role.id,
								capabilities: checked
									? [...role.capabilities, row.original.capability]
									: role.capabilities.filter(
											(item) => item !== row.original.capability,
										),
							})
						}
					/>
				),
			})),
		],
		[roleRows, updateRole, roleColumnWidth],
	);
	const capabilityData = useMemo<CapabilityRow[]>(
		() => capabilityRows.map((capability) => ({ capability })),
		[capabilityRows],
	);

	const peopleColumns = useMemo<ColumnDef<Person, unknown>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Person",
				size: 28,
				cell: ({ row }) => (
					<>
						{row.original.name}
						<div className="text-muted-foreground text-xs">
							{row.original.email}
						</div>
					</>
				),
			},
			{
				accessorKey: "kind",
				header: "Kind",
				size: 14,
				cell: ({ row }) => (
					<NativeSelect
						size="sm"
						value={row.original.kind}
						disabled={setKind.isPending}
						onChange={(event) =>
							setKind.mutate({
								userId: row.original.id,
								kind: event.target.value as "staff" | "reporter",
							})
						}
					>
						<NativeSelectOption value="reporter">Reporter</NativeSelectOption>
						<NativeSelectOption value="staff">Staff</NativeSelectOption>
					</NativeSelect>
				),
			},
			...roleRows.map((role) => ({
				id: role.id,
				header: role.name,
				size: roleColumnWidth(42),
				accessorFn: (person: Person) => person.roleIds.includes(role.id),
				cell: ({ row }: { row: { original: Person } }) => (
					<Checkbox
						aria-label={`${role.name} for ${row.original.name}`}
						checked={row.original.roleIds.includes(role.id)}
						onCheckedChange={(assigned) =>
							assignRole.mutate({
								roleId: role.id,
								targetType: "user",
								targetId: row.original.id,
								assigned: assigned === true,
							})
						}
					/>
				),
			})),
		],
		[roleRows, assignRole, setKind, roleColumnWidth],
	);

	const departmentColumns = useMemo<ColumnDef<Department, unknown>[]>(
		() => [
			{ accessorKey: "name", header: "Department", size: 60 },
			{
				id: "teams",
				header: "Teams",
				size: 40,
				accessorFn: (department: Department) =>
					teamRows.filter((team) => team.departmentId === department.id).length,
			},
		],
		[teamRows],
	);

	const teamColumns = useMemo<ColumnDef<Team, unknown>[]>(
		() => [
			{ accessorKey: "name", header: "Team", size: 18 },
			{
				id: "department",
				header: "Department",
				size: 20,
				accessorFn: (team: Team) =>
					departmentRows.find(
						(department) => department.id === team.departmentId,
					)?.name ?? "",
				cell: ({ row }) => (
					<NativeSelect
						size="sm"
						value={row.original.departmentId ?? ""}
						disabled={updateTeam.isPending}
						onChange={(event) =>
							updateTeam.mutate({
								...row.original,
								departmentId: event.target.value || null,
							})
						}
					>
						<NativeSelectOption value="">None</NativeSelectOption>
						{departmentRows.map((department) => (
							<NativeSelectOption key={department.id} value={department.id}>
								{department.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				),
			},
			{
				id: "members",
				header: "Members",
				size: 24,
				accessorFn: (team: Team) =>
					peopleRows
						.filter((person) => team.memberIds.includes(person.id))
						.map((person) => person.name)
						.join(", "),
				cell: ({ row }) => (
					<MemberSummary
						names={peopleRows
							.filter((person) => row.original.memberIds.includes(person.id))
							.map((person) => person.name)}
						empty="No members"
					/>
				),
			},
			{
				id: "roles",
				header: "Roles",
				size: 24,
				accessorFn: (team: Team) =>
					roleRows
						.filter((role) => team.roleIds.includes(role.id))
						.map((role) => role.name)
						.join(", "),
				cell: ({ row }) => (
					<MemberSummary
						names={roleRows
							.filter((role) => row.original.roleIds.includes(role.id))
							.map((role) => role.name)}
						empty="No roles"
					/>
				),
			},
			{
				id: "membership",
				header: "Membership",
				size: 14,
				enableSorting: false,
				cell: ({ row }) => (
					<TeamMembershipDialog
						team={row.original}
						people={peopleRows}
						roles={roleRows}
						pending={updateTeam.isPending}
						onChange={(next) => updateTeam.mutate({ ...row.original, ...next })}
					/>
				),
			},
		],
		[departmentRows, peopleRows, roleRows, updateTeam],
	);

	if (
		[roles, capabilities, people, teams, departments].some(
			(query) => query.isPending,
		)
	)
		return (
			<PageContainer title="Identity administration">
				<PageState
					kind="loading"
					title="Loading identity settings"
					description="Retrieving people, roles, teams and departments…"
				/>
			</PageContainer>
		);
	const failed = [roles, capabilities, people, teams, departments].find(
		(query) => query.isError,
	);
	if (failed?.error)
		return (
			<PageContainer title="Identity administration">
				<PageState
					kind="error"
					title="Identity settings unavailable"
					description={failed.error.message}
					onRetry={() => location.reload()}
				/>
			</PageContainer>
		);
	return (
		<PageContainer
			title="Identity administration"
			description="Manage access, people and organization structure."
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<SectionTile
					title="Role capabilities"
					description="Which capabilities each role carries."
					metric={`${roleRows.length} roles · ${capabilityRows.length} capabilities`}
					onOpen={() => setPanel("roles")}
				/>
				<SectionTile
					title="Teams"
					description="Team membership, roles and department."
					metric={`${teamRows.length} teams`}
					onOpen={() => setPanel("teams")}
				/>
				<SectionTile
					title="Departments"
					description="Groups that own the teams."
					metric={`${departmentRows.length} departments`}
					onOpen={() => setPanel("departments")}
				/>
				<SectionTile
					title="People"
					description="Staff, reporters and their roles."
					metric={`${peopleRows.length} people`}
					onOpen={() => setPanel("people")}
				/>
			</div>

			<SectionPanel
				open={panel === "roles"}
				onClose={() => setPanel(null)}
				title="Role capabilities"
				description="Tick a capability to grant it to that role."
			>
				<DataTable
					data={capabilityData}
					columns={capabilityColumns}
					filterPlaceholder="Search capabilities…"
					filterLabel="Search capabilities"
					emptyTitle="No capabilities"
					emptyDescription="Nothing is defined yet."
					pageSize={12}
				/>
			</SectionPanel>

			<SectionPanel
				open={panel === "people"}
				onClose={() => setPanel(null)}
				title="People"
				description="Set whether someone is staff or a reporter, and which roles they hold."
			>
				<DataTable
					data={peopleRows}
					columns={peopleColumns}
					filterPlaceholder="Search people…"
					filterLabel="Search people"
					emptyTitle="No people"
					emptyDescription="Nobody has signed in yet."
					pageSize={12}
				/>
			</SectionPanel>

			<SectionPanel
				open={panel === "departments"}
				onClose={() => setPanel(null)}
				title="Departments"
				description="Departments group the teams that own work."
			>
				<form
					className="flex flex-wrap items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						createDepartment.mutate();
					}}
				>
					<Field className="min-w-56 flex-1">
						<FieldLabel htmlFor="department-name">Department name</FieldLabel>
						<Input
							id="department-name"
							value={departmentName}
							onChange={(event) => setDepartmentName(event.target.value)}
							required
						/>
					</Field>
					<Button type="submit" disabled={createDepartment.isPending}>
						Add department
					</Button>
				</form>
				<DataTable
					data={departmentRows}
					columns={departmentColumns}
					filterPlaceholder="Search departments…"
					filterLabel="Search departments"
					emptyTitle="No departments"
					emptyDescription="No departments yet."
					pageSize={12}
				/>
			</SectionPanel>

			<SectionPanel
				open={panel === "teams"}
				onClose={() => setPanel(null)}
				title="Teams"
				description="Teams own tickets and appear as assignment targets."
			>
				<form
					className="flex flex-wrap items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						createTeam.mutate();
					}}
				>
					<Field className="min-w-56 flex-1">
						<FieldLabel htmlFor="team-name">Team name</FieldLabel>
						<Input
							id="team-name"
							value={teamName}
							onChange={(event) => setTeamName(event.target.value)}
							required
						/>
					</Field>
					<Button type="submit" disabled={createTeam.isPending}>
						Add team
					</Button>
				</form>
				<DataTable
					data={teamRows}
					columns={teamColumns}
					filterPlaceholder="Search teams…"
					filterLabel="Search teams"
					emptyTitle="No teams"
					emptyDescription="No teams yet."
					pageSize={12}
				/>
			</SectionPanel>
		</PageContainer>
	);
}

function SectionTile({
	title,
	description,
	metric,
	onOpen,
}: {
	title: string;
	description: string;
	metric: string;
	onOpen: () => void;
}) {
	return (
		<Card className="transition-colors hover:border-foreground/20">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center justify-between gap-3">
				<span className="text-muted-foreground text-sm">{metric}</span>
				<Button size="sm" variant="outline" onClick={onOpen}>
					More info
				</Button>
			</CardContent>
		</Card>
	);
}

function SectionPanel({
	open,
	onClose,
	title,
	description,
	children,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden sm:max-w-5xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-1 py-2">
					{children}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function MemberSummary({
	names,
	empty,
}: {
	names: readonly string[];
	empty: string;
}) {
	if (names.length === 0)
		return <span className="text-muted-foreground">{empty}</span>;
	const shown = names.slice(0, 2);
	const rest = names.length - shown.length;
	return (
		<span title={names.join(", ")}>
			{shown.join(", ")}
			{rest > 0 ? (
				<span className="text-muted-foreground"> +{rest} more</span>
			) : null}
		</span>
	);
}

function TeamMembershipDialog({
	team,
	people,
	roles,
	pending,
	onChange,
}: {
	team: Team;
	people: readonly { id: string; name: string }[];
	roles: readonly { id: string; name: string }[];
	pending: boolean;
	onChange: (next: { memberIds: string[]; roleIds: string[] }) => void;
}) {
	const [open, setOpen] = useState(false);
	const [memberIds, setMemberIds] = useState<string[]>([]);
	const [roleIds, setRoleIds] = useState<string[]>([]);

	const toggle = (list: string[], id: string, checked: boolean) =>
		checked ? [...list, id] : list.filter((entry) => entry !== id);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) {
					setMemberIds([...team.memberIds]);
					setRoleIds([...team.roleIds]);
				}
				setOpen(next);
			}}
		>
			<DialogTrigger
				render={
					<Button size="sm" variant="outline">
						Manage
					</Button>
				}
			/>
			<DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{team.name} membership</DialogTitle>
					<DialogDescription>
						Choose who belongs to this team and which roles it carries.
					</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-4 pr-1">
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 font-medium text-sm">Members</legend>
						{people.map((person) => (
							<label
								key={person.id}
								className="flex items-center gap-2 text-sm"
								htmlFor={`member-${team.id}-${person.id}`}
							>
								<Checkbox
									id={`member-${team.id}-${person.id}`}
									checked={memberIds.includes(person.id)}
									onCheckedChange={(checked) =>
										setMemberIds(toggle(memberIds, person.id, checked === true))
									}
								/>
								{person.name}
							</label>
						))}
					</fieldset>
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 font-medium text-sm">Roles</legend>
						{roles.map((role) => (
							<label
								key={role.id}
								className="flex items-center gap-2 text-sm"
								htmlFor={`role-${team.id}-${role.id}`}
							>
								<Checkbox
									id={`role-${team.id}-${role.id}`}
									checked={roleIds.includes(role.id)}
									onCheckedChange={(checked) =>
										setRoleIds(toggle(roleIds, role.id, checked === true))
									}
								/>
								{role.name}
							</label>
						))}
					</fieldset>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						disabled={pending}
						onClick={() => {
							onChange({ memberIds, roleIds });
							setOpen(false);
						}}
					>
						Save membership
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
