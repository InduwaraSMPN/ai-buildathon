import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * One plain-language question rendered as a card radio group. Shared by the
 * manual request form and the AI draft review so the two renderings of the same
 * question cannot drift; `value` is null when nothing is chosen yet, which is
 * how a low-confidence field stays empty instead of showing a guess.
 */
export function Question({
	legend,
	name,
	value,
	options,
	onChange,
}: {
	legend: string;
	name: string;
	value: string | null;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
}) {
	return (
		<FieldSet className="gap-2">
			<FieldLegend variant="label" className="mb-0">
				{legend}
			</FieldLegend>
			<RadioGroup
				value={value}
				onValueChange={(next) => onChange(String(next))}
				className="gap-2 sm:grid-cols-3"
			>
				{options.map((option) => (
					<Label
						key={option.value}
						htmlFor={`${name}-${option.value}`}
						// Chosen reads as chosen from across the page: the tint alone
						// was a 4% wash behind a hairline border, which is why the
						// answered questions looked as empty as the unanswered ones.
						className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 font-normal text-sm transition-colors hover:bg-muted/50 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/10 has-[[data-checked]]:font-medium has-[[data-checked]]:text-foreground"
					>
						<RadioGroupItem
							id={`${name}-${option.value}`}
							value={option.value}
						/>
						<span>{option.label}</span>
					</Label>
				))}
			</RadioGroup>
		</FieldSet>
	);
}
