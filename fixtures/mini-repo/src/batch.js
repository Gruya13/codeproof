export async function runAll(items, worker) {
  try {
    return await Promise.all(items.map((item) => worker(item)));
  } catch (error) {
    console.error("batch failed", error);
    throw error;
  }
}
