import { SITE_URL } from "../content/site";

export type PageMetaInput = {
	title: string;
	description: string;
	path: string;
	image?: string;
	noIndex?: boolean;
};

export function pageMeta({
	title,
	description,
	path,
	image,
	noIndex,
}: PageMetaInput) {
	const url = `${SITE_URL}${path}`;
	const ogImage = image ?? `${SITE_URL}/og.png`;

	return {
		meta: [
			{ title },
			{ name: "description", content: description },
			{ property: "og:title", content: title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: url },
			{ property: "og:image", content: ogImage },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ property: "og:site_name", content: "Axiōma" },
			{ property: "og:type", content: "website" },
			{ property: "og:locale", content: "en_US" },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: title },
			{ name: "twitter:description", content: description },
			{ name: "twitter:image", content: ogImage },
			...(noIndex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
		],
		links: [{ rel: "canonical", href: url }],
	};
}
