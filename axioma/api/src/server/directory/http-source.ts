import { z } from "zod";
import { env } from "@/env";

const person = z.object({
	externalId: z.string().trim().min(1),
	email: z.email(),
	name: z.string().trim().min(1),
	jobTitle: z.string().nullable().default(null),
	department: z.string().nullable().default(null),
	managerExternalId: z.string().nullable().default(null),
});
const responseBody = z.union([
	z.array(person),
	z.object({ people: z.array(person) }).transform(({ people }) => people),
]);

export async function fetchHttpDirectoryPeople(
	urlText: string,
	providerId: string,
	token?: string,
) {
	const url = new URL(urlText);
	url.searchParams.set("providerId", providerId);
	const response = await fetch(url, {
		headers: token ? { authorization: `Bearer ${token}` } : undefined,
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok)
		throw new Error(`Directory source returned ${response.status}`);
	return responseBody.parse(await response.json());
}

export function fetchDirectoryPeople(providerId: string) {
	if (!env.AXIOMA_DIRECTORY_SOURCE_URL)
		throw new Error("AXIOMA_DIRECTORY_SOURCE_URL is not configured");
	return fetchHttpDirectoryPeople(
		env.AXIOMA_DIRECTORY_SOURCE_URL,
		providerId,
		env.AXIOMA_DIRECTORY_SOURCE_TOKEN,
	);
}
