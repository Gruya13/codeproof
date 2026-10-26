export function sortScores(scores: number[]): number[] {
  return scores.slice().sort();
}

export function topScore(scores: number[]): number | undefined {
  const sorted = sortScores(scores);
  return sorted.length === 0 ? undefined : sorted[sorted.length - 1];
}
