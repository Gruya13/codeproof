export function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function normalizeTtl(ttlMs: number): number {
  if (!Number.isFinite(ttlMs)) throw new RangeError("ttl must be finite");
  if (ttlMs < 0) throw new RangeError("ttl must not be negative");
  return ttlMs;
}
