import DOMPurify from 'dompurify';

// XSS defense for React's one escape hatch (dangerouslySetInnerHTML). We do NOT
// hand-roll sanitization — it is notoriously easy to get wrong (encoding tricks,
// mutation XSS) — so we delegate to DOMPurify, the expert tool. This is the ONLY
// module that calls DOMPurify; UI renders untrusted HTML via <SafeHtml>.
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    // Allow a safe HTML subset; strips <script>, event handlers (onerror…),
    // javascript: URLs, and disallows SVG/MathML vectors.
    USE_PROFILES: { html: true },
  });
}
