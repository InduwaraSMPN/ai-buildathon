export interface TemplateRule {
	id: string;
	templateId: string;
	scope: "catch_all" | "domain" | "address";
	matchValue?: string | null;
	enabled: boolean;
}

const specificity = { catch_all: 0, domain: 1, address: 2 } as const;

export function selectTemplateRule(
	recipient: string,
	rules: readonly TemplateRule[],
): TemplateRule | undefined {
	const address = recipient.trim().toLocaleLowerCase("en-US");
	const separator = address.lastIndexOf("@");
	if (separator <= 0 || separator === address.length - 1) return undefined;
	const domain = address.slice(separator + 1);

	return rules
		.filter((rule) => {
			if (!rule.enabled) return false;
			const value = rule.matchValue?.trim().toLocaleLowerCase("en-US");
			if (rule.scope === "catch_all") return true;
			if (rule.scope === "address") return value === address;
			return value?.replace(/^@/, "") === domain;
		})
		.sort(
			(left, right) =>
				specificity[right.scope] - specificity[left.scope] ||
				left.id.localeCompare(right.id),
		)[0];
}

export function renderTemplate(
	value: string,
	mergeCodes: Readonly<Record<string, string>>,
) {
	return value.replace(/\[([a-z][a-z0-9_]*)\]/gi, (token, key: string) =>
		Object.hasOwn(mergeCodes, key.toLowerCase())
			? (mergeCodes[key.toLowerCase()] ?? "")
			: token,
	);
}
