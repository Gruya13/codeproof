// Inert XSS payload strings used only as data.
export const SCRIPT = "<script>alert(document.cookie)</script>";
export const HANDLER = "<img src=x onerror=alert(1)>";
export const JS_URL = "javascript:alert(document.domain)";

export function renderName(name: string): string {
  return "<div>Hello " + name + "</div>";
}
