export async function runBatch<T>(items: T[], worker: (item: T) => Promise<T>): Promise<T[]> {
  try {
    return await Promise.all(items.map((item) => worker(item)));
  } catch (error) {
    console.error("batch failed", error);
    throw error;
  }
}
