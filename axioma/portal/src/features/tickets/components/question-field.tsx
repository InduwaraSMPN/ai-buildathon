import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * One plain-language question rendered as a card radio group. Shared by the
 * manual request form and the AI draft review so the two renderings of the same
 * question cannot drift; `value` is null when nothing is chosen yet, which is
 * how a low-confidence field stays empty instead of showing a guess (§3.2).
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
		<FieldSet className="gap-3">
			<FieldLegend variant="label">{legend}</FieldLegend>
			<RadioGroup
				value={value}
				onValueChange={(next) => onChange(String(next))}
				className="gap-3 sm:grid-cols-3"
			>
				{options.map((option) => (
					<Label
						key={option.value}
						htmlFor={`${name}-${option.value}`}
						className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 font-normal has-[[data-checked]]:border-primary has-[[data-checked]]:bg-muted/50"
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
