import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { PageState } from "@/components/support-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { client } from "@/utils/orpc";

type Role = Awaited<ReturnType<typeof client.listRoles>>[number];
type Capability = Role["capabilities"][number];
type Team = Awaited<ReturnType<typeof client.listTeams>>[number];

export function RolesPage() {
	const queryClient = useQueryClient();
	const [departmentName, setDepartmentName] = useState("");
	const [teamName, setTeamName] = useState("");
	const [departmentOpen, setDepartmentOpen] = useState(false);
	const [teamOpen, setTeamOpen] = useState(false);
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
	const roleRows = roles.data ?? [];
	const peopleRows = people.data ?? [];
	const teamRows = teams.data ?? [];
	const departmentRows = departments.data ?? [];
	const capabilityRows = capabilities.data ?? [];
	return (
		<PageContainer
			title="Identity administration"
			description="Manage access, people and organization structure."
		>
			<section className="space-y-3">
				<h2 className="font-semibold">Role capabilities</h2>
				<Card>
<CardContent className="px-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Capability</TableHead>
								{roleRows.map((role) => (
									<TableHead key={role.id}>{role.name}</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{capabilityRows.map((capability) => (
								<TableRow key={capability}>
									<TableCell className="font-mono">{capability}</TableCell>
									{roleRows.map((role) => (
										<TableCell key={role.id}>
											<Checkbox
												aria-label={`${capability} for ${role.name}`}
												checked={role.capabilities.includes(capability)}
												disabled={updateRole.isPending}
												onCheckedChange={(checked) =>
													updateRole.mutate({
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
</CardContent>
</Card>
			</section>
			<section className="space-y-3">
				<h2 className="font-semibold">People</h2>
				<Card>
<CardContent className="px-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Person</TableHead>
								<TableHead>Kind</TableHead>
								{roleRows.map((role) => (
									<TableHead key={role.id}>{role.name}</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{peopleRows.map((person) => (
								<TableRow key={person.id}>
									<TableCell>
										{person.name}
										<div className="text-muted-foreground text-xs">
											{person.email}
										</div>
									</TableCell>
									<TableCell>
										<NativeSelect
											size="sm"
											value={person.kind}
											disabled={setKind.isPending}
											onChange={(event) =>
												setKind.mutate({
													userId: person.id,
													kind: event.target.value as "staff" | "reporter",
												})
											}
										>
											<NativeSelectOption value="reporter">
												Reporter
											</NativeSelectOption>
											<NativeSelectOption value="staff">
												Staff
											</NativeSelectOption>
										</NativeSelect>
									</TableCell>
									{roleRows.map((role) => (
										<TableCell key={role.id}>
											<Checkbox
												aria-label={`${role.name} for ${person.name}`}
												checked={person.roleIds.includes(role.id)}
												onCheckedChange={(assigned) =>
													assignRole.mutate({
														roleId: role.id,
														targetType: "user",
														targetId: person.id,
														assigned: assigned === true,
													})
												}
											/>
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
</CardContent>
</Card>
			</section>
			<section className="space-y-3">
				<h2 className="font-semibold">Departments</h2>
				<Dialog open={departmentOpen} onOpenChange={setDepartmentOpen}>
					<DialogTrigger
						render={<Button size="sm">New department</Button>}
					/>
					<DialogContent className="sm:max-w-md">
						<form
							onSubmit={(event) => {
								event.preventDefault();
								createDepartment.mutate();
								setDepartmentOpen(false);
							}}
						>
							<DialogHeader>
								<DialogTitle>New department</DialogTitle>
								<DialogDescription>
									Departments group the teams that own work.
								</DialogDescription>
							</DialogHeader>
							<FieldGroup className="py-4">
								<Field>
									<FieldLabel htmlFor="department-name">
										Department name
									</FieldLabel>
									<Input
										id="department-name"
										value={departmentName}
										onChange={(event) => setDepartmentName(event.target.value)}
										required
									/>
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setDepartmentOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={createDepartment.isPending}>
									Create department
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
				<div className="text-sm">
					{departmentRows.map((department) => department.name).join(", ") ||
						"No departments"}
				</div>
			</section>
			<section className="space-y-3">
				<h2 className="font-semibold">Teams</h2>
				<Dialog open={teamOpen} onOpenChange={setTeamOpen}>
					<DialogTrigger render={<Button size="sm">New team</Button>} />
					<DialogContent className="sm:max-w-md">
						<form
							onSubmit={(event) => {
								event.preventDefault();
								createTeam.mutate();
								setTeamOpen(false);
							}}
						>
							<DialogHeader>
								<DialogTitle>New team</DialogTitle>
								<DialogDescription>
									Teams own tickets and appear as assignment targets.
								</DialogDescription>
							</DialogHeader>
							<FieldGroup className="py-4">
								<Field>
									<FieldLabel htmlFor="team-name">Team name</FieldLabel>
									<Input
										id="team-name"
										value={teamName}
										onChange={(event) => setTeamName(event.target.value)}
										required
									/>
								</Field>
							</FieldGroup>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => setTeamOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={createTeam.isPending}>
									Create team
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
				<Card>
<CardContent className="px-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Team</TableHead>
								<TableHead>Department</TableHead>
								{peopleRows.map((person) => (
									<TableHead key={person.id}>{person.name}</TableHead>
								))}
								{roleRows.map((role) => (
									<TableHead key={role.id}>{role.name}</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{teamRows.map((team) => (
								<TableRow key={team.id}>
									<TableCell>{team.name}</TableCell>
									<TableCell>
										<NativeSelect
											size="sm"
											value={team.departmentId ?? ""}
											disabled={updateTeam.isPending}
											onChange={(event) =>
												updateTeam.mutate({
													...team,
													departmentId: event.target.value || null,
												})
											}
										>
											<NativeSelectOption value="">None</NativeSelectOption>
											{departmentRows.map((department) => (
												<NativeSelectOption
													key={department.id}
													value={department.id}
												>
													{department.name}
												</NativeSelectOption>
											))}
										</NativeSelect>
									</TableCell>
									{peopleRows.map((person) => (
										<TableCell key={person.id}>
											<Checkbox
												aria-label={`${person.name} in ${team.name}`}
												checked={team.memberIds.includes(person.id)}
												onCheckedChange={(checked) =>
													updateTeam.mutate({
														...team,
														memberIds: checked
															? [...team.memberIds, person.id]
															: team.memberIds.filter((id) => id !== person.id),
													})
												}
											/>
										</TableCell>
									))}
									{roleRows.map((role) => (
										<TableCell key={role.id}>
											<Checkbox
												aria-label={`${role.name} for ${team.name}`}
												checked={team.roleIds.includes(role.id)}
												onCheckedChange={(checked) =>
													updateTeam.mutate({
														...team,
														roleIds: checked
															? [...team.roleIds, role.id]
															: team.roleIds.filter((id) => id !== role.id),
													})
												}
											/>
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
</CardContent>
</Card>
			</section>
		</PageContainer>
	);
}
