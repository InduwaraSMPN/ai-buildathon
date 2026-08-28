export type Device = {
	id: string;
	ownerId: string | null;
	ownerName: string | null;
	hostname: string;
	username: string | null;
	platform: string | null;
	release: string | null;
	agentVersion: string | null;
	connected: string;
	lastSeenAt: Date;
	enrolledAt: Date;
};
