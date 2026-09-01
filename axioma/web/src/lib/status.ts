import { createServerFn } from "@tanstack/react-start";

export type StatusDay = { date: string; availability: number };

export type ServiceStatus = {
	id: string;
	name: string;
	days: StatusDay[];
	uptime: { 7: number; 30: number; 90: number };
};

const API_URL = () =>
	process.env.AXIOMA_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

function isDay(value: unknown): value is StatusDay {
	if (typeof value !== "object" || value === null) return false;
	const day = value as Record<string, unknown>;
	return (
		typeof day.date === "string" &&
		typeof day.availability === "number" &&
		day.availability >= 0 &&
		day.availability <= 1
	);
}

function isService(value: unknown): value is ServiceStatus {
	if (typeof value !== "object" || value === null) return false;
	const service = value as Record<string, unknown>;
	const uptime = service.uptime as Record<string, unknown> | undefined;
	return (
		typeof service.id === "string" &&
		typeof service.name === "string" &&
		Array.isArray(service.days) &&
		service.days.every(isDay) &&
		typeof uptime === "object" &&
		uptime !== null &&
		([7, 30, 90] as const).every((window) => typeof uptime[window] === "number")
	);
}

export const fetchStatus = createServerFn({ method: "GET" }).handler(
	async (): Promise<ServiceStatus[] | null> => {
		try {
			const response = await fetch(`${API_URL()}/api-reference/readStatus`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ days: 90 }),
			});
			if (!response.ok) {
				return null;
			}
			const payload: unknown = await response.json();
			if (!Array.isArray(payload) || !payload.every(isService)) {
				return null;
			}
			return payload;
		} catch {
			return null;
		}
	},
);
