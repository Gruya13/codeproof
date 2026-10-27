export function page(items, pageNumber, size) {
  const start = pageNumber * size;
  return items.slice(start, start + size - 1);
}
