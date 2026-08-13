import type { AgentOption, MediaAttachment } from "@copilotz/chat-ui";
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import { getLlmAttemptId } from "./streamEvents.ts";

const rawBaseValue = import.meta.env?.VITE_API_URL;
const rawBase = typeof rawBaseValue === "string" && rawBaseValue.length > 0
  ? rawBaseValue
  : "/api";
const normalizedBase = rawBase.replace(/\/$/, "");
const API_BASE =
  normalizedBase.startsWith("http") || normalizedBase.startsWith("/")
    ? normalizedBase
    : `/${normalizedBase}`;

export const apiUrl = (path: string) => `${API_BASE}${path}`;
export const apiUrlObject = (path: string) => new URL(apiUrl(path), window.location.origin);

const runtimeProcess: typeof process | undefined =
  typeof process !== "undefined" ? process : undefined;

const API_KEY = (() => {
  const env =
    (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const candidates = [
    env.VITE_API_KEY,
    env.VITE_COPILOTZ_API_KEY,
    runtimeProcess?.env?.COPILOTZ_API_KEY,
    runtimeProcess?.env?.API_KEY,
  ];
  return candidates.find((value) =>
    typeof value === "string" && value.length > 0
  );
})();

export type RequestHeadersProvider = () =>
  | Record<string, string>
  | Promise<Record<string, string>>;

export const withAuthHeaders = async (
  headers: Record<string, string> = {},
  getRequestHeaders?: RequestHeadersProvider,
): Promise<Record<string, string>> => {
  const providedHeaders = getRequestHeaders
    ? await getRequestHeaders()
    : undefined;
  if (providedHeaders && Object.keys(providedHeaders).length > 0) {
    return { ...headers, ...providedHeaders };
  }
  if (API_KEY) {
    return { ...headers, Authorization: `Bearer ${API_KEY}` };
  }
  return headers;
};

type RestThread = {
  id: string;
  name?: string | null;
  externalId?: string | null;
  description?: string | null;
  participants?: string[] | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

type AgentApiItem = {
  id: string;
  name: string;
  description?: string | null;
};

export type ThreadActivityStatus = "idle" | "running" | "failed";

export type ThreadActivity = {
  threadId: string;
  status: ThreadActivityStatus;
  activeCount: number;
  activeEvents?: Array<{
    id: string;
    eventType: string;
    status: string;
    priority?: number | null;
    traceId?: string | null;
    parentEventId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  lastFailure?: {
    id: string;
    eventType: string;
    status: string;
    priority?: number | null;
    traceId?: string | null;
    parentEventId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  updatedAt?: string;
};

export type RestMessage = {
  id: string;
  threadId: string;
  senderId?: string | null;
  senderType: string;
  senderUserId?: string | null;
  content?: string | null;
  reasoning?: string | null;
  metadata?: Record<string, unknown> | null;
  toolCalls?: Array<Record<string, unknown>> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RestMessagePageInfo = {
  hasMoreBefore: boolean;
  oldestMessageId: string | null;
  newestMessageId: string | null;
};

export type RestMessagePage = {
  data: RestMessage[];
  pageInfo: RestMessagePageInfo;
};

const buildFallbackPageInfo = (
  data: RestMessage[],
): RestMessagePageInfo => ({
  hasMoreBefore: false,
  oldestMessageId: data[0]?.id ?? null,
  newestMessageId: data[data.length - 1]?.id ?? null,
});

type MessageContent =
  | string
  | Array<
    | { type: "text"; text: string }
    | {
      type: "image";
      dataBase64: string;
      mediaType: string;
      name?: string;
      alt?: string;
      metadata?: Record<string, unknown>;
    }
    | {
      type: "audio";
      dataBase64: string;
      mediaType: string;
      name?: string;
      transcript?: string;
      metadata?: Record<string, unknown>;
    }
    | {
      type: "video";
      dataBase64: string;
      mediaType: string;
      name?: string;
      metadata?: Record<string, unknown>;
    }
    | {
      type: "file";
      dataBase64: string;
      mediaType: string;
      name?: string;
      metadata?: Record<string, unknown>;
    }
    | { type: "json"; value: unknown }
  >;

type MessageToolCall = {
  id?: string | null;
  name: string;
  args: Record<string, unknown>;
};

type MessageThread = {
  id?: string;
  name?: string;
  description?: string;
  externalId?: string;
  participants?: string[];
  metadata?: Record<string, unknown>;
};

type WebParticipant = {
  externalId: string;
  participantType: "human";
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

type WebChannelPayload = {
  thread: MessageThread;
  participant: WebParticipant;
  recipients?: string[];
  input: {
    content: MessageContent;
    metadata?: Record<string, unknown>;
  };
};

export type StreamTokenContext = {
  isReasoning: boolean;
  llmAttemptId: string;
  phaseId: string;
  phaseOrdinal: number;
};

type StreamCallbacks = {
  onToken?: (
    token: string,
    isComplete: boolean,
    raw?: any,
    options?: StreamTokenContext,
  ) => void;
  onMessageEvent?: (payload: any) => void | Promise<void>;
  onAssetEvent?: (payload: any) => void | Promise<void>;
  signal?: AbortSignal;
};

type RunOptions = {
  threadId?: string;
  threadExternalId?: string;
  content: string;
  user: {
    externalId: string;
    name?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
  attachments?: MediaAttachment[];
  metadata?: Record<string, unknown>;
  threadMetadata?: Record<string, unknown>;
  toolCalls?: Array<
    { name: string; args: Record<string, unknown>; id?: string }
  >;
  selectedAgent?: string | null;
  /** Agent participants in the thread (multi-agent). Overrides selectedAgent for thread.participants when provided. */
  participants?: string[] | null;
  /** Explicit target agent for this message (who should respond). */
  targetAgent?: string | null;
  getRequestHeaders?: RequestHeadersProvider;
} & StreamCallbacks;

export type CopilotzStreamResult = {
  text: string;
  messages: any[];
  media: Record<string, string> | null;
};

export class CopilotzRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "CopilotzRequestError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

const SSE_LINE_BREAK = "\n\n";

const appendChunk = (buffer: string, chunk: string): string => {
  if (!buffer) return chunk;
  if (!chunk) return buffer;
  if (chunk.startsWith(buffer)) return chunk;
  if (buffer.startsWith(chunk)) return buffer;
  const maxOverlap = Math.min(buffer.length, chunk.length);
  for (let i = maxOverlap; i > 0; i--) {
    if (buffer.endsWith(chunk.slice(0, i))) {
      return buffer + chunk.slice(i);
    }
  }
  return buffer + chunk;
};

const parseErrorText = (rawText: string): unknown => {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
};

const toAttachmentPayload = (attachments?: MediaAttachment[]) => {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((att, index) => {
    const base = {
      kind: att.kind,
      mimeType: att.mimeType,
      fileName: att.fileName,
      size: att.size,
      contentIndex: index + 1,
    };
    if (att.kind === "audio" || att.kind === "video") {
      return {
        ...base,
        durationMs: att.durationMs,
      };
    }
    return base;
  });
};

// --- Audio helpers: convert browser-recorded WebM/Opus to WAV (16-bit PCM) ---
const base64FromUint8 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  // btoa is available in browsers
  return btoa(binary);
};

const parseDataUrl = (
  dataUrl: string,
): { mime: string; base64: string } | null => {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/s);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
};

const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return new ArrayBuffer(0);
  const binaryString = atob(parsed.base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const encodeWav16BitPCM = (audioBuffer: AudioBuffer): Uint8Array => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numFrames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  let offset = 0;
  writeString(offset, "RIFF");
  offset += 4;
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString(offset, "WAVE");
  offset += 4;

  // fmt  subchunk
  writeString(offset, "fmt ");
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(offset, 1, true);
  offset += 2; // AudioFormat (1 = PCM)
  view.setUint16(offset, numChannels, true);
  offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true);
  offset += 4; // SampleRate
  view.setUint32(offset, sampleRate * numChannels * bytesPerSample, true);
  offset += 4; // ByteRate
  view.setUint16(offset, numChannels * bytesPerSample, true);
  offset += 2; // BlockAlign
  view.setUint16(offset, 16, true);
  offset += 2; // BitsPerSample

  // data subchunk
  writeString(offset, "data");
  offset += 4;
  view.setUint32(offset, dataSize, true);
  offset += 4;

  // Interleave channels and write PCM samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  let idx = 0;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      // Clamp
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit PCM
      const s = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + idx, s, true);
      idx += 2;
    }
  }

  return new Uint8Array(buffer);
};

const convertAudioDataUrlToWavBase64 = async (
  dataUrl: string,
): Promise<string | null> => {
  try {
    const ab = dataUrlToArrayBuffer(dataUrl);
    const ctx =
      new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(ab.slice(0)); // ensure detached buffer
    // Optionally downsample here if desired; we'll keep source sampleRate.
    const wavBytes = encodeWav16BitPCM(audioBuffer);
    return base64FromUint8(wavBytes);
  } catch (_err) {
    return null;
  }
};

export async function runCopilotzStream(
  options: RunOptions,
): Promise<CopilotzStreamResult> {
  const {
    threadId,
    threadExternalId,
    content,
    user,
    attachments,
    metadata,
    threadMetadata,
    toolCalls,
    selectedAgent,
    participants,
    targetAgent,
    getRequestHeaders,
    onToken,
    onMessageEvent,
    onAssetEvent,
    signal,
  } = options;

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }

  // Attachment bytes are canonical content. Metadata contains only body-free
  // display hints so base64 is never duplicated into graph metadata.
  const attachmentPayload = toAttachmentPayload(attachments);

  const normalizedToolCalls = toolCalls?.map<MessageToolCall>((call) => ({
    id: call.id ?? crypto.randomUUID(),
    name: call.name,
    args: call.args ?? {},
  })) ?? [];

  const metadataToolCalls = normalizedToolCalls.length > 0
    ? normalizedToolCalls.map((tc) => ({
      id: tc.id ?? undefined,
      name: tc.name,
      args: JSON.stringify(tc.args ?? {}),
    }))
    : undefined;

  const baseMetadata = {
    ...(metadata ?? {}),
    ...(attachmentPayload ? { attachments: attachmentPayload } : {}),
    ...(metadataToolCalls ? { toolCalls: metadataToolCalls } : {}),
    userExternalId: user.externalId,
  } as Record<string, unknown>;

  const messageMetadata = Object.keys(baseMetadata).length > 0
    ? baseMetadata
    : undefined;

  const senderMetadata = {
    ...(user.metadata ?? {}),
    ...(user.email ? { email: user.email } : {}),
  } as Record<string, unknown>;

  const mergedThreadMetadata = {
    ...(threadMetadata ?? {}),
  } as Record<string, unknown>;

  if (mergedThreadMetadata.userExternalId === undefined) {
    mergedThreadMetadata.userExternalId = user.externalId;
  }

  // Extract name from threadMetadata if present
  const threadName = (mergedThreadMetadata.name as string) ?? null;
  // Remove name from metadata since it's a top-level field
  const { name: _threadName, ...restThreadMetadata } = mergedThreadMetadata;

  // Always include the user as a thread participant so the thread is
  // discoverable via participantId queries after page refresh.
  const baseParticipants: string[] =
    Array.isArray(participants) && participants.length > 0
      ? participants
      : selectedAgent
      ? [selectedAgent]
      : [];
  const resolvedParticipants: string[] = user.externalId &&
      !baseParticipants.includes(user.externalId)
    ? [...baseParticipants, user.externalId]
    : baseParticipants;

  const resolvedTarget = targetAgent?.trim() || null;
  const resolvedRecipients = resolvedTarget
    ? [resolvedTarget]
    : baseParticipants.filter((participant) => participant !== user.externalId);
  const threadPayload: MessageThread | undefined =
    (threadId || threadExternalId || threadName ||
        Object.keys(restThreadMetadata).length > 0)
      ? {
        ...(threadId ? { id: threadId } : {}),
        ...(threadExternalId ? { externalId: threadExternalId } : {}),
        ...(threadName ? { name: threadName } : {}),
        participants: resolvedParticipants,
        ...(Object.keys(restThreadMetadata).length > 0
          ? { metadata: restThreadMetadata }
          : {}),
      }
      : undefined;

  const preparedAttachmentParts: Exclude<MessageContent, string> = [];
  for (const [index, attachment] of (attachments ?? []).entries()) {
    const parsed = parseDataUrl(attachment.dataUrl);
    if (!parsed) {
      throw new TypeError(
        `Attachment ${index + 1} must contain a base64 data URL.`,
      );
    }
    let dataBase64 = parsed.base64;
    let mediaType = attachment.mimeType || parsed.mime;
    if (
      attachment.kind === "audio" &&
      !mediaType.includes("wav") &&
      !mediaType.includes("mp3") &&
      !mediaType.includes("mpeg")
    ) {
      const wavBase64 = await convertAudioDataUrlToWavBase64(
        attachment.dataUrl,
      );
      if (wavBase64) {
        dataBase64 = wavBase64;
        mediaType = "audio/wav";
      }
    }
    preparedAttachmentParts.push({
      type: attachment.kind,
      dataBase64,
      mediaType,
      ...(attachment.fileName ? { name: attachment.fileName } : {}),
      metadata: {
        attachmentIndex: index,
        ...(attachment.size !== undefined ? { size: attachment.size } : {}),
        ...((attachment.kind === "audio" || attachment.kind === "video") &&
            attachment.durationMs !== undefined
          ? { durationMs: attachment.durationMs }
          : {}),
      },
    });
  }

  // Build one ordered content sequence for text and all future media kinds.
  const contentParts: MessageContent = (() => {
    const parts: Exclude<MessageContent, string> = [];
    const text = (typeof content === "string" && content.trim().length > 0)
      ? content
      : "";
    parts.push({ type: "text", text });
    for (const part of preparedAttachmentParts) parts.push(part);
    if (parts.length === 1 && parts[0].type === "text") return parts[0].text;
    return parts;
  })();

  const payload: WebChannelPayload = {
    thread: threadPayload ?? {
      externalId: crypto.randomUUID(),
      participants: resolvedParticipants,
      ...(Object.keys(restThreadMetadata).length > 0
        ? { metadata: restThreadMetadata }
        : {}),
    },
    participant: {
      participantType: "human",
      externalId: user.externalId,
      ...(user.name ? { name: user.name } : {}),
      ...(user.email ? { email: user.email } : {}),
      ...(Object.keys(senderMetadata).length > 0
        ? { metadata: senderMetadata }
        : {}),
    },
    ...(resolvedRecipients.length > 0
      ? { recipients: resolvedRecipients }
      : {}),
    input: {
      content: contentParts,
      ...(messageMetadata ? { metadata: messageMetadata } : {}),
    },
  };

  const response = await fetch(apiUrl("/v1/providers/web"), {
    method: "POST",
    headers: await withAuthHeaders({
      "Content-Type": "application/json",
    }, getRequestHeaders),
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText);
    const parsed = parseErrorText(errorText);
    const details = parsed && typeof parsed === "object" ? parsed : undefined;
    const detailsRecord = details as Record<string, unknown> | undefined;
    const message =
      (typeof detailsRecord?.message === "string" && detailsRecord.message) ||
      (typeof detailsRecord?.error === "string" && detailsRecord.error) ||
      errorText ||
      response.statusText ||
      "Failed to run Copilotz agent";
    const code = typeof detailsRecord?.code === "string"
      ? detailsRecord.code
      : (typeof detailsRecord?.error === "string" &&
          detailsRecord.error !== message
        ? detailsRecord.error
        : undefined);

    throw new CopilotzRequestError(message, {
      status: response.status,
      code,
      details,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let aggregatedText = "";
  let aggregatedReasoning = "";
  let lastCompletedText = "";
  let lastTokenWasReasoning = false;
  let hadNonReasoningContent = false;
  let activeLlmAttemptId: string | null = null;
  let activePhaseKind: "reasoning" | "answer" | null = null;
  let activePhaseId: string | null = null;
  let phaseOrdinal = -1;
  let fallbackAttemptOrdinal = 0;
  const collectedMessages: any[] = [];
  let collectedMedia: Record<string, string> | null = null;

  const resetTokenAggregation = () => {
    aggregatedText = "";
    aggregatedReasoning = "";
    lastTokenWasReasoning = false;
    hadNonReasoningContent = false;
  };

  const startAttempt = (event: unknown) => {
    activeLlmAttemptId = getLlmAttemptId(event) ??
      `stream-attempt:${fallbackAttemptOrdinal++}`;
    activePhaseKind = null;
    activePhaseId = null;
    phaseOrdinal = -1;
    resetTokenAggregation();
  };

  const getTokenContext = (isReasoning: boolean): StreamTokenContext => {
    if (!activeLlmAttemptId) {
      startAttempt(null);
    }
    const kind = isReasoning ? "reasoning" : "answer";
    if (activePhaseKind !== kind || !activePhaseId) {
      phaseOrdinal += 1;
      activePhaseKind = kind;
      activePhaseId = `${activeLlmAttemptId}:${kind}:${phaseOrdinal}`;
    }
    return {
      isReasoning,
      llmAttemptId: activeLlmAttemptId!,
      phaseId: activePhaseId,
      phaseOrdinal,
    };
  };

  const processEvent = async (eventChunk: string) => {
    if (!eventChunk.trim()) return;
    const lines = eventChunk.split("\n");
    let eventType = "message";
    let dataRaw = "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataRaw += line.slice(5).trim();
      }
    }

    if (!dataRaw) return;

    let payload: any;
    try {
      payload = JSON.parse(dataRaw);
    } catch (error) {
      console.warn(
        "copilotzService: failed to parse SSE payload",
        error,
        dataRaw,
      );
      return;
    }

    switch (eventType) {
      case "LLM_CALL": {
        startAttempt(payload);
        await onMessageEvent?.(payload);
        break;
      }
      case "TOKEN": {
        const inner = payload?.payload ?? payload;
        const chunk = typeof inner?.token === "string" ? inner.token : "";
        const isComplete = Boolean(inner?.isComplete);
        // Explicit flags always win. Legacy non-empty tokens without a flag
        // are answer text; only an empty completion may inherit its phase.
        const isReasoning = typeof inner?.isReasoning === "boolean"
          ? inner.isReasoning
          : chunk.length === 0 && isComplete
            ? activePhaseKind === "reasoning" || lastTokenWasReasoning
            : false;
        // Establish a fallback attempt before appending the first token;
        // startAttempt() resets the per-attempt aggregation buffers.
        const tokenContext = getTokenContext(isReasoning);
        if (isReasoning && !lastTokenWasReasoning && hadNonReasoningContent) {
          aggregatedReasoning = "";
          aggregatedText = "";
          hadNonReasoningContent = false;
        }
        lastTokenWasReasoning = isReasoning;
        if (!isReasoning) hadNonReasoningContent = true;
        if (chunk) {
          if (isReasoning) {
            aggregatedReasoning = appendChunk(aggregatedReasoning, chunk);
          } else {
            aggregatedText = appendChunk(aggregatedText, chunk);
          }
        }
        if (chunk || isComplete) {
          const tokenText = isReasoning ? aggregatedReasoning : aggregatedText;
          onToken?.(tokenText, isComplete, payload, tokenContext);
          if (isComplete) {
            if (!isReasoning && tokenText) {
              lastCompletedText = tokenText;
            }
            resetTokenAggregation();
            activePhaseKind = null;
            activePhaseId = null;
          }
        }
        break;
      }
      case "NEW_MESSAGE": {
        hadNonReasoningContent = true;
        lastTokenWasReasoning = false;
        collectedMessages.push(payload);
        await onMessageEvent?.(payload);
        break;
      }
      case "TOOL_CALL": {
        hadNonReasoningContent = true;
        lastTokenWasReasoning = false;
        await onMessageEvent?.(payload);
        break;
      }
      case "TOOL_CALL_DELTA": {
        await onMessageEvent?.(payload);
        break;
      }
      case "TOOL_RESULT":
      case "LLM_RESULT": {
        const resultAnswer =
          typeof payload?.payload?.answer === "string"
            ? payload.payload.answer
            : typeof payload?.answer === "string"
              ? payload.answer
              : undefined;
        if (resultAnswer) {
          lastCompletedText = resultAnswer;
        }
        resetTokenAggregation();
        await onMessageEvent?.(payload);
        break;
      }
      case "ASSET_CREATED": {
        const assetPayload =
          (payload && typeof payload === "object" && "payload" in payload)
            ? (payload as { payload?: any }).payload
            : payload;
        // Convert ASSET_CREATED to media format for backward compatibility
        if (assetPayload?.dataUrl) {
          collectedMedia = {
            [assetPayload.assetId || "0"]: assetPayload.dataUrl,
          };
        }
        // Call the asset event handler
        await onAssetEvent?.(assetPayload);
        break;
      }
      case "ERROR":
        throw new Error(payload?.error || "Copilotz stream error");
      default: {
        // Forward non-contract/custom events without turning them into
        // lifecycle primitives implicitly.
        const hasEnvelope =
          payload && typeof payload === "object" && "type" in payload;
        if (hasEnvelope) {
          await onMessageEvent?.(payload);
        } else {
          await onMessageEvent?.({ type: eventType, payload });
        }
        break;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes("\r")) {
      buffer = buffer.replace(/\r/g, "");
    }

    let eventBoundary = buffer.indexOf(SSE_LINE_BREAK);
    while (eventBoundary >= 0) {
      const chunk = buffer.slice(0, eventBoundary);
      buffer = buffer.slice(eventBoundary + SSE_LINE_BREAK.length);
      await processEvent(chunk);
      eventBoundary = buffer.indexOf(SSE_LINE_BREAK);
    }
  }

  if (buffer.length > 0) {
    await processEvent(buffer);
  }

  return {
    text: lastCompletedText || aggregatedText,
    messages: collectedMessages,
    media: collectedMedia,
  };
}

export async function fetchThreads(
  userId: string,
  getRequestHeaders?: RequestHeadersProvider,
) {
  const params = new URLSearchParams();
  params.set("participantId", userId);
  params.set("order", "desc");

  const res = await fetch(apiUrl(`/v1/threads?${params.toString()}`), {
    headers: await withAuthHeaders(
      { Accept: "application/json" },
      getRequestHeaders,
    ),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to load threads (${res.status})`);
  }

  const { data } = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data as RestThread[];
}

export async function fetchThreadActivity(
  threadId: string,
  getRequestHeaders?: RequestHeadersProvider,
): Promise<ThreadActivity> {
  const res = await fetch(apiUrl(`/v1/threads/${encodeURIComponent(threadId)}/activity`), {
    headers: await withAuthHeaders(
      { Accept: "application/json" },
      getRequestHeaders,
    ),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to load thread activity (${res.status})`);
  }

  const { data } = await res.json();
  return data as ThreadActivity;
}

export async function fetchAgents(
  getRequestHeaders?: RequestHeadersProvider,
): Promise<AgentOption[]> {
  const response = await fetch(apiUrl("/v1/agents"), {
    method: "GET",
    headers: await withAuthHeaders(
      { Accept: "application/json" },
      getRequestHeaders,
    ),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(
      errorText || `Failed to fetch agents (${response.status})`,
    );
  }

  const payload = await response.json() as { data?: AgentApiItem[] };
  const data = Array.isArray(payload?.data) ? payload.data : [];

  return data.map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description ?? undefined,
  }));
}

