import { RiArrowLeftLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";

export function BackToHome() {
	return (
		<Link
			to="/home"
			className={buttonVariants({
				variant: "ghost",
				size: "sm",
				className: "mb-6 ml-0.5",
			})}
		>
			<RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
			Back to home
		</Link>
	);
}
