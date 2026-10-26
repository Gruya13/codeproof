export function parseDirtyJson(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("empty model output");
  }
  let source = text.trim();
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) source = fenced[1].trim();
  try {
    return JSON.parse(source);
  } catch (error) {
    // fall through to dirty parsing
  }
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("no JSON object in model output: " + source.slice(0, 120));
  }
  const candidate = source.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(candidate);
}
