import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

type ThemeSetting = "light" | "dark" | "system";

function applyTheme(setting: ThemeSetting) {
	const dark =
		setting === "dark" ||
		(setting === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
	document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle() {
	const [setting, setSetting] = useState<ThemeSetting>("system");

	useEffect(() => {
		const stored = localStorage.getItem("theme");
		if (stored === "light" || stored === "dark") {
			setSetting(stored);
		}
	}, []);

	useEffect(() => {
		if (setting !== "system") {
			return;
		}
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [setting]);

	return (
		<ToggleGroup
			className="theme-toggle"
			type="single"
			value={setting}
			onValueChange={(value) => {
				// Radix single allows deselection; keep a theme always active.
				if (!value) {
					return;
				}
				const next = value as ThemeSetting;
				setSetting(next);
				localStorage.setItem("theme", next);
				applyTheme(next);
			}}
			aria-label="Colour theme"
		>
			<ToggleGroupItem
				className="theme-toggle-item"
				value="light"
				aria-label="Light theme"
			>
				<Sun aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem
				className="theme-toggle-item"
				value="dark"
				aria-label="Dark theme"
			>
				<Moon aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem
				className="theme-toggle-item"
				value="system"
				aria-label="Follow system theme"
			>
				<Monitor aria-hidden="true" />
			</ToggleGroupItem>
		</ToggleGroup>
	);
}
