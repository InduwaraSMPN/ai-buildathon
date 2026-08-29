import { serve } from "@hono/node-server";
import { createApp } from "@/app";
import { env } from "@/env";
import { bootstrapAdministrator } from "@/server/authorization";
import { grpcGateway } from "@/server/grpc";
import { sweepKnowledgeGaps } from "@/server/knowledge/gaps";
import { createHttpMailProvider } from "@/server/mail/http-provider";
import {
	closeMailRuntime,
	configureMailRuntime,
	startMailRuntime,
} from "@/server/mail/runtime";
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

const app = createApp();
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
