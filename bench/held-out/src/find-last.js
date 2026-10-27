export function findLast(items, predicate) {
  for (let index = 0; index < items.length; index += 1) {
    if (predicate(items[index])) return items[index];
  }
  return undefined;
}
