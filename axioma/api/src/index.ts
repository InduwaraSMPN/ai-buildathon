import { serve } from "@hono/node-server";
import { createApp } from "@/app";
import { env } from "@/env";
import { bootstrapAdministrator } from "@/server/authorization";
import {
	closeConnectorSweep,
	startConnectorSweep,
} from "@/server/connectors/runtime";
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

process.on("unhandledRejection", (reason) =>
	console.error("[process] unhandled rejection", reason),
);

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
startConnectorSweep();
let knowledgeGapSweep: NodeJS.Timeout | undefined;
let knowledgeGapSweepClosed = false;
const scheduleKnowledgeGapSweep = (delay = 0) => {
	knowledgeGapSweep = setTimeout(async () => {
		try {
			await sweepKnowledgeGaps();
		} catch (error) {
			console.error("[knowledge] gap sweep failed", error);
		} finally {
			if (!knowledgeGapSweepClosed) scheduleKnowledgeGapSweep(24 * 60 * 60_000);
		}
	}, delay);
	knowledgeGapSweep.unref();
};
scheduleKnowledgeGapSweep();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		knowledgeGapSweepClosed = true;
		if (knowledgeGapSweep) clearTimeout(knowledgeGapSweep);
		closeRecurrenceSweep();
		closeConnectorSweep();
		void Promise.all([grpcGateway.close(), closeMailRuntime()])
			.catch((error) => console.error("[shutdown] cleanup failed", error))
			.finally(() => process.exit(0));
	});
}
