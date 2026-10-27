const FENCE = String.fromCharCode(96).repeat(3);

// Remove commas that sit right before a closing bracket, but only outside string literals:
// a naive regex would corrupt valid JSON like {"a": ",}"} while trying to be tolerant.
function stripTrailingCommas(source) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; out += char; continue; }
    if (char === ",") {
      let next = index + 1;
      while (next < source.length && /\s/.test(source[next])) next += 1;
      if (source[next] === "}" || source[next] === "]") continue;
    }
    out += char;
  }
  return out;
}

function parseRelaxed(candidate) {
  try {
    return JSON.parse(candidate);
  } catch (error) {
    // fall through to trailing-comma tolerance
  }
  try {
    return JSON.parse(stripTrailingCommas(candidate));
  } catch (error) {
    return undefined;
  }
}

function extractFenced(source) {
  const pattern = new RegExp(FENCE + "\\s*(?:json)?\\s*([\\s\\S]*?)\\s*" + FENCE, "i");
  const match = source.match(pattern);
  return match ? match[1].trim() : null;
}

function firstJsonObject(source) {
  let start = source.indexOf("{");
  while (start !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (escape) { escape = false; continue; }
      if (char === "\\") { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const parsed = parseRelaxed(source.slice(start, index + 1));
          if (parsed !== undefined) return parsed;
          break;
        }
      }
    }
    start = source.indexOf("{", start + 1);
  }
  return undefined;
}

export function parseDirtyJson(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("empty model output");
  }
  let source = text;
  if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
    if (source.trim() === "") throw new Error("empty model output");
  }
  source = source.trim();
  const fenced = extractFenced(source);
  if (fenced !== null) source = fenced;
  const direct = parseRelaxed(source);
  if (direct !== undefined) return direct;
  const first = firstJsonObject(source);
  if (first !== undefined) return first;
  throw new Error("no JSON object in model output: " + source.slice(0, 120));
}
