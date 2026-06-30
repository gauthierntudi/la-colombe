const ASSET_PREFIX = "/api/v1/assets/";

export function toAssetUrl(key: string): string {
  return `${ASSET_PREFIX}${key}`;
}

/** Extrait la clé S3 depuis une valeur stockée (clé, URL proxy ou URL S3 legacy). */
export function extractAssetKey(stored: string): string | null {
  if (stored.startsWith(ASSET_PREFIX)) {
    return stored.slice(ASSET_PREFIX.length);
  }
  if (stored.startsWith("products/") || stored.startsWith("avatars/")) {
    return stored;
  }
  const s3Match = stored.match(/amazonaws\.com\/(.+)$/);
  if (s3Match) return decodeURIComponent(s3Match[1]);
  return null;
}

/** URL utilisable côté client (proxy pour S3, inchangée pour URLs externes). */
export function resolveAssetUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const key = extractAssetKey(stored);
  if (key) return toAssetUrl(key);
  return stored;
}

/** Valeur à persister en base (clé S3 ou URL externe). */
export function normalizeAssetForStorage(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const key = extractAssetKey(value.trim());
  if (key) return key;
  return value.trim();
}

export function isAllowedAssetKey(key: string): boolean {
  return key.startsWith("products/") || key.startsWith("avatars/");
}
