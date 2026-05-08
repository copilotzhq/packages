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

const rawBaseValue = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const rawBase = typeof rawBaseValue === 'string' && rawBaseValue.length > 0 ? rawBaseValue : '/api';
const normalizedBase = rawBase.replace(/\/$/, '');
const API_BASE = normalizedBase.startsWith('http') || normalizedBase.startsWith('/')
  ? normalizedBase
  : `/${normalizedBase}`;

const apiUrl = (path: string) => `${API_BASE}${path}`;

const extractAssetId = (refOrId: string) =>
  refOrId.startsWith('asset://') ? refOrId.slice('asset://'.length) : refOrId;

export async function getAssetDataUrl(refOrId: string): Promise<{ dataUrl: string; mime?: string; assetId: string }> {
  const id = extractAssetId(refOrId);
  const res = await fetch(apiUrl(`/v1/assets/${encodeURIComponent(id)}?format=dataUrl`), {
    method: 'GET',
    headers: { Accept: 'application/json' },
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

export async function resolveAssetsInMessages<T extends WithMetadata>(messages: T[]): Promise<T[]> {
  // Deduplicate in-flight fetches so the same assetRef is resolved only once.
  const inFlightByRef = new Map<string, Promise<{ dataUrl: string; mime?: string; assetId: string }>>();

  const resolveAssetRef = (assetRef: string) => {
    if (!inFlightByRef.has(assetRef)) {
      inFlightByRef.set(assetRef, getAssetDataUrl(assetRef));
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

      const { dataUrl, mime } = await resolveAssetRef(assetRef);
      const kind = expectString(att.kind, `message.metadata.attachments[${index}].kind`);
      const mimeType = typeof att.mimeType === 'string'
        ? att.mimeType
        : expectString(mime, `asset ${assetRef}.mime`);
      return {
        ...att,
        kind,
        dataUrl,
        mimeType,
      } as Record<string, unknown>;
    }));

    const newMeta = { ...meta, attachments: newAttachments } as Record<string, unknown>;
    return { ...msg, metadata: newMeta };
  }));
}
