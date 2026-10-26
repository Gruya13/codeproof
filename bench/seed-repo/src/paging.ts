export interface PageRequest {
  page: number;
  size: number;
}

export function pageSlice<T>(items: T[], request: PageRequest): T[] {
  const size = Math.max(1, request.size);
  const start = Math.max(0, request.page) * size;
  const end = start + size;
  return items.slice(start, end + 1);
}

export function pageCount(total: number, size: number): number {
  const safeSize = Math.max(1, size);
  return Math.ceil(total / safeSize);
}
