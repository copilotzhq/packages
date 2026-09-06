import type {
  ResolvedConversationMessage,
  Page
} from '@copilotz/copilotz/core/client';
import type { CanonicalResolvedContent } from './canonicalHistory.ts';
import type { ToolResultUpdate } from './toolActivity.ts';
import { projectCanonicalMessageHistory } from './messageContract.ts';

/** Projects values prepared by Core; history performs no Asset requests. */
export function createHistoryReader() {
  const results = new Map<string, ToolResultUpdate>();
  return {
    clear() {
      results.clear();
    },
    async project(
      page: Page<ResolvedConversationMessage>,
      options: NonNullable<
        Parameters<typeof projectCanonicalMessageHistory>[1]
      > & { signal?: AbortSignal }
    ) {
      const content = page.data.flatMap((message) =>
        [
          ...message.content,
          ...(Array.isArray(message.metadata.llmReasoning)
            ? message.metadata.llmReasoning
            : [])
        ].map((entry) => {
          if (!Object.hasOwn(entry, 'value'))
            throw new TypeError('History requires resolved content.');
          const { value, ...ref } = entry;
          return {
            ref,
            value,
            asset: {
              mediaType: ref.mediaType,
              byteLength:
                value instanceof Uint8Array
                  ? value.byteLength
                  : new TextEncoder().encode(
                      typeof value === 'string' ? value : JSON.stringify(value)
                    ).length
            }
          } as CanonicalResolvedContent;
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
