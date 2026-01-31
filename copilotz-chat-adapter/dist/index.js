// src/CopilotzChat.tsx
import { useMemo } from "react";
import { ChatUI, ChatUserContextProvider } from "@copilotz/chat-ui";

// ../node_modules/lucide-react/dist/esm/createLucideIcon.js
import { forwardRef as forwardRef2, createElement as createElement2 } from "react";

// ../node_modules/lucide-react/dist/esm/shared/src/utils.js
var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
var toCamelCase = (string) => string.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
);
var toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
var mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
var hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
};

// ../node_modules/lucide-react/dist/esm/Icon.js
import { forwardRef, createElement } from "react";

// ../node_modules/lucide-react/dist/esm/defaultAttributes.js
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

// ../node_modules/lucide-react/dist/esm/Icon.js
var Icon = forwardRef(
  ({
    color = "currentColor",
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    className = "",
    children,
    iconNode,
    ...rest
  }, ref) => createElement(
    "svg",
    {
      ref,
      ...defaultAttributes,
      width: size,
      height: size,
      stroke: color,
      strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
      className: mergeClasses("lucide", className),
      ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
      ...rest
    },
    [
      ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
      ...Array.isArray(children) ? children : [children]
    ]
  )
);

// ../node_modules/lucide-react/dist/esm/createLucideIcon.js
var createLucideIcon = (iconName, iconNode) => {
  const Component = forwardRef2(
    ({ className, ...props }, ref) => createElement2(Icon, {
      ref,
      iconNode,
      className: mergeClasses(
        `lucide-${toKebabCase(toPascalCase(iconName))}`,
        `lucide-${iconName}`,
        className
      ),
      ...props
    })
  );
  Component.displayName = toPascalCase(iconName);
  return Component;
};

// ../node_modules/lucide-react/dist/esm/icons/user.js
var __iconNode = [
  ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", key: "975kel" }],
  ["circle", { cx: "12", cy: "7", r: "4", key: "17ys0d" }]
];
var User = createLucideIcon("user", __iconNode);

// src/useCopilotzChat.ts
import { useState, useCallback, useRef, useEffect } from "react";

