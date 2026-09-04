import { serve } from "@hono/node-server";
import { createApp } from "@/app";
import { env } from "@/env";
import { bootstrapAdministrator } from "@/server/authorization";
import {
	closeConnectorSweep,
	startConnectorSweep,
} from "@/server/connectors/runtime";
import { grpcGateway } from "@/server/grpc";
import { sweepIntakeDrafts } from "@/server/intake";
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

// An unhandled rejection has already skipped whatever it was supposed to do, so
// the process is in an unknown state; exiting hands recovery to the supervisor
// rather than leaving a half-initialised pod serving traffic.
process.on("unhandledRejection", (reason) => {
	console.error("[process] unhandled rejection", reason);
	process.exit(1);
});

if (env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL) {
	const outcome = await bootstrapAdministrator(
		env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL,
	);
	console.log(
		outcome === "granted"
			? `[auth] bootstrapped administrator ${env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL}`
			: outcome === "already_administered"
				? "[auth] bootstrap skipped: an administrator already exists"
				: `[auth] bootstrap account not found: ${env.AXIOMA_BOOTSTRAP_ADMIN_EMAIL}`,
	);
}

const app = createApp();
const server = serve(
	{
		fetch: app.fetch,
		port: env.PORT,
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
// The HTTP port is already bound at this point, so a failure here would
// otherwise leave the pod answering /health while no device or agent can
// connect and no sweep is scheduled. Exit instead and let the supervisor retry.
try {
	await Promise.all([grpcGateway.listen(), startMailRuntime()]);
} catch (error) {
	console.error("[startup] gateway or mail runtime failed to start", error);
	server.close();
	process.exit(1);
}
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

let intakeSweep: NodeJS.Timeout | undefined;
let intakeSweepClosed = false;
const scheduleIntakeSweep = (delay = 0) => {
	intakeSweep = setTimeout(async () => {
		try {
			const { deleted } = await sweepIntakeDrafts();
			if (deleted) console.log(`[intake] swept ${deleted} expired drafts`);
		} catch (error) {
			console.error("[intake] draft sweep failed", error);
		} finally {
			if (!intakeSweepClosed) scheduleIntakeSweep(60 * 60_000);
		}
	}, delay);
	intakeSweep.unref();
};
scheduleIntakeSweep();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => {
		knowledgeGapSweepClosed = true;
		if (knowledgeGapSweep) clearTimeout(knowledgeGapSweep);
		intakeSweepClosed = true;
		if (intakeSweep) clearTimeout(intakeSweep);
		closeRecurrenceSweep();
		closeConnectorSweep();
		// The HTTP listener is closed first and awaited, so requests already in
		// flight finish instead of being severed mid-response on every rolling
		// deploy. `close` stops accepting new connections immediately.
		void new Promise<void>((resolve) => server.close(() => resolve()))
			.then(() => Promise.all([grpcGateway.close(), closeMailRuntime()]))
			.catch((error) => console.error("[shutdown] cleanup failed", error))
			.finally(() => process.exit(0));
	});
}
