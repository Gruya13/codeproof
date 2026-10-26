/**
 * Retry attempts are counted from 1, and maxAttempts is inclusive.
 */
export function canRetry(attempts: number, maxAttempts: number): boolean {
  return attempts <= maxAttempts;
}

export function delayMs(attempt: number): number {
  return Math.min(30000, 500 * Math.pow(2, attempt - 1));
}
