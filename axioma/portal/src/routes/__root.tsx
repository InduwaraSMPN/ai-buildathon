import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import Loader from "@/components/loader";
import { RouteError } from "@/components/route-error";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "../index.css";

const Devtools = import.meta.env.DEV
	? lazy(async () => {
			const [{ ReactQueryDevtools }, { TanStackRouterDevtools }] =
				await Promise.all([
					import("@tanstack/react-query-devtools"),
					import("@tanstack/react-router-devtools"),
				]);

			return {
				default: function Devtools() {
					return (
						<>
							{/* <TanStackRouterDevtools position="bottom-left" /> */}
							{/* <ReactQueryDevtools
								position="bottom"
								buttonPosition="bottom-right"
							/> */}
						</>
					);
				},
			};
		})
	: null;

export interface RouterAppContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	pendingComponent: Loader,
	errorComponent: RouteError,
	head: () => ({
		meta: [
			{
				title: "Axiōma · Employee support",
			},
			{
				name: "description",
				content: "Get workplace support and follow your requests in one place.",
			},
			// A single meta value cannot follow the active theme; use the light --primary.
			{ name: "theme-color", content: "#008236" },
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
			{
				rel: "icon",
				href: "/favicon-32x32.png",
				type: "image/png",
				sizes: "32x32",
			},
			{
				rel: "icon",
				href: "/favicon-16x16.png",
				type: "image/png",
				sizes: "16x16",
			},
			{ rel: "shortcut icon", href: "/favicon.ico" },
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png",
				sizes: "180x180",
			},
			{ rel: "manifest", href: "/site.webmanifest" },
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<div className="h-svh">
					<Outlet />
				</div>
				<Toaster richColors />
			</ThemeProvider>
			{Devtools ? (
				<Suspense fallback={null}>
					<Devtools />
				</Suspense>
			) : null}
		</>
	);
}
