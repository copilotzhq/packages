import type { MediaAttachment } from '@copilotz/chat-ui';

const rawBaseValue = import.meta.env?.VITE_API_URL;
const rawBase = typeof rawBaseValue === 'string' && rawBaseValue.length > 0 ? rawBaseValue : '/api';
const normalizedBase = rawBase.replace(/\/$/, '');
const API_BASE = normalizedBase.startsWith('http') || normalizedBase.startsWith('/')
  ? normalizedBase
  : `/${normalizedBase}`;

const apiUrl = (path: string) => `${API_BASE}${path}`;

const runtimeProcess: typeof process | undefined = typeof process !== 'undefined' ? process : undefined;

const API_KEY = (() => {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const candidates = [
    env.VITE_API_KEY,
    env.VITE_COPILOTZ_API_KEY,
    runtimeProcess?.env?.COPILOTZ_API_KEY,
    runtimeProcess?.env?.API_KEY,
  ];
  return candidates.find((value) => typeof value === 'string' && value.length > 0);
})();

const withAuthHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
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

type RestMessage = {
  id: string;
  threadId: string;
  senderId?: string | null;
  senderType: string;
  senderUserId?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  toolCalls?: Array<Record<string, unknown>> | null;
  createdAt?: string;
  updatedAt?: string;
};

type MessageSenderType = 'agent' | 'user' | 'tool' | 'system';

type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image'; url?: string; dataBase64?: string; mimeType?: string; alt?: string }
      | { type: 'audio'; url?: string; dataBase64?: string; mimeType?: string; transcript?: string }
      | { type: 'file'; url?: string; dataBase64?: string; mimeType?: string; name?: string }
      | { type: 'json'; value: unknown }
    >;

type MessageToolCall = {
  id?: string | null;
  name: string;
  args: Record<string, unknown>;
};

type MessageThread = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  externalId?: string | null;
  participants?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type MessageSender = {
  id?: string | null;
  externalId?: string | null;
  type: MessageSenderType;
  name?: string | null;
  identifierType?: 'id' | 'name' | 'email' | null;
  metadata?: Record<string, unknown> | null;
};

type MessagePayload = {
  content: MessageContent;
  sender: MessageSender;
  thread?: MessageThread | null;
  toolCalls?: MessageToolCall[] | null;
  metadata?: Record<string, unknown> | null;
};

type StreamCallbacks = {
  onToken?: (token: string, isComplete: boolean, raw?: any) => void;
  onMessageEvent?: (payload: any) => void;
  onAssetEvent?: (payload: any) => void;
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
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  selectedAgent?: string | null;
} & StreamCallbacks;

export type CopilotzStreamResult = {
  text: string;
  messages: any[];
  media: Record<string, string> | null;
};

const SSE_LINE_BREAK = '\n\n';

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

