import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "@/auth";
import { env } from "@/env";
import { bootstrapAdministrator } from "@/server/authorization";
import { createContext } from "@/server/context";
import { documentHttp } from "@/server/documents/http";
import { grpcGateway } from "@/server/grpc";
import { sweepKnowledgeGaps } from "@/server/knowledge/gaps";
import { mailHttp } from "@/server/mail/http";
import { createHttpMailProvider } from "@/server/mail/http-provider";
import {
	closeMailRuntime,
	configureMailRuntime,
	startMailRuntime,
} from "@/server/mail/runtime";
import { appRouter } from "@/server/routers/index";
import {
	closeRecurrenceSweep,
	startRecurrenceSweep,
} from "@/server/scheduling-runtime";

if (env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL) {
	const found = await bootstrapAdministrator(env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL);
	console.log(
		found
			? `[auth] bootstrapped administrator ${env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL}`
			: `[auth] bootstrap account not found: ${env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL}`,
	);
}

export const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN.split(","),
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api", documentHttp);
app.route("/api", mailHttp);

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	let context: Awaited<ReturnType<typeof createContext>>;
	try {
		context = await createContext({ context: c });
	} catch (error) {
		const code =
			error instanceof Error && "code" in error
				? (error as { code?: unknown }).code
				: undefined;
		if (code === "TOO_MANY_REQUESTS") {
			const retryAfterMs = Number(
				(error as { data?: { retryAfterMs?: number } }).data?.retryAfterMs ??
					1_000,
			);
			return c.json(
				{
					code,
					message: error instanceof Error ? error.message : String(error),
				},
				429,
				{ "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
			);
		}
		if (code === "UNAUTHORIZED")
			return c.json(
				{
					code,
					message: error instanceof Error ? error.message : "Unauthorized",
				},
				401,
			);
		throw error;
	}

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => {
	return c.text("OK");
});

import { serve } from "@hono/node-server";

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);

if (env.AXIOMA_MAIL_OUTBOUND_URL)
	configureMailRuntime({
		outbound: createHttpMailProvider(
			env.AXIOMA_MAIL_OUTBOUND_URL,
			env.AXIOMA_MAIL_OUTBOUND_TOKEN,
		),
	});
await Promise.all([grpcGateway.listen(), startMailRuntime()]);
startRecurrenceSweep();
const knowledgeGapSweep = setInterval(
	() =>
		sweepKnowledgeGaps().catch((error) =>
			console.error("[knowledge] gap sweep failed", error),
		),
	24 * 60 * 60_000,
);
void sweepKnowledgeGaps().catch((error) =>
	console.error("[knowledge] initial gap sweep failed", error),
);
knowledgeGapSweep.unref();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		clearInterval(knowledgeGapSweep);
		closeRecurrenceSweep();
		void Promise.all([grpcGateway.close(), closeMailRuntime()]).finally(() =>
			process.exit(0),
		);
	});
}