export async function fetchThreadMessages(
  threadId: string,
  getRequestHeaders?: RequestHeadersProvider,
) {
  const page = await fetchThreadMessagesPage(threadId, undefined, getRequestHeaders);
  return page.data;
}

export async function fetchThreadMessagesPage(
  threadId: string,
  options?: {
    limit?: number;
    before?: string | null;
    after?: string | null;
  },
  getRequestHeaders?: RequestHeadersProvider,
): Promise<RestMessagePage> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  if (options?.before) {
    params.set("before", options.before);
  }
  if (options?.after) {
    params.set("after", options.after);
  }

  const res = await fetch(
    apiUrl(`/v1/threads/${threadId}/messages?${params.toString()}`),
    {
      headers: await withAuthHeaders(
        { Accept: "application/json" },
        getRequestHeaders,
      ),
    },
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(
      errorText || `Failed to load thread messages (${res.status})`,
    );
  }

  const payload = await res.json();
  if (Array.isArray(payload)) {
    return {
      data: payload as RestMessage[],
      pageInfo: buildFallbackPageInfo(payload as RestMessage[]),
    };
  }
  if (Array.isArray(payload?.data)) {
    const data = payload.data as RestMessage[];
    const rawPageInfo = payload?.pageInfo;
    return {
      data,
      pageInfo: {
        hasMoreBefore: rawPageInfo?.hasMoreBefore === true,
        oldestMessageId: typeof rawPageInfo?.oldestMessageId === "string"
          ? rawPageInfo.oldestMessageId
          : data[0]?.id ?? null,
        newestMessageId: typeof rawPageInfo?.newestMessageId === "string"
          ? rawPageInfo.newestMessageId
          : data[data.length - 1]?.id ?? null,
      },
    };
  }
  return {
    data: [],
    pageInfo: {
      hasMoreBefore: false,
      oldestMessageId: null,
      newestMessageId: null,
    },
  };
}

