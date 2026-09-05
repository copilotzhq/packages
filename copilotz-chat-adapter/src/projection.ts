import type { ObservationFrame } from '@copilotz/copilotz/client';
import type { ChatMessage, ChatSender } from '@copilotz/chat-ui';
import {
  appendAssistantToolDraft,
  applyAssistantToolOutput,
  closeAssistantMessage,
  failAssistantMessage,
  removeAssistantToolDraft,
  updateAssistantMessageToken
} from './activity.ts';
import { getCanonicalLlmAttemptId } from './messageReconciliation.ts';
import {
  extractLiveToolCallDelta,
  type ParsedToolCallDelta
} from './toolActivity.ts';
import { encodeBase64 } from './history.ts';
import { getAttachmentKindFromMimeType } from '@copilotz/chat-ui/model';

type ToolOrigin = {
  messageId: string;
  toolCallId: string;
  actionRunId: string;
};
type Lane = {
  operationId: string;
  attemptId: string;
  role: string;
  mediaType: string;
  sender?: ChatSender;
  name?: string;
  tool?: ToolOrigin;
  channel: string;
  binary: readonly Uint8Array[];
  offset: number;
  pending: Uint8Array;
  text: string;
  ended: boolean;
};
export type ChatProjection = {
  messages: ChatMessage[];
  lanes: Map<string, Lane>;
  operations: Set<string>;
  tools: Map<string, ToolOrigin>;
};
export const emptyProjection = (): ChatProjection => ({
  messages: [],
  lanes: new Map(),
  operations: new Set(),
  tools: new Map()
});
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const string = (value: unknown): string =>
  typeof value === 'string' ? value : '';

function prefix(
  bytes: Uint8Array,
  final = false
): { text: string; pending: Uint8Array } {
  for (let tail = 0; tail <= (final ? 0 : Math.min(3, bytes.length)); tail++) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(0, bytes.length - tail)
      );
      return { text, pending: bytes.slice(bytes.length - tail) };
    } catch {
      /* Keep only an incomplete UTF-8 suffix across frames. */
    }
  }
  throw new Error('Stream contains invalid UTF-8.');
}

/** Reapplies overlapping progressive tool output when its durable plan arrives. */
export function projectHistoryMessages(
  state: ChatProjection,
  messages: ChatMessage[]
): ChatProjection {
  for (const lane of state.lanes.values()) {
    const tool = lane.tool;
    if (!tool || !lane.offset) continue;
    const delta =
      lane.mediaType.startsWith('text/') || lane.mediaType.includes('json')
        ? lane.text
        : lane.ended
        ? lane.binary[0]
        : undefined;
    if (delta === undefined) continue;
    messages = messages.map((message) =>
      message.id === tool.messageId
        ? applyAssistantToolOutput(message, {
            id: tool.toolCallId,
            toolExecutionId: tool.actionRunId,
            channel: lane.channel,
            mode: 'replace',
            delta,
            sequence: lane.offset,
            mediaType: lane.mediaType
          })
        : message
    );
  }
  return { ...state, messages };
}

