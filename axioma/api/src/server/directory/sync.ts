export const DIRECTORY_SHRINK_PERCENT = 40;

export type DirectoryPerson = {
	externalId: string;
	email: string;
	name: string;
	jobTitle: string | null;
	department: string | null;
	managerExternalId: string | null;
	kind: "staff" | "reporter";
};

export type CurrentDirectoryPerson = DirectoryPerson & {
	userId: string;
	leaver: boolean;
};

export type DirectorySyncChange =
	| { kind: "create"; person: DirectoryPerson }
	| { kind: "update"; userId: string; person: DirectoryPerson }
	| { kind: "mark_leaver"; userId: string; externalId: string };

export type DirectorySyncPlan = {
	previousCount: number;
	foundCount: number;
	createdCount: number;
	updatedCount: number;
	leaverCount: number;
	changes: DirectorySyncChange[];
};

export class DirectoryShrinkError extends Error {
	constructor(
		readonly previousCount: number,
		readonly foundCount: number,
	) {
		super(
			`Directory sync refused: found ${foundCount} people, ${previousCount - foundCount} fewer than the previous ${previousCount} (40% safety brake).`,
		);
		this.name = "DirectoryShrinkError";
	}
}

const normalize = (person: DirectoryPerson): DirectoryPerson => ({
	...person,
	email: person.email.trim().toLowerCase(),
	name: person.name.trim(),
});

const samePerson = (left: DirectoryPerson, right: DirectoryPerson) =>
	left.externalId === right.externalId &&
	left.email === right.email &&
	left.name === right.name &&
	left.jobTitle === right.jobTitle &&
	left.department === right.department &&
	left.managerExternalId === right.managerExternalId &&
	left.kind === right.kind;

export function calculateDirectorySync(
	current: CurrentDirectoryPerson[],
	incomingPeople: DirectoryPerson[],
	previousCount: number,
): DirectorySyncPlan {
	const incoming = incomingPeople.map(normalize);
	const byExternalId = new Map<string, CurrentDirectoryPerson>();
	const byEmail = new Map<string, CurrentDirectoryPerson>();
	for (const person of current) {
		const email = person.email.toLowerCase();
		if (byExternalId.has(person.externalId) || byEmail.has(email))
			throw new Error("Stored directory contains duplicate identities");
		byExternalId.set(person.externalId, person);
		byEmail.set(email, person);
	}
	if (
		new Set(incoming.map((person) => person.externalId)).size !==
			incoming.length ||
		new Set(incoming.map((person) => person.email)).size !== incoming.length
	)
		throw new Error(
			"Directory sync contains duplicate external IDs or email addresses",
		);
	for (const person of incoming) {
		const externalMatch = byExternalId.get(person.externalId);
		const emailMatch = byEmail.get(person.email);
		if (
			externalMatch &&
			emailMatch &&
			externalMatch.userId !== emailMatch.userId
		)
			throw new Error(
				"Directory identity conflicts with an existing email address",
			);
	}

	const foundCount = incoming.length;
	if (previousCount > 0 && foundCount * 5 <= previousCount * 3)
		throw new DirectoryShrinkError(previousCount, foundCount);

	const matchedUserIds = new Set<string>();
	const changes: DirectorySyncChange[] = [];
	for (const person of incoming) {
		const existing =
			byExternalId.get(person.externalId) ?? byEmail.get(person.email);
		if (!existing) {
			changes.push({ kind: "create", person });
			continue;
		}
		matchedUserIds.add(existing.userId);
		if (existing.leaver || !samePerson(normalize(existing), person))
			changes.push({ kind: "update", userId: existing.userId, person });
	}
	for (const person of current)
		if (!person.leaver && !matchedUserIds.has(person.userId))
			changes.push({
				kind: "mark_leaver",
				userId: person.userId,
				externalId: person.externalId,
			});

	return {
		previousCount,
		foundCount,
		createdCount: changes.filter((change) => change.kind === "create").length,
		updatedCount: changes.filter((change) => change.kind === "update").length,
		leaverCount: changes.filter((change) => change.kind === "mark_leaver")
			.length,
		changes,
	};
}

export type DirectorySyncStore = {
	current(): Promise<CurrentDirectoryPerson[]>;
	lastSuccessfulCount(): Promise<number>;
	apply(plan: DirectorySyncPlan): Promise<void>;
};

export async function syncDirectory(
	store: DirectorySyncStore,
	incoming: DirectoryPerson[],
	mode: "preview" | "apply",
): Promise<DirectorySyncPlan> {
	const plan = calculateDirectorySync(
		await store.current(),
		incoming,
		await store.lastSuccessfulCount(),
	);
	if (mode === "apply") await store.apply(plan);
	return plan;
}