const toAttachmentPayload = (attachments?: MediaAttachment[]) => {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map(att => {
    const base = {
      kind: att.kind,
      dataUrl: att.dataUrl,
      mimeType: att.mimeType,
      fileName: att.fileName,
    };
    if (att.kind === 'audio' || att.kind === 'video') {
      return {
        ...base,
        durationMs: att.durationMs,
        ...(att.kind === 'video' && 'poster' in att ? { poster: att.poster } : {}),
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

const parseDataUrl = (dataUrl: string): { mime: string; base64: string } | null => {
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
  writeString(offset, "RIFF"); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString(offset, "WAVE"); offset += 4;

  // fmt  subchunk
  writeString(offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;          // Subchunk1Size (16 for PCM)
  view.setUint16(offset, 1, true); offset += 2;           // AudioFormat (1 = PCM)
  view.setUint16(offset, numChannels, true); offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true); offset += 4;  // SampleRate
  view.setUint32(offset, sampleRate * numChannels * bytesPerSample, true); offset += 4; // ByteRate
  view.setUint16(offset, numChannels * bytesPerSample, true); offset += 2; // BlockAlign
  view.setUint16(offset, 16, true); offset += 2;          // BitsPerSample

  // data subchunk
  writeString(offset, "data"); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

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

const convertAudioDataUrlToWavBase64 = async (dataUrl: string): Promise<string | null> => {
  try {
    const ab = dataUrlToArrayBuffer(dataUrl);
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(ab.slice(0)); // ensure detached buffer
    // Optionally downsample here if desired; we'll keep source sampleRate.
    const wavBytes = encodeWav16BitPCM(audioBuffer);
    return base64FromUint8(wavBytes);
  } catch (_err) {
    return null;
  }
};

export async function runCopilotzStream(options: RunOptions): Promise<CopilotzStreamResult> {
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
    onToken,
    onMessageEvent,
    onAssetEvent,
    signal,
  } = options;

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  // Audio attachments are sent as content parts and also mirrored in metadata
  // so the persisted message can render the same media after reload.
  const audioAttachments = attachments?.filter(att => att.kind === 'audio') ?? [];
  const attachmentPayload = toAttachmentPayload(attachments);

  const normalizedToolCalls =
    toolCalls?.map<MessageToolCall>((call) => ({
      id: call.id ?? crypto.randomUUID(),
      name: call.name,
      args: call.args ?? {},
    })) ?? [];

  const metadataToolCalls =
    normalizedToolCalls.length > 0
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

  const messageMetadata = Object.keys(baseMetadata).length > 0 ? baseMetadata : undefined;

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

  const threadPayload: MessageThread | undefined = (threadId || threadExternalId || threadName || Object.keys(restThreadMetadata).length > 0)
    ? {
        id: threadId ?? null,
        externalId: threadExternalId ?? null,
        name: threadName,
        participants: [selectedAgent || 'assistant'],
        metadata: Object.keys(restThreadMetadata).length > 0 ? restThreadMetadata : null,
      }
    : undefined;

  // Prepare audio parts (convert to WAV when needed)
  const preparedAudioParts: Array<{ type: 'audio'; dataBase64?: string; url?: string; mimeType?: string; transcript?: string }> = [];
  for (const audioAtt of audioAttachments) {
    if (!audioAtt.dataUrl) continue;
    const parsed = parseDataUrl(audioAtt.dataUrl);
    if (parsed && (parsed.mime.includes('wav') || parsed.mime.includes('mp3') || parsed.mime.includes('mpeg'))) {
      preparedAudioParts.push({
        type: 'audio',
        dataBase64: parsed.base64,
        mimeType: parsed.mime.includes('wav') ? 'audio/wav' : 'audio/mp3',
      });
      continue;
    }
    // Convert other formats (e.g., audio/webm) to WAV
    const wavBase64 = await convertAudioDataUrlToWavBase64(audioAtt.dataUrl);
    if (wavBase64) {
      preparedAudioParts.push({
        type: 'audio',
        dataBase64: wavBase64,
        mimeType: 'audio/wav',
      });
    } else {
      // Fallback: send as URL (may fail at provider side, but do not block)
      preparedAudioParts.push({
        type: 'audio',
        url: audioAtt.dataUrl,
        mimeType: audioAtt.mimeType || 'audio/webm',
      });
    }
  }

  // Build content array: include text and prepared audio parts
  const contentParts: MessageContent = (() => {
    const parts: Array<
      | { type: 'text'; text: string }
      | { type: 'audio'; url?: string; dataBase64?: string; mimeType?: string; transcript?: string }
    > = [];
    const text = (typeof content === 'string' && content.trim().length > 0) ? content : '';
    parts.push({ type: 'text', text });
    for (const p of preparedAudioParts) parts.push(p);
    if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
    return parts;
  })();

  const payload: MessagePayload = {
    content: contentParts,
    sender: {
      type: normalizedToolCalls.length > 0 ? 'agent' : 'user',
      externalId: user.externalId,
      id: normalizedToolCalls.length > 0 ? 'assistant' : undefined,
      name: normalizedToolCalls.length > 0 ? 'assistant' : (user.name ?? null),
      metadata: Object.keys(senderMetadata).length > 0 ? senderMetadata : null,
    },
    metadata: messageMetadata ?? null,
    thread: threadPayload ?? null,
    toolCalls: normalizedToolCalls.length > 0 ? normalizedToolCalls : null,
  };

  const response = await fetch(apiUrl('/v1/providers/web'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(errorText || 'Failed to run Copilotz agent');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let aggregatedText = '';
  const collectedMessages: any[] = [];
  let collectedMedia: Record<string, string> | null = null;

  const processEvent = (eventChunk: string) => {
    if (!eventChunk.trim()) return;
    const lines = eventChunk.split('\n');
    let eventType = 'message';
    let dataRaw = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataRaw += line.slice(5).trim();
      }
    }

    if (!dataRaw) return;

    let payload: any;
    try {
      payload = JSON.parse(dataRaw);
    } catch (error) {
      console.warn('copilotzService: failed to parse SSE payload', error, dataRaw);
      return;
    }

    switch (eventType) {
      case 'TOKEN': {
        const chunk =
          typeof payload?.payload?.token === 'string'
            ? payload.payload.token
            : (typeof payload?.token === 'string' ? payload.token : '');
        if (chunk) {
          aggregatedText = appendChunk(aggregatedText, chunk);
        }
        const isComplete = Boolean(
          (payload && payload.payload && payload.payload.isComplete) ?? payload?.isComplete
        );
        if (chunk || isComplete) {
          onToken?.(aggregatedText, isComplete, payload);
        }
        break;
      }
      case 'MESSAGE': {
        collectedMessages.push(payload);
        // Pass the payload with its internal type (e.g., NEW_MESSAGE, MESSAGE, etc.)
        // The hook will use payload.type to determine the actual event type
        onMessageEvent?.(payload);
        const senderType =
          payload?.payload?.senderType ??
          payload?.payload?.sender?.type;

        if (senderType === 'agent' && typeof payload?.payload?.content === 'string') {
          aggregatedText = payload.payload.content;
        }
        break;
      }
      case 'TOOL_CALL': {
        // Pass TOOL_CALL events directly to the message event handler
        // The payload already has the full event structure with type: "TOOL_CALL"
        onMessageEvent?.(payload);
        break;
      }
      case 'ASSET_CREATED': {
        const assetPayload = (payload && typeof payload === 'object' && 'payload' in payload)
          ? (payload as { payload?: any }).payload
          : payload;
        // Convert ASSET_CREATED to media format for backward compatibility
        if (assetPayload?.dataUrl) {
          collectedMedia = {
            [assetPayload.assetId || '0']: assetPayload.dataUrl
          };
        }
        // Call the asset event handler
        onAssetEvent?.(assetPayload);
        break;
      }
      case 'ERROR':
        throw new Error(payload?.error || 'Copilotz stream error');
      default:
        // For other event types, wrap in a structure with type and payload
        onMessageEvent?.({ type: eventType, payload });
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes('\r')) {
      buffer = buffer.replace(/\r/g, '');
    }

    let eventBoundary = buffer.indexOf(SSE_LINE_BREAK);
    while (eventBoundary >= 0) {
      const chunk = buffer.slice(0, eventBoundary);
      buffer = buffer.slice(eventBoundary + SSE_LINE_BREAK.length);
      processEvent(chunk);
      eventBoundary = buffer.indexOf(SSE_LINE_BREAK);
    }
  }

  if (buffer.length > 0) {
    processEvent(buffer);
  }

  return {
    text: aggregatedText,
    messages: collectedMessages,
    media: collectedMedia,
  };
}

export async function fetchThreads(userId: string) {
  const params = new URLSearchParams();
  params.set('filters', JSON.stringify({ "metadata.userExternalId": userId } ));
  params.set('sort', '-updatedAt');

  const res = await fetch(apiUrl(`/v1/rest/threads?${params.toString()}`), {
    headers: withAuthHeaders({ Accept: 'application/json' }),
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

export async function fetchThreadMessages(threadId: string) {
  const params = new URLSearchParams();
  params.set('filters', JSON.stringify({ threadId }));
  params.set('sort', 'createdAt:asc');

  const res = await fetch(apiUrl(`/v1/rest/messages?${params.toString()}`), {
    headers: withAuthHeaders({ Accept: 'application/json' }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to load thread messages (${res.status})`);
  }

  const { data } = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data as RestMessage[];
}

export async function updateThread(threadId: string, updates: Partial<RestThread>) {
  const res = await fetch(apiUrl(`/v1/rest/threads/${threadId}`), {
    method: 'PUT',
    headers: withAuthHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to update thread (${res.status})`);
  }

  const data = await res.json();
  return data?.body ?? data;
}

export async function deleteMessagesByThreadId(threadId: string) {
  // First fetch all messages for the thread (no field selection to avoid issues)
  const params = new URLSearchParams();
  params.set('filters', JSON.stringify({ threadId }));

  const res = await fetch(apiUrl(`/v1/rest/messages?${params.toString()}`), {
    headers: withAuthHeaders({ Accept: 'application/json' }),
  });

  if (!res.ok) {
    // If we can't fetch messages, we can't delete them - but this might be ok if there are none
    console.warn('Could not fetch messages for deletion:', res.status);
    return;
  }

  const { data } = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return; // No messages to delete
  }

  // Delete each message sequentially to avoid overwhelming the server
  for (const msg of data) {
    if (msg?.id) {
      try {
        await fetch(apiUrl(`/v1/rest/messages/${msg.id}`), {
          method: 'DELETE',
          headers: withAuthHeaders({ Accept: 'application/json' }),
        });
      } catch {
        // Ignore individual message delete errors
      }
    }
  }
}

export async function deleteThread(threadId: string) {
  // First delete all messages in the thread to avoid foreign key constraint
  await deleteMessagesByThreadId(threadId);

  const res = await fetch(apiUrl(`/v1/rest/threads/${threadId}`), {
    method: 'DELETE',
    headers: withAuthHeaders({ Accept: 'application/json' }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to delete thread (${res.status})`);
  }

  return true;
}

export const copilotzService = {
  runCopilotzStream,
  fetchThreads,
  fetchThreadMessages,
  updateThread,
  deleteThread,
};
