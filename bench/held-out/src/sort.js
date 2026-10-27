export function sortByPrice(items) {
  return items.sort((left, right) => left.price < right.price);
}
