import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	// 3003, and strict: the API hard-binds 3000, and without strictPort Vite
	// silently walked onto the portal's and dashboard's ports instead of
	// failing. In the reverse order web won 3000 and the API died with
	// EADDRINUSE, which surfaced only as "api never became ready".
	server: { port: 3003, strictPort: true },
	plugins: [tailwindcss(), tanstackStart(), nitro(), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
