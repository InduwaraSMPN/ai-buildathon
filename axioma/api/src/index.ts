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
import { createContext } from "@/server/context";
import { grpcGateway } from "@/server/grpc";
import { appRouter } from "@/server/routers/index";

const app = new Hono();

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

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

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
	const context = await createContext({ context: c });

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

// Minimal operator hook for exercising the device boundary without giving Axel
// database or device access. Production dispatch will be driven by ticket runs.
app.post("/grpc/device-read", async (c) => {
	const input = await c.req.json<{
		device_id: string;
		facets: string[];
	}>();
	try {
		return c.json(
			await grpcGateway.dispatchDeviceTool("", "device.read_state", input),
		);
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			503,
		);
	}
});

app.post("/grpc/start-run", async (c) => {
	try {
		await grpcGateway.startRun(
			await c.req.json<{
				runId: string;
				ticketId: string;
				title: string;
				body: string;
				reporterId: string;
				deviceId?: string;
				contextJson?: string;
			}>(),
		);
		return c.json({ accepted: true }, 202);
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			503,
		);
	}
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

await grpcGateway.listen();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		void grpcGateway.close().finally(() => process.exit(0));
	});
}
