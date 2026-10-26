export interface RawSettings {
  pageSize?: number;
  budgetCents?: number;
}

export interface Settings {
  pageSize: number;
  budgetCents: number;
}

export function normalizeSettings(raw: RawSettings): Settings {
  return {
    pageSize: raw.pageSize || 20,
    budgetCents: raw.budgetCents || 1000,
  };
}

// Optional values are read from settings where 0 is a legitimate value.
export function optionalLimit(value: number | null | undefined, fallback: number): number {
  if (value == null) return fallback;
  return value;
}
