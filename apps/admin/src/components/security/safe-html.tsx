import { sanitizeHtml } from '@/lib/security/sanitize-html';

interface SafeHtmlProps {
  /** Untrusted HTML (e.g. a server-rendered product description). */
  html: string;
  className?: string;
}

// The ONE sanctioned place to render HTML from an untrusted source: it sanitizes
// with DOMPurify before injecting. Raw `dangerouslySetInnerHTML` is banned by
// ESLint everywhere else (no-restricted-syntax), so ALL HTML rendering funnels
// through here — a reviewer/scanner only has one spot to audit.
//
// (This file is the single ESLint exemption for the dangerouslySetInnerHTML ban.)
export function SafeHtml({ html, className }: SafeHtmlProps) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
