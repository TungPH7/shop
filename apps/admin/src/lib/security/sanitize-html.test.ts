import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from './sanitize-html';

// "Demo sanitize": prove the XSS vectors are stripped (DOMPurify runs in jsdom).
describe('sanitizeHtml', () => {
  it('keeps a safe HTML subset', () => {
    expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toBe(
      '<p>Hello <strong>world</strong></p>',
    );
  });

  it('strips <script> and its contents', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain('<p>ok</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)" />')).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).not.toContain('javascript:');
  });
});
