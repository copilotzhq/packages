import {
  ContractViolation,
  expectRecord,
  expectString,
  // @ts-expect-error Direct Node TypeScript tests require the source extension.
} from './contract.ts';

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
  const body: unknown = await res.json();
  const envelope = expectRecord(body, 'asset response');
  const data = expectRecord(envelope.data, 'asset response.data');
  const asset = expectRecord(data.asset, 'asset response.data.asset');
  if (typeof data.dataUrl !== 'string' || data.dataUrl.length === 0) {
    throw new ContractViolation(`asset response.data.dataUrl is required for ${refOrId}`);
  }
  return {
    dataUrl: data.dataUrl,
    mime: typeof asset.mediaType === 'string' ? asset.mediaType : undefined,
    assetId: expectString(asset.id, 'asset response.data.asset.id'),
  };
}
