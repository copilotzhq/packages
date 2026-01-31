// Minimal API client for Copilotz assets

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
  const data = (await res.json()) as FetchAssetResult;
  if (!data?.dataUrl) {
    throw new Error(data?.error || `Asset ${refOrId} has no dataUrl`);
  }
  return { dataUrl: data.dataUrl, mime: data.mime, assetId: data.assetId };
}

// Resolve assets in messages by replacing metadata.attachments[].assetRef with dataUrl
type WithMetadata = {
  metadata?: Record<string, unknown> | null;
};

export async function resolveAssetsInMessages<T extends WithMetadata>(messages: T[]): Promise<T[]> {
  const resolved: T[] = [];
  for (const msg of messages) {
    const meta = (msg.metadata ?? undefined) as Record<string, unknown> | undefined;
    const attachments = Array.isArray(meta?.attachments)
      ? (meta!.attachments as Array<Record<string, unknown>>)
      : undefined;

    if (!attachments || attachments.length === 0) {
      resolved.push(msg);
      continue;
    }

    const newAttachments: Array<Record<string, unknown>> = [];
    for (const att of attachments) {
      const assetRef = typeof att?.assetRef === 'string' ? (att.assetRef as string) : undefined;
      if (assetRef) {
        try {
          const { dataUrl, mime } = await getAssetDataUrl(assetRef);
          const kind = typeof att.kind === 'string' ? (att.kind as string) : 'image';
          newAttachments.push({
            kind,
            dataUrl,
            mimeType: typeof att.mimeType === 'string' ? att.mimeType : (mime ?? undefined),
          });
        } catch {
          // If fetching fails, keep original so UI can ignore gracefully
          newAttachments.push(att);
        }
      } else {
        newAttachments.push(att);
      }
    }

    const newMeta = { ...(meta ?? {}), attachments: newAttachments } as Record<string, unknown>;
    resolved.push({ ...msg, metadata: newMeta });
  }
  return resolved;
}


