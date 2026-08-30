export type RequestFormValue = string | number | boolean | string[];
export type RequestFormValues = Record<string, RequestFormValue>;

export type RequestFormField = {
	key: string;
	label: string;
	type:
		| "text"
		| "textarea"
		| "number"
		| "date"
		| "boolean"
		| "select"
		| "multiselect";
	description?: string | null;
	required?: boolean;
	readOnly?: boolean;
	options?: Array<string | { label: string; value: string }>;
	min?: number;
	max?: number;
	step?: number;
	minLength?: number;
	maxLength?: number;
	placeholder?: string;
	condition?: unknown;
};
