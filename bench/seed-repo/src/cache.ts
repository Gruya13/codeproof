import { normalizeKey, normalizeTtl } from "./registry.js";

export interface CacheEntry {
  key: string;
  value: number;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry>();

export function put(key: string, value: number, ttlMs: number): void {
  entries.set(normalizeKey(key), { key, value, expiresAt: Date.now() + normalizeTtl(ttlMs) });
}

export function get(key: string): number | undefined {
  const entry = entries.get(normalizeKey(key));
  if (entry === undefined) return undefined;
  if (entry.expiresAt <= Date.now()) return undefined;
  return entry.value;
}
