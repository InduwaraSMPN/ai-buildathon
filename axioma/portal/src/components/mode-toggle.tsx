import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react";
import { useTheme } from "@/components/theme-provider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const THEMES = [
	{ value: "light", label: "Light theme", icon: RiSunLine },
	{ value: "dark", label: "Dark theme", icon: RiMoonLine },
	{ value: "system", label: "Follow system theme", icon: RiComputerLine },
] as const;
const DEFAULT_THEME = "dark"; // mirrors ThemeProvider defaultTheme in routes/__root.tsx and index.html

export function ModeToggle() {
	const { theme, setTheme } = useTheme();
	const current = THEMES.some((t) => t.value === theme)
		? (theme as (typeof THEMES)[number]["value"])
		: DEFAULT_THEME;

	return (
		<ToggleGroup
			value={[current]}
			onValueChange={([next]) => {
				if (next) setTheme(next);
			}}
			aria-label="Theme"
			className="gap-0.5 rounded-full bg-muted p-0.5"
		>
			{THEMES.map(({ value, label, icon: Icon }) => (
				<ToggleGroupItem
					key={value}
					value={value}
					size="sm"
					aria-label={label}
					className="w-7 rounded-full px-0 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:ring-1 aria-pressed:ring-foreground/10"
				>
					<Icon aria-hidden="true" />
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
