// Static (mechanical) checks for the two-phase L3 codes (F1.2).
// The inputs are small generated test files; these checks are regex based on purpose: they run
// before any execution and every rejection is reported with a stable reason.

const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";

var __idRegexCache = {};
function wordRegex(name) {
  if (!__idRegexCache[name]) {
    __idRegexCache[name] = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
  }
  return __idRegexCache[name];
}

// Every assert call as a string, from assert.  up to its balanced closing parenthesis.
export function extractAssertSegments(code) {
  const segments = [];
  const pattern = /\bassert\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\(/g;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    let inString = null;
    let escaped = false;
    for (; index < code.length; index += 1) {
      const char = code[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === inString) inString = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") { inString = char; continue; }
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    segments.push({ text: code.slice(match.index, index + 1), body: code.slice(match.index, index + 1) });
  }
  return segments;
}

// Identifiers assigned from a call of one of the given symbols: `const value = page(...)`.
export function extractAssignedFromCall(code, symbols) {
  const assigned = [];
  for (const symbol of symbols) {
    const pattern = new RegExp("(?:const|let|var)\\s+(" + IDENT + ")\\s*=\\s*(?:await\\s+)?" + symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
    let match;
    while ((match = pattern.exec(code)) !== null) assigned.push({ identifier: match[1], symbol: symbol });
  }
  return assigned;
}

// The arguments of the first call of `symbol` in the code (strings, decoded with a tiny scanner).
export function firstCallArguments(code, symbol) {
  const pattern = new RegExp("\\b" + symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
  const match = pattern.exec(code);
  if (!match) return null;
  const start = match.index + match[0].length;
  const args = [];
  let current = "";
  let depth = 1;
  let inString = null;
  let escaped = false;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (inString) {
      current += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === inString) inString = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { inString = char; current += char; continue; }
    if (char === "(" || char === "[" || char === "{") { depth += 1; current += char; continue; }
    if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) {
        if (current.trim() !== "") args.push(current.trim());
        break;
      }
      current += char;
      continue;
    }
    if (char === "," && depth === 1) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  return args;
}

// Dead-code guards that would make a call unreachable in practice.
export function hasDeadCode(code) {
  return /\bif\s*\(\s*(?:false|0|!true)\s*\)/.test(code)
    || /\bif\s*\(\s*true\s*\)\s*\{\s*return\b/.test(code)
    || /\bfalse\s*&&/.test(code)
    || /\btrue\s*\|\|/.test(code);
}

// Tautological assertions: comparing an identifier with itself, or a literal with the same literal.
export function hasTautology(code) {
  const selfCompare = new RegExp("\\b(" + IDENT + ")\\s*(?:===|!==|==|!=)\\s*\\1\\b");
  if (selfCompare.test(code)) return "self-comparison";
  const segments = extractAssertSegments(code);
  for (const segment of segments) {
    const body = segment.text;
    if (/\bassert\s*\.\s*ok\s*\(\s*true\s*[,)]/.test(body)) return "assert.ok(true)";
    const equal = body.match(/\bassert\s*\.\s*(?:equal|strictEqual|deepEqual|deepStrictEqual|notEqual|notStrictEqual)\s*\(\s*([^,]+),\s*([^)]+)\)/);
    if (equal) {
      const left = equal[1].trim();
      const right = equal[2].trim();
      if (left === right) return "same expression on both sides";
      if (/^-?\d+(?:\.\d+)?$/.test(left) && /^-?\d+(?:\.\d+)?$/.test(right) && left === right) return "same literal on both sides";
      if (/^(?:true|false)$/.test(left) && left === right) return "same literal on both sides";
    }
  }
  return null;
}

// Does at least one assertion mention the symbol directly, or an identifier assigned from a call?
export function assertionTiedToSymbols(code, symbols) {
  const assigned = extractAssignedFromCall(code, symbols);
  const segments = extractAssertSegments(code);
  for (const segment of segments) {
    for (const symbol of symbols) {
      if (wordRegex(symbol).test(segment.text)) return { ok: true, via: "direct", symbol: symbol };
    }
    for (const assignment of assigned) {
      if (wordRegex(assignment.identifier).test(segment.text)) return { ok: true, via: "assigned", symbol: assignment.symbol };
    }
  }
  return { ok: false };
}

// Control and trigger must differ in at least one argument of a shared symbol call.
export function inputsDiffer(controlCode, triggerCode, symbols) {
  const shared = [];
  for (const symbol of symbols) {
    const left = firstCallArguments(controlCode, symbol);
    const right = firstCallArguments(triggerCode, symbol);
    if (left === null || right === null) continue;
    shared.push({ symbol: symbol, left: left, right: right, differs: JSON.stringify(left) !== JSON.stringify(right) });
  }
  if (shared.length === 0) return { ok: false, reason: "no shared symbol is called in both codes", shared: shared };
  if (!shared.some(function (item) { return item.differs; })) return { ok: false, reason: "control and trigger call the shared symbol(s) with identical arguments", shared: shared };
  return { ok: true, shared: shared };
}
