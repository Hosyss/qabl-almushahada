const BASE_SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
});

const HTML_SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
});

export function withSecurityHeaders(originalResponse: Response): Response {
  const headers = new Headers(originalResponse.headers);
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) headers.set(name, value);
  headers.delete("X-Powered-By");

  const contentType = headers.get("Content-Type") ?? "";
  if (contentType.toLowerCase().includes("text/html")) {
    for (const [name, value] of Object.entries(HTML_SECURITY_HEADERS)) headers.set(name, value);
  }

  return new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers,
  });
}
