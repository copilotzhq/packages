import { getAttachmentKindFromMimeType, getMimeTypeFromDataUrl } from '@copilotz/chat-ui';

// Minimal API client for Copilotz assets

class ContractViolation extends Error { name = 'ContractViolation'; }
const expectRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new ContractViolation(`${path} must be an object`);
};
const expectString = (value: unknown, path: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new ContractViolation(`${path} must be a non-empty string`);
};

type FetchAssetResult = {
  assetId: string;
  ref: string;
  dataUrl?: string;
  base64?: string;
  mime?: string;
  error?: string;
};

export type RequestHeadersProvider = () =>
  | Record<string, string>
  | Promise<Record<string, string>>;

const rawBaseValue = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const rawBase = typeof rawBaseValue === 'string' && rawBaseValue.length > 0 ? rawBaseValue : '/api';
const normalizedBase = rawBase.replace(/\/$/, '');
const API_BASE = normalizedBase.startsWith('http') || normalizedBase.startsWith('/')
  ? normalizedBase
  : `/${normalizedBase}`;

const apiUrl = (path: string) => `${API_BASE}${path}`;

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

const withAssetAuthHeaders = async (
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

const extractAssetId = (refOrId: string) =>
  refOrId.startsWith('asset://') ? refOrId.slice('asset://'.length) : refOrId;

export async function getAssetDataUrl(
  refOrId: string,
  getRequestHeaders?: RequestHeadersProvider,
): Promise<{ dataUrl: string; mime?: string; assetId: string }> {
  const id = extractAssetId(refOrId);
  const res = await fetch(apiUrl(`/v1/assets/${encodeURIComponent(id)}?format=dataUrl`), {
    method: 'GET',
    headers: await withAssetAuthHeaders({ Accept: 'application/json' }, getRequestHeaders),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Failed to fetch asset ${refOrId}`);
  }
  const body = (await res.json()) as { data?: FetchAssetResult } | FetchAssetResult;
  const envelope = expectRecord(body, 'asset response');
  const data = expectRecord(envelope.data, 'asset response.data') as FetchAssetResult;
  if (typeof data.error === 'string' && data.error.length > 0) {
    throw new Error(data.error);
  }
  if (typeof data.dataUrl !== 'string' || data.dataUrl.length === 0) {
    throw new ContractViolation(`asset response.data.dataUrl is required for ${refOrId}`);
  }
  return {
    dataUrl: data.dataUrl,
    mime: typeof data.mime === 'string' ? data.mime : undefined,
    assetId: expectString(data.assetId, 'asset response.data.assetId'),
  };
}

// Resolve assets in messages by replacing metadata.attachments[].assetRef with dataUrl
type WithMetadata = {
  metadata?: Record<string, unknown> | null;
};

export async function resolveAssetsInMessages<T extends WithMetadata>(
  messages: T[],
  getRequestHeaders?: RequestHeadersProvider,
): Promise<T[]> {
  // Deduplicate in-flight fetches so the same assetRef is resolved only once.
  const inFlightByRef = new Map<string, Promise<{ dataUrl: string; mime?: string; assetId: string }>>();

  const resolveAssetRef = (assetRef: string) => {
    if (!inFlightByRef.has(assetRef)) {
      inFlightByRef.set(assetRef, getAssetDataUrl(assetRef, getRequestHeaders));
    }
    return inFlightByRef.get(assetRef)!;
  };

  return Promise.all(messages.map(async (msg) => {
    const meta = msg.metadata === null || msg.metadata === undefined
      ? undefined
      : expectRecord(msg.metadata, 'message.metadata');
    const attachments = meta?.attachments === undefined
      ? undefined
      : Array.isArray(meta.attachments)
        ? meta.attachments.map((att, index) =>
          expectRecord(att, `message.metadata.attachments[${index}]`)
        )
        : (() => {
          throw new ContractViolation('message.metadata.attachments must be an array');
        })();

    if (!attachments || attachments.length === 0) {
      return msg;
    }

    const newAttachments = await Promise.all(attachments.map(async (att, index) => {
      const assetRef = typeof att.assetRef === 'string' ? att.assetRef : undefined;
      if (!assetRef) return att;

      try {
        const { dataUrl, mime } = await resolveAssetRef(assetRef);
        const mimeType = typeof att.mimeType === 'string'
          ? att.mimeType
          : mime || getMimeTypeFromDataUrl(dataUrl) || 'application/octet-stream';
        const inferredKind = getAttachmentKindFromMimeType(mimeType);
        return {
          ...att,
          kind: inferredKind,
          dataUrl,
          mimeType,
        } as Record<string, unknown>;
      } catch (error) {
        return {
          ...att,
          assetUnavailable: true,
          assetError: error instanceof Error ? error.message : String(error),
        } as Record<string, unknown>;
      }
    }));

    const newMeta = { ...meta, attachments: newAttachments } as Record<string, unknown>;
    return { ...msg, metadata: newMeta };
  }));
}
