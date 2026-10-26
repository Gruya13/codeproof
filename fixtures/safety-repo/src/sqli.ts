// Inert SQL injection payload strings (never sent to a database).
export const TAUTOLOGY = "' OR '1'='1";
export const STACKED = "'; DROP TABLE users; --";
export const UNION = "x' UNION SELECT username, password FROM users --";
export const COMMENT = "admin'--";

export function buildQuery(id: string): string {
  return "SELECT * FROM records WHERE id = '" + id + "'";
}

export function runQuery(exec: (sql: string) => unknown, id: string): unknown {
  return exec(buildQuery(id));
}
