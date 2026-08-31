import { RiArrowRightUpLine as ArrowRightUp } from "@remixicon/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Link to="/login">
				<Button variant="outline">Sign In</Button>
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				{session.user.name}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem>{session.user.email}</DropdownMenuItem>
					<DropdownMenuSeparator />
					{/* The terms are accepted at sign-in, so they have to stay
					 * reachable afterwards — this is the only entry point to them
					 * from inside the console. */}
					<DropdownMenuItem
						render={
							<Link
								to="/acceptable-use"
								target="_blank"
								rel="noreferrer noopener"
							/>
						}
					>
						Acceptable use policy
						<ArrowRightUp className="ml-auto size-3.5 text-muted-foreground" />
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										navigate({
											to: "/",
										});
									},
								},
							});
						}}
					>
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
