// GENERATED — do not edit.
// Mirrored from axioma/ui/src by `pnpm --dir axioma/ui mirror`.
// Change the source in axioma/ui and re-run that command.

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { useTheme } from "next-themes";
