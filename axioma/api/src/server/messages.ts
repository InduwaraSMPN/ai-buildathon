export type TicketMessage = {
	id: string;
	ticketId: string;
	authorId: string | null;
	authorType: "reporter" | "staff";
	body: string;
	visibility: "public" | "private";
	createdAt: Date;
};

export const toPortalMessages = (messages: TicketMessage[]) =>
	messages
		.filter((message) => message.visibility === "public")
		.map(({ visibility: _, ...message }) => message);
