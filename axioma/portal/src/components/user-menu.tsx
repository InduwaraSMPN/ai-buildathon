import { RiArrowRightUpLine as ArrowRightUp } from "@remixicon/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { statusCopy } from "@/features/status/copy";
import { siteUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";

function initials(name: string | null | undefined, email: string) {
	const letters = (name?.trim().split(/\s+/).filter(Boolean) ?? [])
		.slice(0, 2)
		.map((w) => w.charAt(0))
		.join("");
	return (letters || email.charAt(0)).toUpperCase();
}

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="size-8 rounded-full" />;
	}

	if (!session) {
		return (
			<Link to="/login" className={buttonVariants({ variant: "outline" })}>
				Sign In
			</Link>
		);
	}

	const { name, email, image } = session.user;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						className="rounded-full"
						aria-label="Account"
					/>
				}
			>
				<Avatar>
					<AvatarImage src={image ?? undefined} alt="" />
					<AvatarFallback className="font-medium text-xs">
						{initials(name, email)}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="flex flex-col gap-0.5">
						<span>{name}</span>
						<span className="font-normal text-muted-foreground text-xs">
							{email}
						</span>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						render={
							<a
								href={siteUrl("status")}
								target="_blank"
								rel="noreferrer noopener"
							/>
						}
					>
						{statusCopy.viewStatus}
						<ArrowRightUp
							className="ml-auto size-3.5 text-muted-foreground"
							aria-hidden="true"
						/>
					</DropdownMenuItem>
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
						<ArrowRightUp
							className="ml-auto size-3.5 text-muted-foreground"
							aria-hidden="true"
						/>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => {
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										navigate({
											to: "/login",
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