export async function updateThread(
  threadId: string,
  updates: Partial<RestThread>,
  getRequestHeaders?: RequestHeadersProvider,
) {
  const res = await fetch(apiUrl(`/v1/threads/${threadId}`), {
    method: "PATCH",
    headers: await withAuthHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }, getRequestHeaders),
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to update thread (${res.status})`);
  }

  const data = await res.json();
  return data?.data ?? data?.body ?? data;
}

export async function editThreadMessage(
  threadId: string,
  messageId: string,
  content: string,
  getRequestHeaders?: RequestHeadersProvider,
) {
  const res = await fetch(
    apiUrl(`/v1/threads/${threadId}/messages/${messageId}/edit`),
    {
      method: "POST",
      headers: await withAuthHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }, getRequestHeaders),
      body: JSON.stringify({ content }),
    },
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to edit message (${res.status})`);
  }

  const data = await res.json();
  return data?.data ?? data?.body ?? data;
}

export async function deleteThread(
  threadId: string,
  getRequestHeaders?: RequestHeadersProvider,
) {
  const res = await fetch(apiUrl(`/v1/threads/${threadId}`), {
    method: "DELETE",
    headers: await withAuthHeaders(
      { Accept: "application/json" },
      getRequestHeaders,
    ),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to delete thread (${res.status})`);
  }

  return true;
}

export const copilotzService = {
  apiUrl,
  apiUrlObject,
  withAuthHeaders,
  fetchAgents,
  runCopilotzStream,
  fetchThreads,
  fetchThreadMessages,
  updateThread,
  editThreadMessage,
  deleteThread,
};
