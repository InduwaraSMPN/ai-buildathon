import { RiFileCopyLine as Copy, RiKey2Line as Key } from "@remixicon/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Route } from "@/routes/_auth/devices";
import { orpc } from "@/utils/orpc";
import { DevicesTable } from "./devices-table";

export function DevicesPage() {
	const { deviceId } = Route.useSearch();
	const { capabilities } = Route.useRouteContext();
	const canRead = capabilities.includes("device.read");
	const canEnroll = capabilities.includes("device.enroll");
	const navigate = useNavigate({ from: Route.fullPath });
	const [token, setToken] = useState<{ token: string; expiresAt: Date }>();
	const createToken = useMutation(
		orpc.createDeviceEnrolmentToken.mutationOptions({
			onSuccess: setToken,
			onError: (error) => toast.error(error.message),
		}),
	);
	const selectDevice = (selectedDeviceId?: string) =>
		void navigate({
			search: selectedDeviceId ? { deviceId: selectedDeviceId } : {},
			replace: true,
		});
	const copyToken = async () => {
		if (!token) return;
		try {
			await navigator.clipboard.writeText(token.token);
			toast.success("Enrollment token copied");
		} catch {
			toast.error("Could not copy enrollment token");
		}
	};

	return (
		<PageContainer
			title="Devices"
			description="Endpoint connection, assignment, and activity."
			action={
				canEnroll ? (
					<Button
						onClick={() => createToken.mutate({})}
						disabled={createToken.isPending}
					>
						{createToken.isPending ? (
							<Spinner data-icon="inline-start" />
						) : (
							<Key data-icon="inline-start" />
						)}
						Issue enrollment token
					</Button>
				) : null
			}
		>
			{canRead ? (
				<DevicesTable deviceId={deviceId} onSelectDevice={selectDevice} />
			) : (
				<p className="text-muted-foreground">
					You can issue enrolment tokens but cannot view devices.
				</p>
			)}
			<Dialog
				open={token !== undefined}
				onOpenChange={(open) => !open && setToken(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Enrollment token</DialogTitle>
						<DialogDescription>
							Single-use token. It expires {token?.expiresAt.toLocaleString()}.
						</DialogDescription>
					</DialogHeader>
					<Input value={token?.token ?? ""} readOnly className="font-mono" />
					<DialogFooter>
						<Button onClick={copyToken}>
							<Copy data-icon="inline-start" />
							Copy token
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
