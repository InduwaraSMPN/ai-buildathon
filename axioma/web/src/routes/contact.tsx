import { createFileRoute } from "@tanstack/react-router";
import { Arrow, PageIntro } from "../components/site";

export const Route = createFileRoute("/contact")({
	head: () => ({
		meta: [
			{ title: "Contact — Axiōma" },
			{
				name: "description",
				content:
					"Contact Axiōma to discuss the IT support loop you are working on.",
			},
		],
	}),
	component: ContactPage,
});

function ContactPage() {
	return (
		<>
			<PageIntro
				eyebrow="Contact / start here"
				title="Tell us where support loses the thread."
			>
				<p>
					Share the ticket path, systems, or device boundary you are thinking
					about. We will continue the conversation by email.
				</p>
			</PageIntro>
			<section className="contact-block shell">
				<div className="contact-card">
					<p className="eyebrow">General enquiries</p>
					<a href="mailto:hello@axioma.dev?subject=Axi%C5%8Dma%20enquiry">
						hello@axioma.dev <Arrow />
					</a>
					<p>
						This opens your email client. There is no form submission or stored
						contact data on this website.
					</p>
				</div>
				<aside>
					<p className="eyebrow">Useful context</p>
					<ul>
						<li>The support path you want to examine</li>
						<li>Where the relevant evidence currently lives</li>
						<li>Which actions should remain human decisions</li>
					</ul>
				</aside>
			</section>
		</>
	);
}
