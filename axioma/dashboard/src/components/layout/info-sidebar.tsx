import type { ReactNode } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export function InfoSidebar({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<aside aria-label={title} className="h-fit">
			<Card size="sm">
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<CardDescription className="text-xs leading-relaxed">
						{children}
					</CardDescription>
				</CardContent>
			</Card>
		</aside>
	);
}
