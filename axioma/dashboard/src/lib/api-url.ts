import { env } from "@/env";

export const apiUrl = (path: string) =>
	new URL(path, `${env.VITE_SERVER_URL.replace(/\/$/, "")}/`).toString();
