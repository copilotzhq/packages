import type { AgentOption, MediaAttachment } from "@copilotz/chat-ui";
import {
  parseCanonicalMessagePage,
  type CanonicalContentRef,
  type CanonicalMessagePage,
  // @ts-expect-error Direct Node TypeScript tests require the source extension.
} from "./canonicalHistory.ts";
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import { getLlmAttemptId } from "./streamEvents.ts";
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import { parseServerSentEventStream } from "./sse.ts";

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

type MessageContent =
  | string
  | Array<
    | CanonicalContentRef
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
  agent?: {
    id: string;
    name: string;
  };
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

export type RunOptions = {
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
  /** Stable client-generated operation/idempotency identity. */
  operationId?: string;
  getRequestHeaders?: RequestHeadersProvider;
} & StreamCallbacks;

export type CopilotzStreamResult = {
  text: string;
  messages: any[];
  media: Record<string, string> | null;
};

export type CopilotzRunReceipt = {
  operationId: string;
  status: "accepted" | "running";
  thread: {
    id: string;
    externalId: string;
  };
  replayCursor: string;
  acceptedAt: string;
};

export type ThreadFeedEvent = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  retry?: number;
};

export type ThreadFeedResult = {
  cursor: string | null;
  retry?: number;
};

type StreamAttemptAccumulator = {
  id: string;
  text: string;
  reasoning: string;
  activePhaseKind: "reasoning" | "answer" | null;
  activePhaseId: string | null;
  phaseOrdinal: number;
  agent?: {
    id: string;
    name: string;
  };
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

const uploadedContentRef = (value: unknown): CanonicalContentRef => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Asset upload returned an invalid ContentRef.");
  }
  const ref = value as Record<string, unknown>;
  if (
    typeof ref.assetId !== "string" || !ref.assetId.trim() ||
    ref.kind !== "file" || ref.role !== "attachment" ||
    typeof ref.mediaType !== "string" || !ref.mediaType.trim() ||
    ref.disposition !== "attachment"
  ) {
    throw new TypeError("Asset upload returned an invalid ContentRef.");
  }
  return Object.freeze({
    assetId: ref.assetId.trim(),
    kind: "file",
    role: "attachment",
    mediaType: ref.mediaType.trim(),
    ...(typeof ref.name === "string" && ref.name.trim()
      ? { name: ref.name.trim() }
      : {}),
    disposition: "attachment",
  });
};

const uploadFileAttachment = async (
  attachment: Extract<MediaAttachment, { kind: "file" }>,
  getRequestHeaders: RequestHeadersProvider | undefined,
  signal: AbortSignal,
): Promise<CanonicalContentRef> => {
  const mediaType = attachment.mimeType || "application/octet-stream";
  const body = attachment.source ?? (() => {
    const bytes = new Uint8Array(dataUrlToArrayBuffer(attachment.dataUrl));
    if (!bytes.byteLength) {
      throw new TypeError("File attachment has no uploadable body.");
    }
    return new Blob([bytes], { type: mediaType });
  })();
  const fileName = attachment.fileName?.trim();
  const response = await fetch(apiUrl("/v1/assets"), {
    method: "POST",
    headers: await withAuthHeaders({
      Accept: "application/json",
      "Content-Type": mediaType,
      "Content-Disposition": fileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : "attachment",
      "Idempotency-Key": attachment.uploadId ?? crypto.randomUUID(),
    }, getRequestHeaders),
    body,
    signal,
  });
  const payload = await response.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  if (!response.ok) {
    const error = payload?.error && typeof payload.error === "object"
      ? payload.error as Record<string, unknown>
      : {};
    throw new CopilotzRequestError(
      typeof error.message === "string" && error.message.trim()
        ? error.message
        : response.statusText || "Failed to upload attachment",
      {
        status: response.status,
        ...(typeof error.code === "string" ? { code: error.code } : {}),
        ...(payload ? { details: payload } : {}),
      },
    );
  }
  const data = payload?.data && typeof payload.data === "object" &&
      !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : null;
  const content = uploadedContentRef(data?.content);
  // The optimistic user Message still uses this browser-local URL for its
  // download link until authoritative history replaces it. The UI owns that
  // preview lifetime; transport must not revoke it after upload.
  return content;
};

