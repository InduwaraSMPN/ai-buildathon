import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { intakeCopy } from "@/features/intake/copy";
import type { IntakeEvent } from "@/features/intake/types";
import { client, orpc, queryClient } from "@/utils/orpc";

export function useIntakeCapabilities() {
	return useQuery(orpc.intakeCapabilities.queryOptions());
}

export function useStartIntakeDraft() {
	return useMutation(
		orpc.startIntakeDraft.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: orpc.getIntakeDraft.key() });
			},
			onError: () => toast.error(intakeCopy.startError),
		}),
	);
}

export async function sendIntakeMessage(
	draftId: string,
	body: string,
	onEvent: (event: IntakeEvent) => void,
	signal?: AbortSignal,
	excludedAttachments?: string[],
): Promise<void> {
	if (signal?.aborted) return;
	// The oRPC client takes the signal natively. Retrying without it on failure
	// meant an abort started a second, unstoppable stream — a duplicate model
	// call and a leaked iterator — so there is deliberately no fallback here.
	const iterator = await client.sendIntakeMessage(
		{
			draftId,
			body,
			...(excludedAttachments?.length ? { excludedAttachments } : {}),
		},
		{ signal },
	);
	const abortHandler = () => {
		try {
			const closer = (
				iterator as unknown as { return?: () => Promise<unknown> }
			).return;
			void closer?.call(iterator);
		} catch {
			// ignore
		}
	};
	signal?.addEventListener("abort", abortHandler);
	try {
		for await (const event of iterator) {
			if (signal?.aborted) break;
			onEvent(event);
		}
		if (signal?.aborted) return;
		await queryClient.invalidateQueries({
			queryKey: orpc.getIntakeDraft.key({ input: { draftId } }),
		});
	} catch (error) {
		if (signal?.aborted) return;
		throw error;
	} finally {
		signal?.removeEventListener("abort", abortHandler);
	}
}

/**
 * Takes one document back off a draft. This has to reach the server:
 * `submitIntakeDraft` re-parents every document still linked to the draft, so
 * an attachment dropped only from local state still landed on the ticket. The
 * server deletes the document row and its blob once no other link references
 * it, so a confirmed unlink genuinely removes the bytes. The `listDocuments`
 * key is invalidated so a later rehydrate cannot resurrect the row from cache.
 */
export async function unlinkDraftDocument(
	draftId: string,
	documentId: string,
): Promise<void> {
	const target = { targetType: "draft", targetId: draftId } as const;
	await client.unlinkDocument({ documentId, ...target });
	await queryClient.invalidateQueries({
		queryKey: orpc.listDocuments.key({ input: target }),
	});
}

export function usePatchIntakeDraft() {
	return useMutation(
		orpc.patchIntakeDraft.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.getIntakeDraft.key(),
				});
			},
			onError: () => toast.error(intakeCopy.saveError),
		}),
	);
}

export function useSubmitIntakeDraft() {
	return useMutation(
		orpc.submitIntakeDraft.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.listTickets.key(),
				});
			},
			onError: () => toast.error(intakeCopy.sendError),
		}),
	);
}

export function useDiscardIntakeDraft() {
	return useMutation(
		orpc.discardIntakeDraft.mutationOptions({
			onError: () => toast.error(intakeCopy.cancelError),
		}),
	);
}
