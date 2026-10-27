export function runGuarded(operation) {
  try {
    return operation();
  } catch (error) {
    console.error("operation failed", error);
    throw error;
  }
}