const parseRunReceipt = (value: unknown): CopilotzRunReceipt => {
  const document = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const raw = document?.data && typeof document.data === "object" &&
      !Array.isArray(document.data)
    ? document.data as Record<string, unknown>
    : document;
  const thread = raw?.thread && typeof raw.thread === "object" &&
      !Array.isArray(raw.thread)
    ? raw.thread as Record<string, unknown>
    : null;
  const operationId = typeof raw?.operationId === "string"
    ? raw.operationId.trim()
    : "";
  const status = raw?.status;
  const threadId = typeof thread?.id === "string" ? thread.id.trim() : "";
  const externalId = typeof thread?.externalId === "string"
    ? thread.externalId.trim()
    : "";
  const replayCursor = typeof raw?.replayCursor === "string"
    ? raw.replayCursor
    : "";
  const acceptedAt = typeof raw?.acceptedAt === "string"
    ? raw.acceptedAt.trim()
    : "";
  if (
    !operationId || (status !== "accepted" && status !== "running") ||
    !threadId || !externalId || !replayCursor || !acceptedAt
  ) {
    throw new TypeError("Copilotz run receipt is invalid.");
  }
  return Object.freeze({
    operationId,
    status,
    thread: Object.freeze({ id: threadId, externalId }),
    replayCursor,
    acceptedAt,
  });
};

