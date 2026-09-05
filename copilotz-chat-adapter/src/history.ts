import type {
  ConversationMessage,
  CoreClient,
  Page
} from '@copilotz/copilotz/core/client';
import type { CanonicalResolvedContent } from './canonicalHistory.ts';
import type { ToolResultUpdate } from './toolActivity.ts';
import { projectCanonicalMessageHistory } from './messageContract.ts';

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

/** Resolves canonical Asset references once; projection remains a pure function. */
export function createHistoryReader(core: CoreClient) {
  const assets = new Map<
    string,
    Promise<Omit<CanonicalResolvedContent, 'ref'>>
  >();
  const results = new Map<string, ToolResultUpdate>();
  return {
    clear() {
      assets.clear();
      results.clear();
    },
    async project(
      page: Page<ConversationMessage>,
      options: NonNullable<
        Parameters<typeof projectCanonicalMessageHistory>[1]
      > & { signal?: AbortSignal }
    ) {
      const refs = page.data.flatMap((message) => [
        ...message.content,
        ...(Array.isArray(message.metadata.llmReasoning)
          ? (message.metadata.llmReasoning as ConversationMessage['content'])
          : [])
      ]);
      const content = await Promise.all(
        refs.map((ref) => {
          let pending = assets.get(ref.assetId);
          if (!pending) {
            pending = core.assets
              .get(ref.assetId, { signal: options.signal })
              .then(async (response) => {
                const bytes = new Uint8Array(await response.arrayBuffer());
                return {
                  asset: {
                    mediaType:
                      response.headers.get('content-type') ?? ref.mediaType,
                    byteLength: bytes.length
                  },
                  base64: encodeBase64(bytes)
                };
              });
            assets.set(ref.assetId, pending);
            void pending.catch(() => {
              if (assets.get(ref.assetId) === pending)
                assets.delete(ref.assetId);
            });
          }
          return pending.then((value) => ({ ...value, ref }));
        })
      );
      options.signal?.throwIfAborted();
      const projected = projectCanonicalMessageHistory(
        { ...page, included: { content } },
        options
      );
      for (const update of projected.toolResultUpdates) {
        results.set(
          JSON.stringify([
            update.sourceMessageId,
            update.toolExecutionId,
            update.id
          ]),
          update
        );
      }
      return { ...projected, toolResultUpdates: [...results.values()] };
    }
  };
}
