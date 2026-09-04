import { RiCheckboxCircleLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { intakeCopy } from "@/features/intake/copy";

export function SubcategoryConfirm({
	subcategoryName,
	confirmed,
	onConfirm,
}: {
	subcategoryName: string;
	confirmed: boolean;
	onConfirm: () => void;
}) {
	return (
		<Field orientation="horizontal">
			<Checkbox
				id="intake-subcategory-confirm"
				checked={confirmed}
				onCheckedChange={(checked) => {
					if (checked === true) onConfirm();
				}}
			/>
			<FieldContent>
				<FieldLabel
					htmlFor="intake-subcategory-confirm"
					className="font-normal"
				>
					{intakeCopy.confirmSubcategory.replace(
						"{subcategory}",
						subcategoryName,
					)}
				</FieldLabel>
			</FieldContent>
			{confirmed ? (
				<Button
					variant="ghost"
					size="sm"
					type="button"
					disabled
					className="gap-1"
				>
					<RiCheckboxCircleLine
						className="size-4 text-primary"
						aria-hidden="true"
					/>
					{intakeCopy.confirmSubcategoryAction}
				</Button>
			) : null}
		</Field>
	);
}