/** Pure canonical-frame projection. Each lane retains its own byte and Action identity. */
export function projectFrame(
  previous: ChatProjection,
  frame: ObservationFrame,
  at: number
) {
  const state: ChatProjection = {
    messages: previous.messages,
    lanes: new Map(previous.lanes),
    operations: new Set(previous.operations),
    tools: new Map(previous.tools)
  };
  const drafts: ParsedToolCallDelta[] = [];
  let refresh = false;
  if (frame.kind === 'output') {
    const output = frame.output;
    const operationId = string(output.operationId);
    const data = object(
      output.type === 'stream.output'
        ? object(output.metadata).sourceAction
        : output.data
    );
    const origin = object(object(data.metadata).copilotzToolAction);
    if (
      typeof data.actionRunId === 'string' &&
      typeof origin.planMessageId === 'string' &&
      typeof origin.toolCallId === 'string'
    ) {
      state.tools.set(data.actionRunId, {
        messageId: origin.planMessageId,
        toolCallId: origin.toolCallId,
        actionRunId: data.actionRunId
      });
    }
    if (operationId && !output.type.startsWith('operation.'))
      state.operations.add(operationId);
    if (output.type === 'stream.output') {
      const metadata = object(output.metadata);
      const attemptId =
        string(metadata.sourceActionRunId) ||
        string(metadata.llmAttemptId) ||
        string(output.streamId);
      const agent = object(object(metadata.copilotzCore).agent);
      const sender: ChatSender | undefined =
        typeof agent.id === 'string'
          ? {
              type: 'agent',
              id: agent.id,
              agentId: agent.id,
              name: string(agent.name) || agent.id
            }
          : undefined;
      const id = string(output.streamId);
      if (!state.lanes.has(id))
        state.lanes.set(id, {
          operationId,
          attemptId,
          role: string(metadata.lane) || string(output.role),
          mediaType: string(output.mediaType),
          sender,
          name: string(output.name) || undefined,
          channel: string(metadata.channel) || 'result',
          binary: [],
          tool: state.tools.get(attemptId),
          offset: 0,
          pending: new Uint8Array(),
          text: '',
          ended: false
        });
    }
    if (/^operation\.(completed|failed|cancelled)$/.test(output.type)) {
      state.operations.delete(operationId);
      state.messages = state.messages.map((message) =>
        message.metadata?.operationId === operationId
          ? closeAssistantMessage(message, at)
          : message
      );
      refresh = true;
    }
    if (
      output.type === 'message.created' ||
      output.type === 'message.updated' ||
      output.type === 'message.deleted'
    )
      refresh = true;
    return { state, drafts, refresh };
  }
  const current = state.lanes.get(frame.streamId);
  if (!current) throw new Error('Stream descriptor is missing.');
  const lane = { ...current };
  state.lanes.set(frame.streamId, lane);
  const messageId = `live:${lane.operationId}:${lane.attemptId}`;
  const ensureMessage = () => {
    if (
      !state.messages.some(
        (message) =>
          message.id === messageId ||
          (getCanonicalLlmAttemptId(message) ??
            message.metadata?.llmAttemptId) === lane.attemptId
      )
    ) {
      state.messages = [
        ...state.messages,
        {
          id: messageId,
          role: 'assistant',
          content: '',
          timestamp: at,
          isStreaming: true,
          sender: lane.sender,
          metadata: {
            operationId: lane.operationId,
            llmAttemptId: lane.attemptId
          }
        }
      ];
    }
  };
  const updateMessage = (update: (message: ChatMessage) => ChatMessage) => {
    state.messages = state.messages.map((message) =>
      message.id === messageId ? update(message) : message
    );
  };
  if (frame.kind === 'stream-chunk') {
    if (frame.offset + frame.bytes.length <= lane.offset)
      return { state, drafts, refresh };
    if (frame.offset > lane.offset)
      throw new Error('Stream replay has an unapplied byte gap.');
    const bytes = frame.bytes.subarray(lane.offset - frame.offset);
    lane.offset = frame.offset + frame.bytes.length;
    if (lane.mediaType.startsWith('text/') || lane.mediaType.includes('json')) {
      const joined = new Uint8Array(lane.pending.length + bytes.length);
      joined.set(lane.pending);
      joined.set(bytes, lane.pending.length);
      const decoded = prefix(joined);
      lane.pending = decoded.pending;
      lane.text += decoded.text;
      if (lane.tool) {
        const tool = lane.tool;
        state.messages = state.messages.map((message) =>
          message.id === tool.messageId
            ? applyAssistantToolOutput(message, {
                id: tool.toolCallId,
                toolExecutionId: tool.actionRunId,
                channel: lane.channel,
                mode: 'replace',
                delta: lane.text,
                sequence: lane.offset,
                mediaType: lane.mediaType
              })
            : message
        );
      } else ensureMessage();
      if (lane.role === 'content' || lane.role === 'reasoning') {
        updateMessage((message) =>
          updateAssistantMessageToken(message, {
            partial: lane.text,
            isReasoning: lane.role === 'reasoning',
            activityId: frame.streamId,
            at
          })
        );
      } else if (
        lane.role === 'tool-calls' ||
        lane.role === 'tool-call-drafts'
      ) {
        const lines = lane.text.split('\n');
        lane.text = lines.pop()!;
        for (const line of lines.filter((value) => value.trim())) {
          const delta = extractLiveToolCallDelta({
            ...JSON.parse(line),
            llmAttemptId: lane.attemptId
          });
          drafts.push({ ...delta, llmAttemptId: lane.attemptId });
          if (delta.phase === 'discarded')
            updateMessage((message) =>
              removeAssistantToolDraft(message, delta.draftId)
            );
          if (delta.phase === 'start')
            updateMessage((message) =>
              appendAssistantToolDraft(message, {
                draftId: delta.draftId,
                toolName: delta.toolName,
                startedAt: at
              })
            );
        }
      }
    } else {
      lane.binary = [...lane.binary, bytes.slice()];
    }
  } else {
    lane.ended = true;
    if (lane.binary.length) {
      const bytes = new Uint8Array(lane.offset);
      let offset = 0;
      for (const chunk of lane.binary) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      if (lane.tool) {
        const tool = lane.tool;
        state.messages = state.messages.map((message) =>
          message.id === tool.messageId
            ? applyAssistantToolOutput(message, {
                id: tool.toolCallId,
                toolExecutionId: tool.actionRunId,
                channel: lane.channel,
                mode: 'replace',
                delta: bytes,
                sequence: lane.offset,
                mediaType: lane.mediaType
              })
            : message
        );
      } else {
        ensureMessage();
        updateMessage((message) => ({
          ...message,
          attachments: [
            ...(message.attachments ?? []),
            {
              kind: getAttachmentKindFromMimeType(lane.mediaType),
              mimeType: lane.mediaType,
              dataUrl: `data:${lane.mediaType};base64,${encodeBase64(bytes)}`,
              fileName: lane.name
            }
          ]
        }));
      }
      lane.binary = lane.tool ? [bytes] : [];
    }
    if (frame.kind === 'stream-end' && lane.pending.length)
      prefix(lane.pending, true);
    if (
      frame.kind === 'stream-end' &&
      (lane.role === 'tool-calls' || lane.role === 'tool-call-drafts') &&
      lane.text.trim()
    )
      throw new Error(
        'Tool draft stream ended with an incomplete NDJSON record.'
      );
    if (frame.kind === 'stream-error')
      updateMessage((message) =>
        failAssistantMessage(
          message,
          'Progressive output did not complete.',
          at
        )
      );
    if (
      [...state.lanes.values()]
        .filter((value) => value.attemptId === lane.attemptId)
        .every((value) => value.ended)
    ) {
      updateMessage((message) => closeAssistantMessage(message, at));
    }
  }
  return { state, drafts, refresh };
}
