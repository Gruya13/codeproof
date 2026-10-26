// One real correctness defect so the verifier stage is exercised as well.
export interface Item {
  id: string;
}

export function paginate(items: Item[], page: number, size: number): Item[] {
  const start = page * size;
  const end = start + size + 1;
  return items.slice(start, end);
}

export function lastItem(items: Item[]): Item | undefined {
  return items[items.length];
}