async function submitCopilotzRun(
  options: RunOptions,
  responseMode: "legacy-stream" | "receipt",
): Promise<CopilotzStreamResult | CopilotzRunReceipt> {
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
    operationId,
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
    if (attachment.kind === "file") {
      preparedAttachmentParts.push(await uploadFileAttachment(
        attachment,
        getRequestHeaders,
        controller.signal,
      ));
      continue;
    }
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
    const only = parts[0];
    if (
      parts.length === 1 && "type" in only && only.type === "text"
    ) return only.text;
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

  const response = await fetch(apiUrl("/v1/channels/web"), {
    method: "POST",
    headers: await withAuthHeaders({
      "Content-Type": "application/json",
      Accept: responseMode === "receipt"
        ? "application/json"
        : "text/event-stream",
      ...(responseMode === "receipt" ? { Prefer: "respond-async" } : {}),
      ...(operationId ? { "Idempotency-Key": operationId } : {}),
    }, getRequestHeaders),
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!response.ok) {
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

  if (responseMode === "receipt") {
    return parseRunReceipt(await response.json());
  }

  if (!response.body) {
    throw new CopilotzRequestError("Copilotz stream response has no body", {
      status: response.status,
      code: "stream_body_missing",
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let lastCompletedText = "";
  let lastObservedAttemptId: string | null = null;
  let fallbackAttemptOrdinal = 0;
  const attempts = new Map<string, StreamAttemptAccumulator>();
  const collectedMessages: any[] = [];
  let collectedMedia: Record<string, string> | null = null;

  const streamAgent = (
    event: unknown,
  ): StreamAttemptAccumulator["agent"] => {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return undefined;
    }
    const raw = event as Record<string, unknown>;
    const payload = raw.payload && typeof raw.payload === "object" &&
        !Array.isArray(raw.payload)
      ? raw.payload as Record<string, unknown>
      : raw;
    const value = payload.agent && typeof payload.agent === "object" &&
        !Array.isArray(payload.agent)
      ? payload.agent as Record<string, unknown>
      : undefined;
    return value && typeof value.id === "string" && value.id.trim() &&
        typeof value.name === "string" && value.name.trim()
      ? { id: value.id.trim(), name: value.name.trim() }
      : undefined;
  };

  const createAttempt = (
    id: string,
    agent?: StreamAttemptAccumulator["agent"],
  ): StreamAttemptAccumulator => {
    const attempt = {
      id,
      text: "",
      reasoning: "",
      activePhaseKind: null,
      activePhaseId: null,
      phaseOrdinal: -1,
      ...(agent ? { agent } : {}),
    } satisfies StreamAttemptAccumulator;
    attempts.set(id, attempt);
    return attempt;
  };

  const attemptFor = (event: unknown): StreamAttemptAccumulator => {
    const eventAttemptId = getLlmAttemptId(event);
    const attemptId = eventAttemptId ?? lastObservedAttemptId ??
      `stream-attempt:${fallbackAttemptOrdinal++}`;
    lastObservedAttemptId = attemptId;
    const agent = streamAgent(event);
    const attempt = attempts.get(attemptId) ?? createAttempt(attemptId, agent);
    if (agent) attempt.agent = agent;
    return attempt;
  };

  const getTokenContext = (
    attempt: StreamAttemptAccumulator,
    isReasoning: boolean,
  ): StreamTokenContext => {
    const kind = isReasoning ? "reasoning" : "answer";
    if (attempt.activePhaseKind !== kind || !attempt.activePhaseId) {
      attempt.phaseOrdinal += 1;
      attempt.activePhaseKind = kind;
      attempt.activePhaseId =
        `${attempt.id}:${kind}:${attempt.phaseOrdinal}`;
    }
    return {
      isReasoning,
      llmAttemptId: attempt.id,
      phaseId: attempt.activePhaseId,
      phaseOrdinal: attempt.phaseOrdinal,
      ...(attempt.agent ? { agent: attempt.agent } : {}),
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

    let event: any;
    try {
      event = JSON.parse(dataRaw);
    } catch (error) {
      console.warn(
        "copilotzService: failed to parse SSE payload",
        error,
        dataRaw,
      );
      return;
    }
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new Error("Copilotz channel event must be an object");
    }
    if (typeof event.type !== "string" || event.type !== eventType) {
      throw new Error(
        `Copilotz channel event mismatch: '${eventType}' does not match payload`,
      );
    }

    if (event.type === "text.delta" || event.type === "reasoning.delta") {
      const attempt = attemptFor(event);
      const inner = event.payload;
      const chunk = typeof inner?.text === "string" ? inner.text : "";
      const isReasoning = event.type === "reasoning.delta";
      const tokenContext = getTokenContext(attempt, isReasoning);
      if (chunk) {
        if (isReasoning) {
          attempt.reasoning = appendChunk(attempt.reasoning, chunk);
        } else {
          attempt.text = appendChunk(attempt.text, chunk);
        }
        onToken?.(
          isReasoning ? attempt.reasoning : attempt.text,
          false,
          event,
          tokenContext,
        );
      }
      return;
    }

    if (event.type === "message.created") {
      collectedMessages.push(event);
      const workflow = event.metadata?.copilotzWorkflow;
      if (workflow?.kind === "agent_output") {
        const attemptId = getLlmAttemptId(event) ?? lastObservedAttemptId;
        const attempt = attemptId ? attempts.get(attemptId) : undefined;
        if (attempt?.activePhaseKind && attempt.activePhaseId) {
          const isReasoning = attempt.activePhaseKind === "reasoning";
          const value = isReasoning ? attempt.reasoning : attempt.text;
          if (value) {
            onToken?.(value, true, event, {
              isReasoning,
              llmAttemptId: attempt.id,
              phaseId: attempt.activePhaseId,
              phaseOrdinal: attempt.phaseOrdinal,
              ...(attempt.agent ? { agent: attempt.agent } : {}),
            });
            if (!isReasoning) lastCompletedText = value;
          }
        }
        if (attemptId) attempts.delete(attemptId);
      }
      await onMessageEvent?.(event);
      return;
    }

    if (event.type === "asset.created") {
      const assetPayload = event.payload;
      if (assetPayload?.dataUrl) {
        collectedMedia = {
          [assetPayload.assetId || "0"]: assetPayload.dataUrl,
        };
      }
      await onAssetEvent?.(assetPayload);
      return;
    }

    if (event.type === "error" || event.type === "stream.failed") {
      throw new Error(event.payload?.message || "Copilotz stream error");
    }

    await onMessageEvent?.(event);
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
    text: lastCompletedText ||
      (lastObservedAttemptId
        ? attempts.get(lastObservedAttemptId)?.text ?? ""
        : ""),
    messages: collectedMessages,
    media: collectedMedia,
  };
}

/** Legacy one-request streaming transport retained for compatible clients. */
export async function runCopilotzStream(
  options: RunOptions,
): Promise<CopilotzStreamResult> {
  return await submitCopilotzRun(options, "legacy-stream") as CopilotzStreamResult;
}

/** Accepts a durable run and returns without coupling its life to the request. */
export async function startCopilotzRun(
  options: RunOptions,
): Promise<CopilotzRunReceipt> {
  const stableOptions: RunOptions = {
    ...options,
    operationId: options.operationId?.trim() || crypto.randomUUID(),
    attachments: options.attachments?.map((attachment) =>
      attachment.kind === "file" && !attachment.uploadId
        ? { ...attachment, uploadId: crypto.randomUUID() }
        : attachment
    ),
  };
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await submitCopilotzRun(
        stableOptions,
        "receipt",
      ) as CopilotzRunReceipt;
    } catch (error) {
      const retryable = error instanceof CopilotzRequestError
        ? error.status === 0 || error.status === 429 || error.status >= 500
        : error instanceof TypeError;
      if (!retryable || attempt >= 2 || options.signal?.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(done, 250 * (2 ** attempt));
        const onAbort = () => {
          cleanup();
          reject(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));
        };
        function cleanup() {
          clearTimeout(timeout);
          options.signal?.removeEventListener("abort", onAbort);
        }
        function done() {
          cleanup();
          resolve();
        }
        options.signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }
}

export type ObserveThreadFeedOptions = {
  threadId: string;
  operationIds?: readonly string[];
  cursor?: string | null;
  getRequestHeaders?: RequestHeadersProvider;
  signal?: AbortSignal;
  watchdogMs?: number;
  onOpen?: () => void;
  onEvent: (event: ThreadFeedEvent) => void | Promise<void>;
};

/** Observes one feed connection. Reconnect policy remains caller-owned. */
export async function observeThreadFeed(
  options: ObserveThreadFeedOptions,
): Promise<ThreadFeedResult> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  const watchdogMs = options.watchdogMs ?? 45_000;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const armWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    if (!(watchdogMs > 0)) return;
    watchdog = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("Thread feed became silent", "TimeoutError"));
    }, watchdogMs);
  };

  let cursor = options.cursor ?? null;
  let retry: number | undefined;
  try {
    armWatchdog();
    const feedPath = apiUrl(
      `/v1/threads/${encodeURIComponent(options.threadId)}/feed`,
    );
    const feedUrl = new URL(
      feedPath,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    for (const operationId of [...new Set(options.operationIds ?? [])]) {
      if (operationId.trim()) feedUrl.searchParams.append("operationId", operationId.trim());
    }
    const response = await fetch(
      feedUrl,
      {
        method: "GET",
        cache: "no-store",
        headers: await withAuthHeaders({
          Accept: "text/event-stream",
          ...(cursor ? { "Last-Event-ID": cursor } : {}),
        }, options.getRequestHeaders),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const raw = await response.text().catch(() => response.statusText);
      const parsed = parseErrorText(raw);
      const envelope = parsed && typeof parsed === "object" &&
          !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : undefined;
      const nested = envelope?.error && typeof envelope.error === "object" &&
          !Array.isArray(envelope.error)
        ? envelope.error as Record<string, unknown>
        : envelope;
      throw new CopilotzRequestError(
        typeof nested?.message === "string" && nested.message.trim()
          ? nested.message
          : raw || response.statusText || "Failed to observe thread feed",
        {
          status: response.status,
          ...(typeof nested?.code === "string" ? { code: nested.code } : {}),
          ...(parsed !== null ? { details: parsed } : {}),
        },
      );
    }
    if (!response.body) {
      throw new CopilotzRequestError("Thread feed response has no body", {
        status: response.status,
        code: "feed_body_missing",
      });
    }
    options.onOpen?.();
    await parseServerSentEventStream(
      response.body,
      async (frame) => {
        if (!frame.id) {
          throw new TypeError("Thread feed event is missing its reconnect cursor.");
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(frame.data);
        } catch {
          throw new TypeError("Thread feed event data must be valid JSON.");
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new TypeError("Thread feed event data must be an object.");
        }
        const data = parsed as Record<string, unknown>;
        if (typeof data.type === "string" && data.type !== frame.event) {
          throw new TypeError("Thread feed event name does not match its payload.");
        }
        await options.onEvent(Object.freeze({
          id: frame.id,
          type: frame.event,
          data: Object.freeze(
            typeof data.type === "string" ? data : { ...data, type: frame.event },
          ),
          ...(frame.retry !== undefined ? { retry: frame.retry } : {}),
        }));
        // Applying the frame is the commit point for reconnect.
        cursor = frame.id;
        if (frame.retry !== undefined) retry = frame.retry;
      },
      armWatchdog,
    );
    return Object.freeze({ cursor, ...(retry !== undefined ? { retry } : {}) });
  } catch (error) {
    if (timedOut) {
      throw new CopilotzRequestError("Thread feed timed out", {
        status: 0,
        code: "feed_timeout",
      });
    }
    throw error;
  } finally {
    if (watchdog) clearTimeout(watchdog);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export type OperationCancellation = {
  operationId: string;
  status: "running" | "stopping" | "cancelled" | "completed" | "failed";
};

export async function cancelCopilotzOperation(
  operationId: string,
  getRequestHeaders?: RequestHeadersProvider,
  signal?: AbortSignal,
): Promise<OperationCancellation> {
  const normalized = operationId.trim();
  if (!normalized) throw new TypeError("operationId is required");
  const response = await fetch(
    apiUrl(`/v1/operations/${encodeURIComponent(normalized)}`),
    {
      method: "DELETE",
      headers: await withAuthHeaders({ Accept: "application/json" }, getRequestHeaders),
      signal,
    },
  );
  if (!response.ok) {
    const raw = await response.text().catch(() => response.statusText);
    throw new CopilotzRequestError(
      raw || response.statusText || "Failed to stop Copilotz operation",
      { status: response.status, details: parseErrorText(raw) },
    );
  }
  if (response.status === 204) {
    return Object.freeze({ operationId: normalized, status: "stopping" });
  }
  const document = await response.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  const raw = document?.data && typeof document.data === "object" &&
      !Array.isArray(document.data)
    ? document.data as Record<string, unknown>
    : document;
  const status = raw?.status;
  if (
    status !== "running" && status !== "stopping" && status !== "cancelled" &&
    status !== "completed" && status !== "failed"
  ) {
    throw new TypeError("Operation cancellation response is invalid.");
  }
  return Object.freeze({
    operationId: typeof raw?.operationId === "string" && raw.operationId.trim()
      ? raw.operationId.trim()
      : normalized,
    status,
  });
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
): Promise<CanonicalMessagePage> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 50));
  params.set("order", "desc");
  params.set("include", "content");
  if (options?.before) {
    params.set("before", options.before);
  }
  if (options?.after) {
    params.set("after", options.after);
  }

  const res = await fetch(
    apiUrl(
      `/v1/threads/${encodeURIComponent(threadId)}/messages?${params.toString()}`,
    ),
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

  return parseCanonicalMessagePage(await res.json());
}

export async function updateThread(
  threadId: string,
  updates: Partial<RestThread>,
  getRequestHeaders?: RequestHeadersProvider,
) {
  const res = await fetch(apiUrl(`/v1/threads/${encodeURIComponent(threadId)}`), {
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
    apiUrl(
      `/v1/threads/${encodeURIComponent(threadId)}/messages/${
        encodeURIComponent(messageId)
      }/edit`,
    ),
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
  const res = await fetch(apiUrl(`/v1/threads/${encodeURIComponent(threadId)}`), {
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
  startCopilotzRun,
  observeThreadFeed,
  cancelCopilotzOperation,
  runCopilotzStream,
  fetchThreads,
  fetchThreadMessages,
  updateThread,
  editThreadMessage,
  deleteThread,
};
