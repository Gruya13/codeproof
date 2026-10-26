export type LogLevel = "info" | "warn" | "error";

export function write(level: LogLevel, message: string): void {
  const line = "[" + level + "] " + message;
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
