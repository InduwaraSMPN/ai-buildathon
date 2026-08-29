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
import { type Context, createContext } from "@/server/context";
import { documentHttp } from "@/server/documents/http";
import { mailHttp } from "@/server/mail/http";
import { appRouter } from "@/server/routers/index";

export function createApp() {
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

	app.get("/health", (c) => c.json({ status: "ok" }));
	app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
	app.route("/api", documentHttp);
	app.route("/api", mailHttp);

	const apiHandler = new OpenAPIHandler<Context>(appRouter, {
		plugins: [
			new OpenAPIReferencePlugin({
				schemaConverters: [new ZodToJsonSchemaConverter()],
				specGenerateOptions: {
					components: {
						securitySchemes: {
							bearerAuth: {
								type: "http",
								scheme: "bearer",
								bearerFormat: "API key",
							},
						},
					},
				},
			}),
		],
		interceptors: [onError((error) => console.error(error))],
	});
	const rpcHandler = new RPCHandler<Context>(appRouter, {
		interceptors: [onError((error) => console.error(error))],
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
					{
						"Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))),
					},
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
			context,
		});
		if (rpcResult.matched)
			return c.newResponse(rpcResult.response.body, rpcResult.response);

		const apiResult = await apiHandler.handle(c.req.raw, {
			prefix: "/api-reference",
			context,
		});
		if (apiResult.matched)
			return c.newResponse(apiResult.response.body, apiResult.response);

		await next();
	});

	app.get("/", (c) => c.text("OK"));
	return app;
}