// src/copilotzService.ts
var rawBaseValue = import.meta.env?.VITE_API_URL;
var rawBase = typeof rawBaseValue === "string" && rawBaseValue.length > 0 ? rawBaseValue : "/api";
var normalizedBase = rawBase.replace(/\/$/, "");
var API_BASE = normalizedBase.startsWith("http") || normalizedBase.startsWith("/") ? normalizedBase : `/${normalizedBase}`;
var apiUrl = (path) => `${API_BASE}${path}`;
var runtimeProcess = typeof process !== "undefined" ? process : void 0;
var API_KEY = (() => {
  const env = import.meta.env ?? {};
  const candidates = [
    env.VITE_API_KEY,
    env.VITE_COPILOTZ_API_KEY,
    runtimeProcess?.env?.COPILOTZ_API_KEY,
    runtimeProcess?.env?.API_KEY
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0);
})();
var withAuthHeaders = (headers = {}) => {
  if (API_KEY) {
    return { ...headers, Authorization: `Bearer ${API_KEY}` };
  }
  return headers;
};
var SSE_LINE_BREAK = "\n\n";
var appendChunk = (buffer, chunk) => {
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
var toAttachmentPayload = (attachments) => {
  if (!attachments || attachments.length === 0) return void 0;
  return attachments.map((att) => {
    const base = {
      kind: att.kind,
      dataUrl: att.dataUrl,
      mimeType: att.mimeType,
      fileName: att.fileName
    };
    if (att.kind === "audio" || att.kind === "video") {
      return {
        ...base,
        durationMs: att.durationMs,
        ...att.kind === "video" && "poster" in att ? { poster: att.poster } : {}
      };
    }
    return base;
  });
};
var base64FromUint8 = (bytes) => {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};
var parseDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
};
var dataUrlToArrayBuffer = (dataUrl) => {
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
var encodeWav16BitPCM = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset2, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset2 + i, str.charCodeAt(i));
    }
  };
  let offset = 0;
  writeString(offset, "RIFF");
  offset += 4;
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString(offset, "WAVE");
  offset += 4;
  writeString(offset, "fmt ");
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * numChannels * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, numChannels * bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString(offset, "data");
  offset += 4;
  view.setUint32(offset, dataSize, true);
  offset += 4;
  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }
  let idx = 0;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      const s = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset + idx, s, true);
      idx += 2;
    }
  }
  return new Uint8Array(buffer);
};
var convertAudioDataUrlToWavBase64 = async (dataUrl) => {
  try {
    const ab = dataUrlToArrayBuffer(dataUrl);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
    const wavBytes = encodeWav16BitPCM(audioBuffer);
    return base64FromUint8(wavBytes);
  } catch (_err) {
    return null;
  }
};
async function runCopilotzStream(options) {
  const {
    threadId,
    threadExternalId,
    content,
    user,
    attachments,
    metadata,
    threadMetadata,
    toolCalls,
    onToken,
    onMessageEvent,
    onAssetEvent,
    signal
  } = options;
  const controller = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  const audioAttachments = attachments?.filter((att) => att.kind === "audio") ?? [];
  const nonAudioAttachments = attachments?.filter((att) => att.kind !== "audio") ?? [];
  const attachmentPayload = toAttachmentPayload(nonAudioAttachments);
  const normalizedToolCalls = toolCalls?.map((call) => ({
    id: call.id ?? crypto.randomUUID(),
    name: call.name,
    args: call.args ?? {}
  })) ?? [];
  const metadataToolCalls = normalizedToolCalls.length > 0 ? normalizedToolCalls.map((tc) => ({
    id: tc.id ?? void 0,
    name: tc.name,
    args: JSON.stringify(tc.args ?? {})
  })) : void 0;
  const baseMetadata = {
    ...metadata ?? {},
    ...attachmentPayload ? { attachments: attachmentPayload } : {},
    ...metadataToolCalls ? { toolCalls: metadataToolCalls } : {},
    userExternalId: user.externalId
  };
  const messageMetadata = Object.keys(baseMetadata).length > 0 ? baseMetadata : void 0;
  const senderMetadata = {
    ...user.metadata ?? {},
    ...user.email ? { email: user.email } : {}
  };
  const mergedThreadMetadata = {
    ...threadMetadata ?? {}
  };
  if (mergedThreadMetadata.userExternalId === void 0) {
    mergedThreadMetadata.userExternalId = user.externalId;
  }
  const threadName = mergedThreadMetadata.name ?? null;
  const { name: _threadName, ...restThreadMetadata } = mergedThreadMetadata;
  const threadPayload = threadId || threadExternalId || threadName || Object.keys(restThreadMetadata).length > 0 ? {
    id: threadId ?? null,
    externalId: threadExternalId ?? null,
    name: threadName,
    participants: ["assistant"],
    metadata: Object.keys(restThreadMetadata).length > 0 ? restThreadMetadata : null
  } : void 0;
  const preparedAudioParts = [];
  for (const audioAtt of audioAttachments) {
    if (!audioAtt.dataUrl) continue;
    const parsed = parseDataUrl(audioAtt.dataUrl);
    if (parsed && (parsed.mime.includes("wav") || parsed.mime.includes("mp3") || parsed.mime.includes("mpeg"))) {
      preparedAudioParts.push({
        type: "audio",
        dataBase64: parsed.base64,
        mimeType: parsed.mime.includes("wav") ? "audio/wav" : "audio/mp3"
      });
      continue;
    }
    const wavBase64 = await convertAudioDataUrlToWavBase64(audioAtt.dataUrl);
    if (wavBase64) {
      preparedAudioParts.push({
        type: "audio",
        dataBase64: wavBase64,
        mimeType: "audio/wav"
      });
    } else {
      preparedAudioParts.push({
        type: "audio",
        url: audioAtt.dataUrl,
        mimeType: audioAtt.mimeType || "audio/webm"
      });
    }
  }
  const contentParts = (() => {
    const parts = [];
    const text = typeof content === "string" && content.trim().length > 0 ? content : "";
    parts.push({ type: "text", text });
    for (const p of preparedAudioParts) parts.push(p);
    if (parts.length === 1 && parts[0].type === "text") return parts[0].text;
    return parts;
  })();
  const payload = {
    content: contentParts,
    sender: {
      type: normalizedToolCalls.length > 0 ? "agent" : "user",
      externalId: user.externalId,
      id: normalizedToolCalls.length > 0 ? "assistant" : void 0,
      name: normalizedToolCalls.length > 0 ? "assistant" : user.name ?? null,
      metadata: Object.keys(senderMetadata).length > 0 ? senderMetadata : null
    },
    metadata: messageMetadata ?? null,
    thread: threadPayload ?? null,
    toolCalls: normalizedToolCalls.length > 0 ? normalizedToolCalls : null
  };
  const response = await fetch(apiUrl("/v1/providers/web"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(errorText || "Failed to run Copilotz agent");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let aggregatedText = "";
  const collectedMessages = [];
  let collectedMedia = null;
  const processEvent = (eventChunk) => {
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
    let payload2;
    try {
      payload2 = JSON.parse(dataRaw);
    } catch (error) {
      console.warn("copilotzService: failed to parse SSE payload", error, dataRaw);
      return;
    }
    switch (eventType) {
      case "TOKEN": {
        const chunk = typeof payload2?.payload?.token === "string" ? payload2.payload.token : typeof payload2?.token === "string" ? payload2.token : "";
        if (chunk) {
          aggregatedText = appendChunk(aggregatedText, chunk);
        }
        const isComplete = Boolean(
          (payload2 && payload2.payload && payload2.payload.isComplete) ?? payload2?.isComplete
        );
        if (chunk || isComplete) {
          onToken?.(aggregatedText, isComplete, payload2);
        }
        break;
      }
      case "MESSAGE": {
        collectedMessages.push(payload2);
        onMessageEvent?.(payload2);
        const senderType = payload2?.payload?.senderType ?? payload2?.payload?.sender?.type;
        if (senderType === "agent" && typeof payload2?.payload?.content === "string") {
          aggregatedText = payload2.payload.content;
        }
        break;
      }
      case "TOOL_CALL": {
        onMessageEvent?.(payload2);
        break;
      }
      case "ASSET_CREATED": {
        const assetPayload = payload2 && typeof payload2 === "object" && "payload" in payload2 ? payload2.payload : payload2;
        if (assetPayload?.dataUrl) {
          collectedMedia = {
            [assetPayload.assetId || "0"]: assetPayload.dataUrl
          };
        }
        onAssetEvent?.(assetPayload);
        break;
      }
      case "ERROR":
        throw new Error(payload2?.error || "Copilotz stream error");
      default:
        onMessageEvent?.({ type: eventType, payload: payload2 });
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
    media: collectedMedia
  };
}
async function fetchThreads(userId) {
  const params = new URLSearchParams();
  params.set("filters", JSON.stringify({ "metadata.userExternalId": userId }));
  params.set("sort", "-updatedAt");
  const res = await fetch(apiUrl(`/v1/rest/threads?${params.toString()}`), {
    headers: withAuthHeaders({ Accept: "application/json" })
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to load threads (${res.status})`);
  }
  const { data } = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return data;
}
async function fetchThreadMessages(threadId) {
  const params = new URLSearchParams();
  params.set("filters", JSON.stringify({ threadId }));
  params.set("sort", "createdAt:asc");
  const res = await fetch(apiUrl(`/v1/rest/messages?${params.toString()}`), {
    headers: withAuthHeaders({ Accept: "application/json" })
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to load thread messages (${res.status})`);
  }
  const { data } = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return data;
}
async function updateThread(threadId, updates) {
  const res = await fetch(apiUrl(`/v1/rest/threads/${threadId}`), {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to update thread (${res.status})`);
  }
  const data = await res.json();
  return data?.body ?? data;
}
async function deleteMessagesByThreadId(threadId) {
  const params = new URLSearchParams();
  params.set("filters", JSON.stringify({ threadId }));
  const res = await fetch(apiUrl(`/v1/rest/messages?${params.toString()}`), {
    headers: withAuthHeaders({ Accept: "application/json" })
  });
  if (!res.ok) {
    console.warn("Could not fetch messages for deletion:", res.status);
    return;
  }
  const { data } = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return;
  }
  for (const msg of data) {
    if (msg?.id) {
      try {
        await fetch(apiUrl(`/v1/rest/messages/${msg.id}`), {
          method: "DELETE",
          headers: withAuthHeaders({ Accept: "application/json" })
        });
      } catch {
      }
    }
  }
}
async function deleteThread(threadId) {
  await deleteMessagesByThreadId(threadId);
  const res = await fetch(apiUrl(`/v1/rest/threads/${threadId}`), {
    method: "DELETE",
    headers: withAuthHeaders({ Accept: "application/json" })
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Failed to delete thread (${res.status})`);
  }
  return true;
}
var copilotzService = {
  runCopilotzStream,
  fetchThreads,
  fetchThreadMessages,
  updateThread,
  deleteThread
};

// src/assetsService.ts
var rawBaseValue2 = import.meta.env?.VITE_API_URL;
var rawBase2 = typeof rawBaseValue2 === "string" && rawBaseValue2.length > 0 ? rawBaseValue2 : "/api";
var normalizedBase2 = rawBase2.replace(/\/$/, "");
var API_BASE2 = normalizedBase2.startsWith("http") || normalizedBase2.startsWith("/") ? normalizedBase2 : `/${normalizedBase2}`;
var apiUrl2 = (path) => `${API_BASE2}${path}`;
var extractAssetId = (refOrId) => refOrId.startsWith("asset://") ? refOrId.slice("asset://".length) : refOrId;
async function getAssetDataUrl(refOrId) {
  const id = extractAssetId(refOrId);
  const res = await fetch(apiUrl2(`/v1/assets/${encodeURIComponent(id)}?format=dataUrl`), {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Failed to fetch asset ${refOrId}`);
  }
  const data = await res.json();
  if (!data?.dataUrl) {
    throw new Error(data?.error || `Asset ${refOrId} has no dataUrl`);
  }
  return { dataUrl: data.dataUrl, mime: data.mime, assetId: data.assetId };
}
async function resolveAssetsInMessages(messages) {
  const resolved = [];
  for (const msg of messages) {
    const meta = msg.metadata ?? void 0;
    const attachments = Array.isArray(meta?.attachments) ? meta.attachments : void 0;
    if (!attachments || attachments.length === 0) {
      resolved.push(msg);
      continue;
    }
    const newAttachments = [];
    for (const att of attachments) {
      const assetRef = typeof att?.assetRef === "string" ? att.assetRef : void 0;
      if (assetRef) {
        try {
          const { dataUrl, mime } = await getAssetDataUrl(assetRef);
          const kind = typeof att.kind === "string" ? att.kind : "image";
          newAttachments.push({
            kind,
            dataUrl,
            mimeType: typeof att.mimeType === "string" ? att.mimeType : mime ?? void 0
          });
        } catch {
          newAttachments.push(att);
        }
      } else {
        newAttachments.push(att);
      }
    }
    const newMeta = { ...meta ?? {}, attachments: newAttachments };
    resolved.push({ ...msg, metadata: newMeta });
  }
  return resolved;
}

// src/useCopilotzChat.ts
var nowTs = () => Date.now();
var generateId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError" || typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
var convertServerMessage = (msg) => {
  const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : nowTs();
  const metadata = msg.metadata ?? void 0;
  const attachmentsMeta = Array.isArray(metadata?.attachments) ? metadata.attachments : [];
  const attachments = attachmentsMeta.flatMap((att) => {
    const kind = typeof att.kind === "string" ? att.kind : void 0;
    const dataUrl = typeof att.dataUrl === "string" ? att.dataUrl : void 0;
    const mimeType = typeof att.mimeType === "string" ? att.mimeType : void 0;
    if (!dataUrl) return [];
    if (kind === "image") {
      return [{ kind: "image", dataUrl, mimeType: mimeType ?? "image/jpeg" }];
    }
    if (kind === "audio") {
      return [{
        kind: "audio",
        dataUrl,
        mimeType: mimeType ?? "audio/webm",
        durationMs: typeof att.durationMs === "number" ? att.durationMs : void 0
      }];
    }
    if (kind === "video") {
      return [{
        kind: "video",
        dataUrl,
        mimeType: mimeType ?? "video/mp4",
        durationMs: typeof att.durationMs === "number" ? att.durationMs : void 0,
        poster: typeof att.poster === "string" ? att.poster : void 0
      }];
    }
    return [];
  });
  const role = msg.senderType === "agent" ? "assistant" : msg.senderType === "user" ? "user" : "assistant";
  const mappedToolCalls = Array.isArray(msg.toolCalls) ? (msg.toolCalls || []).map((tc) => ({
    id: typeof tc?.id === "string" ? tc.id : generateId(),
    name: typeof tc?.name === "string" ? tc.name : "tool",
    arguments: tc?.args || {},
    status: "completed"
  })) : void 0;
  const hasToolCalls = Array.isArray(mappedToolCalls) && mappedToolCalls.length > 0;
  const isToolSender = msg.senderType === "tool";
  const content = isToolSender ? "" : (msg.content ?? "") || (hasToolCalls ? "" : "");
  return {
    id: msg.id,
    role,
    content,
    timestamp,
    attachments: attachments.length > 0 ? attachments : void 0,
    isStreaming: false,
    isComplete: true,
    metadata,
    toolCalls: hasToolCalls ? mappedToolCalls : void 0
  };
};
function useCopilotz({ userId, initialContext, bootstrap, defaultThreadName, onToolOutput }) {
  const [threads, setThreads] = useState([]);
  const [threadMetadataMap, setThreadMetadataMap] = useState({});
  const [threadExternalIdMap, setThreadExternalIdMap] = useState({});
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [currentThreadExternalId, setCurrentThreadExternalId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [userContextSeed, setUserContextSeed] = useState(initialContext || {});
  const threadsRef = useRef(threads);
  const threadMetadataMapRef = useRef(threadMetadataMap);
  const threadExternalIdMapRef = useRef(threadExternalIdMap);
  const currentThreadIdRef = useRef(currentThreadId);
  const currentThreadExternalIdRef = useRef(currentThreadExternalId);
  const userContextSeedRef = useRef(userContextSeed);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    threadMetadataMapRef.current = threadMetadataMap;
  }, [threadMetadataMap]);
  useEffect(() => {
    threadExternalIdMapRef.current = threadExternalIdMap;
  }, [threadExternalIdMap]);
  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
  }, [currentThreadId]);
  useEffect(() => {
    currentThreadExternalIdRef.current = currentThreadExternalId;
  }, [currentThreadExternalId]);
  useEffect(() => {
    userContextSeedRef.current = userContextSeed;
  }, [userContextSeed]);
  const abortControllerRef = useRef(null);
  const messagesRequestRef = useRef(0);
  const initializationRef = useRef({ userId: null, started: false });
  useEffect(() => {
    if (initialContext) {
      setUserContextSeed((prev) => ({ ...prev, ...initialContext }));
    }
  }, [initialContext]);
  const processToolOutput = useCallback((output) => {
    if (!output) return;
    const contextPatch = {};
    if (output.userContext && typeof output.userContext === "object") {
      Object.assign(contextPatch, output.userContext);
    }
    if (Object.keys(contextPatch).length > 0) {
      setUserContextSeed((prev) => ({ ...prev, ...contextPatch }));
    }
    onToolOutput?.(output);
  }, [onToolOutput]);
  const handleStreamMessageEvent = useCallback((event) => {
    const payload = event?.payload;
    if (!payload) return;
    if (payload.senderType === "tool") {
      const metadata = payload.metadata ?? event.metadata ?? {};
      const output = metadata?.output ?? metadata;
      if (output) processToolOutput(output);
      const toolName = metadata?.toolName || metadata?.tool || "tool";
      let argsObj = {};
      try {
        const argStr = metadata?.arguments ?? "{}";
        argsObj = typeof argStr === "string" ? JSON.parse(argStr) : argStr;
      } catch (_) {
      }
      const resultObj = metadata?.output;
      const callId = payload.toolCallId || generateId();
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          const m = next[i];
          if (m.role === "assistant") {
            const existing = Array.isArray(m.toolCalls) ? m.toolCalls : [];
            next[i] = {
              ...m,
              toolCalls: [
                ...existing,
                {
                  id: callId,
                  name: toolName,
                  arguments: argsObj,
                  result: resultObj,
                  status: "completed",
                  endTime: Date.now()
                }
              ]
            };
            break;
          }
        }
        return next;
      });
      return;
    }
    if (payload.senderType === "agent" && typeof payload.content === "string") {
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          const m = next[i];
          if (m.role === "assistant" && m.isStreaming) {
            next[i] = { ...m, content: payload.content, isStreaming: false, isComplete: true };
            break;
          }
        }
        return next;
      });
    }
  }, [processToolOutput]);
  const updateThreadsState = useCallback((rawThreads, preferredExternalId) => {
    const metadataMap = {};
    const externalMap = {};
    const normalized = rawThreads.map((thread) => {
      metadataMap[thread.id] = thread.metadata ?? void 0;
      externalMap[thread.id] = thread.externalId ?? null;
      const updatedAt = thread.updatedAt ? new Date(thread.updatedAt).getTime() : nowTs();
      const createdAt = thread.createdAt ? new Date(thread.createdAt).getTime() : updatedAt;
      return {
        id: thread.id,
        title: thread.name || "Chat",
        createdAt,
        updatedAt,
        messageCount: typeof thread.metadata?.messageCount === "number" ? thread.metadata.messageCount : 0,
        isArchived: thread.status === "archived",
        metadata: thread.metadata ?? void 0
      };
    });
    setThreadMetadataMap(metadataMap);
    setThreadExternalIdMap(externalMap);
    setThreads(normalized);
    const curExtId = currentThreadExternalIdRef.current;
    const curId = currentThreadIdRef.current;
    let nextThreadId = null;
    if (preferredExternalId) {
      const preferred = rawThreads.find((thread) => (thread.externalId ?? thread.id) === preferredExternalId);
      if (preferred) nextThreadId = preferred.id;
    }
    if (!nextThreadId && curExtId) {
      const match = rawThreads.find((thread) => (thread.externalId ?? thread.id) === curExtId);
      if (match) nextThreadId = match.id;
    }
    if (!nextThreadId && curId && rawThreads.some((thread) => thread.id === curId)) {
      nextThreadId = curId;
    }
    if (!nextThreadId && normalized.length > 0) {
      nextThreadId = normalized[0].id;
    }
    setCurrentThreadId(nextThreadId ?? null);
    setCurrentThreadExternalId(nextThreadId ? externalMap[nextThreadId] ?? null : null);
    return nextThreadId;
  }, []);
  const fetchAndSetThreadsState = useCallback(async (uid, preferredExternalId) => {
    try {
      const rawThreads = await fetchThreads(uid);
      return updateThreadsState(rawThreads, preferredExternalId);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("Error loading threads", error);
      return null;
    }
  }, [updateThreadsState]);
  const loadThreadMessages = useCallback(async (threadId) => {
    const requestId = Date.now();
    messagesRequestRef.current = requestId;
    try {
      const rawMessages = await fetchThreadMessages(threadId);
      const resolvedMessages = await resolveAssetsInMessages(rawMessages);
      if (messagesRequestRef.current !== requestId) return;
      resolvedMessages.forEach((msg) => {
        if (msg.senderType === "tool") {
          const metadata = msg.metadata;
          const output = metadata?.output ?? metadata;
          if (output) processToolOutput(output);
        }
      });
      const viewMessages = resolvedMessages.filter((msg) => {
        const text = (typeof msg.content === "string" ? msg.content : "").trim();
        const hasText = text.length > 0;
        const hasToolCalls = Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0;
        const meta = msg.metadata ?? {};
        const hasAttachments = Array.isArray(meta.attachments) && meta.attachments.length > 0;
        if (msg.senderType === "tool") {
          return hasAttachments;
        }
        return hasText || hasToolCalls || hasAttachments;
      }).map(convertServerMessage);
      setMessages(viewMessages);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error(`Error loading messages for thread ${threadId}`, error);
    }
  }, [processToolOutput]);
  const handleSelectThread = useCallback(async (threadId) => {
    setCurrentThreadId(threadId);
    const extMap = threadExternalIdMapRef.current;
    setCurrentThreadExternalId(extMap[threadId] ?? null);
    await loadThreadMessages(threadId);
  }, [loadThreadMessages]);
  const handleCreateThread = useCallback((title) => {
    const id = generateId();
    const now = nowTs();
    const newThread = {
      id,
      title: title?.trim() || "New Chat",
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      metadata: { pendingTitle: title?.trim() || void 0 }
    };
    setThreads((prev) => [newThread, ...prev]);
    setThreadMetadataMap((prev) => ({ ...prev, [id]: { pendingTitle: title?.trim() || void 0 } }));
    setThreadExternalIdMap((prev) => ({ ...prev, [id]: id }));
    setCurrentThreadId(id);
    setCurrentThreadExternalId(id);
    setMessages([]);
  }, []);
  const handleRenameThread = useCallback(async (threadId, newTitle) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;
    setThreads(
      (prev) => prev.map((t) => t.id === threadId ? { ...t, title: trimmedTitle, updatedAt: nowTs() } : t)
    );
    const extMap = threadExternalIdMapRef.current;
    const isPlaceholder = extMap[threadId] === threadId;
    if (isPlaceholder) {
      setThreadMetadataMap((prev) => ({
        ...prev,
        [threadId]: { ...prev[threadId], pendingTitle: trimmedTitle }
      }));
    } else {
      try {
        await updateThread(threadId, { name: trimmedTitle });
      } catch (error) {
        console.error("Failed to rename thread:", error);
        if (userId) {
          await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
        }
      }
    }
  }, [userId, fetchAndSetThreadsState]);
  const handleArchiveThread = useCallback(async (threadId) => {
    const thread = threadsRef.current.find((t) => t.id === threadId);
    if (!thread) return;
    const newArchivedStatus = !thread.isArchived;
    setThreads(
      (prev) => prev.map((t) => t.id === threadId ? { ...t, isArchived: newArchivedStatus, updatedAt: nowTs() } : t)
    );
    const extMap = threadExternalIdMapRef.current;
    const isPlaceholder = extMap[threadId] === threadId;
    if (!isPlaceholder) {
      try {
        await updateThread(threadId, { status: newArchivedStatus ? "archived" : "active" });
      } catch (error) {
        console.error("Failed to archive thread:", error);
        if (userId) {
          await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
        }
      }
    }
  }, [userId, fetchAndSetThreadsState]);
  const handleDeleteThread = useCallback(async (threadId) => {
    const extMap = threadExternalIdMapRef.current;
    const isPlaceholder = extMap[threadId] === threadId;
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    setThreadMetadataMap((prev) => {
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
    setThreadExternalIdMap((prev) => {
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
    if (currentThreadIdRef.current === threadId) {
      const remaining = threadsRef.current.filter((t) => t.id !== threadId);
      if (remaining.length > 0) {
        setCurrentThreadId(remaining[0].id);
        setCurrentThreadExternalId(extMap[remaining[0].id] ?? null);
        await loadThreadMessages(remaining[0].id);
      } else {
        setCurrentThreadId(null);
        setCurrentThreadExternalId(null);
        setMessages([]);
      }
    }
    if (!isPlaceholder) {
      try {
        await deleteThread(threadId);
      } catch (error) {
        console.error("Failed to delete thread:", error);
        if (userId) {
          await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
        }
      }
    }
  }, [userId, fetchAndSetThreadsState, loadThreadMessages]);
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setMessages((prev) => prev.map((msg) => msg.isStreaming ? { ...msg, isStreaming: false, isComplete: true } : msg));
  }, []);
  const handleStreamAssetEvent = useCallback((payload, assistantMessageId) => {
    if (!payload?.dataUrl) return;
    const mimeType = payload.mime || "image/png";
    const dataUrl = payload.dataUrl;
    let kind = "image";
    if (mimeType.startsWith("audio/")) {
      kind = "audio";
    } else if (mimeType.startsWith("video/")) {
      kind = "video";
    }
    const mediaAttachment = {
      kind,
      dataUrl,
      mimeType
    };
    setMessages((prev) => prev.map((msg) => msg.id === assistantMessageId ? {
      ...msg,
      attachments: [...msg.attachments || [], mediaAttachment],
      isStreaming: false,
      isComplete: true
    } : msg));
  }, []);
  const sendCopilotzMessage = useCallback(async (params) => {
    let currentAssistantId = generateId();
    params.onBeforeStart?.(currentAssistantId);
    let hasStreamProgress = false;
    let pendingStartNewAssistantBubble = false;
    const ensureStreamingBubble = () => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === currentAssistantId);
        if (idx >= 0 && prev[idx].role === "assistant" && prev[idx].isStreaming) {
          return prev;
        }
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && last.isStreaming) {
          currentAssistantId = last.id;
          pendingStartNewAssistantBubble = false;
          return prev;
        }
        if (pendingStartNewAssistantBubble || !prev.length || (prev[prev.length - 1].role !== "assistant" || !prev[prev.length - 1].isStreaming)) {
          const newId = generateId();
          currentAssistantId = newId;
          pendingStartNewAssistantBubble = false;
          return [
            ...prev,
            {
              id: newId,
              role: "assistant",
              content: "",
              timestamp: nowTs(),
              isStreaming: true,
              isComplete: false
            }
          ];
        }
        return prev;
      });
    };
    const updateStreamingMessage = (partial, isComplete) => {
      if (partial && partial.length > 0) {
        hasStreamProgress = true;
      }
      ensureStreamingBubble();
      setMessages((prev) => prev.map((msg) => msg.id === currentAssistantId ? { ...msg, content: partial, isStreaming: !isComplete, isComplete } : msg));
    };
    const finalizeCurrentAssistantBubble = () => {
      setMessages((prev) => prev.map((msg) => msg.id === currentAssistantId ? { ...msg, isStreaming: false, isComplete: true } : msg));
    };
    const curThreadId = currentThreadIdRef.current;
    const toServerMessageFromEvent = async (event) => {
      if (!event) return null;
      const type = event?.type || "";
      const payload = event?.payload ?? event;
      if (type === "TOOL_CALL") {
        const metadata = payload?.metadata ?? {};
        const call = payload?.call ?? metadata?.call;
        const func = call?.function ?? payload?.function;
        const toolName = func?.name || payload?.name || call?.name || metadata.toolName || metadata.tool || "tool";
        let argsObj = {};
        const possibleArgs = [
          func?.arguments,
          // Try call.function.arguments first (most specific for this event structure)
          payload?.args,
          call?.arguments,
          metadata?.args,
          metadata?.arguments
        ];
        for (const candidate of possibleArgs) {
          if (candidate === void 0 || candidate === null) continue;
          try {
            if (typeof candidate === "string") {
              argsObj = JSON.parse(candidate);
              break;
            }
            if (typeof candidate === "object") {
              argsObj = candidate;
              break;
            }
          } catch {
          }
        }
        const output = metadata?.output !== void 0 ? metadata.output : payload?.output !== void 0 ? payload.output : void 0;
        const callId = call?.id || func?.id || payload?.id || generateId();
        const statusVal = payload?.status || event?.status || "pending";
        return {
          id: generateId(),
          threadId: curThreadId ?? "",
          senderType: "tool",
          content: "",
          toolCalls: [{
            id: callId,
            name: toolName,
            args: argsObj,
            output,
            status: statusVal
          }]
        };
      }
      if (type === "MESSAGE" || type === "NEW_MESSAGE") {
        const senderType = payload?.senderType || payload?.sender?.type;
        if (senderType !== "agent") {
          return null;
        }
        const content = typeof payload?.content === "string" ? payload.content : "";
        if (!content.trim()) {
          return null;
        }
        return {
          id: generateId(),
          threadId: curThreadId ?? "",
          senderType: "agent",
          content,
          metadata: payload?.metadata ?? {}
        };
      }
      if (type === "ASSET_CREATED") {
        const by = payload?.by || "";
        if (by && by !== "tool") return null;
        const mime = payload?.mime || "image/png";
        const ref = payload?.ref || payload?.assetRef || "";
        if (!ref) return null;
        const kind = mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "image";
        const msgLike = {
          id: generateId(),
          threadId: curThreadId ?? "",
          senderType: "tool",
          content: "",
          metadata: {
            attachments: [{ kind, assetRef: ref, mimeType: mime }]
          }
        };
        const [resolved] = await resolveAssetsInMessages([msgLike]);
        return resolved;
      }
      return null;
    };
    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    setIsStreaming(true);
    try {
      const normalizedUserMetadata = params.userMetadata ? JSON.parse(JSON.stringify(params.userMetadata)) : void 0;
      const contextSeed = userContextSeedRef.current;
      const contextMetadata = contextSeed ? JSON.parse(JSON.stringify(contextSeed)) : void 0;
      const requestContent = params.content && params.content.length > 0 ? params.content : "";
      const metadataKey = params.threadId ?? params.threadExternalId ?? void 0;
      const currentThreadMetadataMap = threadMetadataMapRef.current;
      const messageMetadata = metadataKey ? currentThreadMetadataMap[metadataKey]?.userContext : void 0;
      const threadMetadata = metadataKey ? currentThreadMetadataMap[metadataKey] : void 0;
      await runCopilotzStream({
        threadId: params.threadId ?? void 0,
        threadExternalId: params.threadExternalId ?? void 0,
        content: requestContent,
        user: {
          externalId: params.userId,
          name: params.userName ?? params.userId,
          metadata: {
            ...contextMetadata ? contextMetadata : {},
            ...normalizedUserMetadata ?? {}
          }
        },
        attachments: params.attachments,
        metadata: params.metadata ?? messageMetadata,
        threadMetadata: params.threadMetadata ?? threadMetadata,
        toolCalls: params.toolCalls,
        onToken: (token, isComplete) => updateStreamingMessage(token, isComplete),
        onMessageEvent: async (event) => {
          const type = event?.type || "";
          const payload = event?.payload ?? event;
          if (type === "MESSAGE" || type === "NEW_MESSAGE") {
            const senderType = payload?.senderType || payload?.sender?.type;
            if (senderType === "tool") {
              const metadata = payload?.metadata ?? {};
              const toolCallsArray = metadata?.toolCalls;
              const toolCallData = toolCallsArray && toolCallsArray.length > 0 ? toolCallsArray[0] : void 0;
              if (!toolCallData) {
                return;
              }
              processToolOutput(metadata);
              const toolCallId = toolCallData.id;
              const toolCallName = toolCallData.name;
              const toolResult = toolCallData.output || payload?.content;
              const toolStatus = toolCallData.status || "completed";
              const isFailed = toolStatus === "failed" || toolCallData?.error;
              setMessages((prev) => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].role === "assistant" && updated[i].toolCalls) {
                    const toolCalls = updated[i].toolCalls;
                    if (toolCalls) {
                      let toolCallIndex = toolCallId ? toolCalls.findIndex((tc) => tc.id === toolCallId) : -1;
                      if (toolCallIndex === -1 && toolCallName) {
                        toolCallIndex = toolCalls.findIndex(
                          (tc) => tc.name === toolCallName && (tc.status === "pending" || tc.status === "running")
                        );
                      }
                      if (toolCallIndex !== -1) {
                        const updatedToolCalls = [...toolCalls];
                        updatedToolCalls[toolCallIndex] = {
                          ...updatedToolCalls[toolCallIndex],
                          status: isFailed ? "failed" : "completed",
                          result: toolResult,
                          endTime: Date.now()
                        };
                        updated[i] = {
                          ...updated[i],
                          toolCalls: updatedToolCalls
                        };
                        break;
                      }
                    }
                  }
                }
                return updated;
              });
              return;
            }
            return;
          }
          if (type === "TOOL_CALL") {
            const sm2 = await toServerMessageFromEvent(event);
            const toolCalls = sm2?.toolCalls;
            const toolCall = toolCalls && toolCalls[0];
            if (!toolCall) return;
            setMessages(
              (prev) => (() => {
                const appendToolCall = (msg) => ({
                  ...msg,
                  toolCalls: [
                    ...Array.isArray(msg.toolCalls) ? msg.toolCalls : [],
                    {
                      id: toolCall.id ?? generateId(),
                      name: toolCall.name ?? "tool",
                      arguments: toolCall.args ?? toolCall.arguments ?? {},
                      result: toolCall.output,
                      status: toolCall.status ?? "running",
                      startTime: Date.now()
                    }
                  ]
                });
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (prev[i].role === "assistant") {
                    const next = [...prev];
                    next[i] = appendToolCall({
                      ...next[i],
                      isStreaming: false,
                      isComplete: true
                    });
                    return next;
                  }
                }
                return [
                  ...prev,
                  appendToolCall({
                    id: generateId(),
                    role: "assistant",
                    content: "",
                    timestamp: nowTs(),
                    isStreaming: false,
                    isComplete: true
                  })
                ];
              })()
            );
            hasStreamProgress = true;
            pendingStartNewAssistantBubble = true;
            return;
          }
          const sm = await toServerMessageFromEvent(event);
          if (sm) {
            const viewMsg = convertServerMessage(sm);
            finalizeCurrentAssistantBubble();
            setMessages((prev) => [...prev, viewMsg]);
            pendingStartNewAssistantBubble = true;
            return;
          }
          handleStreamMessageEvent(event);
        },
        onAssetEvent: async (payload) => {
          await (async () => {
            if (!hasStreamProgress) return;
            finalizeCurrentAssistantBubble();
            const evt = { type: "ASSET_CREATED", payload };
            const sm = await toServerMessageFromEvent(evt);
            if (sm) {
              const viewMsg = convertServerMessage(sm);
              setMessages((prev) => [...prev, viewMsg]);
            }
            pendingStartNewAssistantBubble = true;
          })();
        },
        signal: abortController.signal
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
    return currentAssistantId;
  }, [handleStreamMessageEvent, handleStreamAssetEvent]);
  const handleSendMessage = useCallback(async (content, attachments = []) => {
    if (!content.trim() && attachments.length === 0) return;
    if (!userId) return;
    const timestamp = nowTs();
    const curThreadId = currentThreadIdRef.current;
    const curThreadExtId = currentThreadExternalIdRef.current;
    const existingThreadId = curThreadId ?? void 0;
    const extMap = threadExternalIdMapRef.current;
    const isPlaceholderThread = existingThreadId ? extMap[existingThreadId] === existingThreadId : false;
    const threadIdForSend = isPlaceholderThread ? void 0 : existingThreadId;
    let effectiveThreadExternalId = curThreadExtId ?? (isPlaceholderThread ? existingThreadId : void 0);
    if (!threadIdForSend) {
      if (!effectiveThreadExternalId) {
        effectiveThreadExternalId = generateId();
      }
      setCurrentThreadExternalId(effectiveThreadExternalId);
    } else if (curThreadExtId !== (effectiveThreadExternalId ?? null)) {
      setCurrentThreadExternalId(effectiveThreadExternalId ?? null);
    }
    const conversationKey = threadIdForSend ?? effectiveThreadExternalId;
    const currentMetadata = threadMetadataMapRef.current[conversationKey];
    const pendingTitle = currentMetadata?.pendingTitle;
    const userMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp,
      attachments: attachments.length > 0 ? attachments : void 0,
      isComplete: true
    };
    const assistantPlaceholder = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: timestamp + 1,
      isStreaming: true,
      isComplete: false
    };
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    if (!threadsRef.current.some((t) => t.id === conversationKey)) {
      const newThread = {
        id: conversationKey,
        title: content.slice(0, 40) || "Nova conversa",
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 0
      };
      setThreads((prev) => [newThread, ...prev]);
      setThreadMetadataMap((prev) => ({ ...prev, [conversationKey]: {} }));
      setThreadExternalIdMap((prev) => ({ ...prev, [conversationKey]: effectiveThreadExternalId ?? null }));
    }
    try {
      await sendCopilotzMessage({
        threadId: threadIdForSend,
        threadExternalId: effectiveThreadExternalId,
        content,
        attachments,
        userId,
        // userName can be anything, but let's try to find it in context or just fallback
        userName: userContextSeedRef.current?.profile?.full_name ?? userId,
        // Include pending title for new threads
        threadMetadata: pendingTitle ? { name: pendingTitle } : void 0
      });
      await new Promise((r) => setTimeout(r, 1e3));
      await fetchAndSetThreadsState(userId, effectiveThreadExternalId ?? existingThreadId ?? null);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("Error sending Copilotz message", error);
      setMessages((prev) => prev.map((msg) => msg.isStreaming ? {
        ...msg,
        isStreaming: false,
        isComplete: true,
        content: "Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente."
      } : msg));
    }
  }, [userId, fetchAndSetThreadsState, loadThreadMessages, sendCopilotzMessage]);
  const bootstrapConversation = useCallback(async (uid) => {
    if (!bootstrap?.initialToolCalls && !bootstrap?.initialMessage) return;
    const bootstrapThreadExternalId = generateId();
    setCurrentThreadId(bootstrapThreadExternalId);
    setCurrentThreadExternalId(bootstrapThreadExternalId);
    setThreadExternalIdMap((prev) => ({ ...prev, [bootstrapThreadExternalId]: bootstrapThreadExternalId }));
    setThreadMetadataMap((prev) => ({ ...prev, [bootstrapThreadExternalId]: {} }));
    setMessages([]);
    try {
      await sendCopilotzMessage({
        threadExternalId: bootstrapThreadExternalId,
        content: bootstrap.initialMessage || "",
        toolCalls: bootstrap.initialToolCalls,
        userId: uid,
        threadMetadata: {
          name: defaultThreadName || "Main Thread"
        }
      });
      await new Promise((r) => setTimeout(r, 1e3));
      await fetchAndSetThreadsState(uid, bootstrapThreadExternalId);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("Error bootstrapping conversation", error);
      setMessages([
        {
          id: generateId(),
          role: "assistant",
          content: "N\xE3o foi poss\xEDvel iniciar a conversa. Tente novamente mais tarde.",
          timestamp: nowTs(),
          isStreaming: false,
          isComplete: true
        }
      ]);
    }
  }, [fetchAndSetThreadsState, loadThreadMessages, sendCopilotzMessage, bootstrap, defaultThreadName]);
  const reset = useCallback(() => {
    setThreads([]);
    setThreadMetadataMap({});
    setThreadExternalIdMap({});
    setCurrentThreadId(null);
    setCurrentThreadExternalId(null);
    setMessages([]);
    setUserContextSeed({});
    setIsStreaming(false);
    abortControllerRef.current?.abort();
  }, []);
  useEffect(() => {
    if (userId) {
      if (initializationRef.current.userId === userId && initializationRef.current.started) {
        return;
      }
      initializationRef.current = { userId, started: true };
      const init = async () => {
        const preferredThreadId = await fetchAndSetThreadsState(userId, void 0);
        if (preferredThreadId) {
          await loadThreadMessages(preferredThreadId);
        } else if (bootstrap) {
          await bootstrapConversation(userId);
        }
      };
      init();
    } else {
      initializationRef.current = { userId: null, started: false };
      reset();
    }
  }, [userId, fetchAndSetThreadsState, loadThreadMessages, bootstrapConversation, reset, bootstrap]);
  useEffect(() => {
    if (!currentThreadId) return;
    const metadata = threadMetadataMap[currentThreadId];
    if (!metadata) return;
    if (metadata.userContext && typeof metadata.userContext === "object") {
      setUserContextSeed((prev) => ({ ...prev, ...metadata.userContext }));
    }
  }, [currentThreadId, threadMetadataMap]);
  return {
    messages,
    threads,
    currentThreadId,
    isStreaming,
    userContextSeed,
    sendMessage: handleSendMessage,
    createThread: handleCreateThread,
    selectThread: handleSelectThread,
    renameThread: handleRenameThread,
    archiveThread: handleArchiveThread,
    deleteThread: handleDeleteThread,
    stopGeneration: handleStop,
    fetchAndSetThreadsState,
    loadThreadMessages,
    reset
  };
}

// src/CopilotzChat.tsx
import { jsx } from "react/jsx-runtime";
var CopilotzChat = ({
  userId,
  userName,
  userAvatar,
  userEmail,
  initialContext,
  bootstrap,
  config: userConfig,
  callbacks: userCallbacks,
  customComponent,
  onToolOutput,
  onLogout,
  onViewProfile,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  className
}) => {
  const {
    messages,
    threads,
    currentThreadId,
    isStreaming,
    userContextSeed,
    sendMessage,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    deleteThread: deleteThread2,
    stopGeneration
  } = useCopilotz({
    userId,
    initialContext,
    bootstrap,
    defaultThreadName: userConfig?.labels?.defaultThreadName,
    onToolOutput
  });
  const chatCallbacks = useMemo(() => ({
    onSendMessage: (content, attachments) => {
      void sendMessage(content, attachments);
      userCallbacks?.onSendMessage?.(content, attachments);
    },
    onStopGeneration: () => {
      stopGeneration();
      userCallbacks?.onStopGeneration?.();
    },
    onCreateThread: (title) => {
      createThread(title);
      userCallbacks?.onCreateThread?.(title);
    },
    onSelectThread: (threadId) => {
      void selectThread(threadId);
      userCallbacks?.onSelectThread?.(threadId);
    },
    onRenameThread: (threadId, newTitle) => {
      void renameThread(threadId, newTitle);
      userCallbacks?.onRenameThread?.(threadId, newTitle);
    },
    onArchiveThread: (threadId) => {
      void archiveThread(threadId);
      userCallbacks?.onArchiveThread?.(threadId);
    },
    onDeleteThread: (threadId) => {
      void deleteThread2(threadId);
      userCallbacks?.onDeleteThread?.(threadId);
    },
    onCopyMessage: async (messageId, content) => {
      try {
        await navigator.clipboard.writeText(content);
        userCallbacks?.onCopyMessage?.(messageId, content);
      } catch (error) {
        console.error("Failed to copy message", error);
      }
    },
    // User menu callbacks
    onLogout,
    onViewProfile,
    ...userCallbacks
  }), [sendMessage, stopGeneration, createThread, selectThread, renameThread, archiveThread, deleteThread2, userCallbacks, onLogout, onViewProfile]);
  const mergedConfig = useMemo(() => {
    const base = userConfig || {};
    if (!customComponent) {
      return base;
    }
    return {
      ...base,
      customComponent: {
        ...base.customComponent,
        component: customComponent,
        icon: base.customComponent?.icon || /* @__PURE__ */ jsx(User, { className: "h-6 w-6" })
      }
    };
  }, [userConfig, customComponent]);
  const effectiveUserName = userName || userId;
  const effectiveUserAvatar = userAvatar;
  return /* @__PURE__ */ jsx(ChatUserContextProvider, { initial: userContextSeed, children: /* @__PURE__ */ jsx(
    ChatUI,
    {
      messages,
      threads,
      currentThreadId,
      config: mergedConfig,
      callbacks: chatCallbacks,
      isGenerating: isStreaming,
      user: {
        id: userId,
        name: effectiveUserName,
        email: userEmail,
        avatar: effectiveUserAvatar
      },
      assistant: {
        name: userConfig?.branding?.title,
        avatar: userConfig?.branding?.avatar,
        description: userConfig?.branding?.subtitle
      },
      onAddMemory,
      onUpdateMemory,
      onDeleteMemory,
      className
    }
  ) });
};
export {
  CopilotzChat,
  copilotzService,
  deleteMessagesByThreadId,
  deleteThread,
  fetchThreadMessages,
  fetchThreads,
  getAssetDataUrl,
  resolveAssetsInMessages,
  runCopilotzStream,
  updateThread,
  useCopilotz
};
/*! Bundled license information:

lucide-react/dist/esm/shared/src/utils.js:
lucide-react/dist/esm/defaultAttributes.js:
lucide-react/dist/esm/Icon.js:
lucide-react/dist/esm/createLucideIcon.js:
lucide-react/dist/esm/icons/user.js:
lucide-react/dist/esm/lucide-react.js:
  (**
   * @license lucide-react v0.540.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=index.js.map