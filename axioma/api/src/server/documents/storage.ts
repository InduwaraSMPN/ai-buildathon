import { createReadStream } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const blobPath = (root: string, key: string) => {
	if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid blob key");
	return join(root, key);
};

export class FileBlobStore {
	constructor(private readonly root: string) {}

	async put(key: string, content: Uint8Array): Promise<boolean> {
		if (content.byteLength > MAX_DOCUMENT_BYTES)
			throw new Error(`Document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
		await mkdir(this.root, { recursive: true });
		const path = blobPath(this.root, key);
		try {
			const file = await open(path, "wx");
			try {
				await file.writeFile(content);
			} finally {
				await file.close();
			}
			return true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
			await rm(path, { force: true });
			throw error;
		}
	}

	async remove(key: string): Promise<void> {
		await rm(blobPath(this.root, key), { force: true });
	}

	stream(key: string): ReadableStream<Uint8Array> {
		return Readable.toWeb(
			createReadStream(blobPath(this.root, key)),
		) as ReadableStream<Uint8Array>;
	}
}
