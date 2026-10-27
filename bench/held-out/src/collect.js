export function collect(items, compute) {
  const results = [];
  items.forEach(function (item) {
    results.push(compute(item));
  });
  return results;
}
