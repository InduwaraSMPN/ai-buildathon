import { createFileRoute } from "@tanstack/react-router";
import { BackToHome } from "@/components/back-to-home";
import {
	PageHeading,
	PageShell,
	panelCardClass,
	panelTitleClass,
} from "@/components/ticket-ui";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DeviceClaimForm } from "@/features/devices/components/device-claim-form";
import { DeviceList } from "@/features/devices/components/device-list";
import { deviceCopy } from "@/features/devices/copy";

export const Route = createFileRoute("/_auth/connect-a-computer")({
	component: RouteComponent,
	head: () => ({ meta: [{ title: deviceCopy.pageTitle }] }),
});

function RouteComponent() {
	return (
		<PageShell>
			<BackToHome />
			<PageHeading
				title={deviceCopy.connectComputer}
				description={deviceCopy.pageDescription}
			/>
			<div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-5">
				<Card className={panelCardClass}>
					<CardHeader>
						<CardTitle className={panelTitleClass}>
							<h2>{deviceCopy.claimHeading}</h2>
						</CardTitle>
						<CardDescription>{deviceCopy.connectDescription}</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-1 flex-col justify-center">
						<DeviceClaimForm />
					</CardContent>
				</Card>
				<Card className={panelCardClass}>
					<CardHeader>
						<CardTitle className={panelTitleClass}>
							<h2>{deviceCopy.heading}</h2>
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-1 flex-col justify-center">
						<DeviceList />
					</CardContent>
				</Card>
			</div>
		</PageShell>
	);
}
