// The pages the WebSearch calls of an agent run gave (C1 spec 6.4, review of shop PR #79): the PostToolUse hook
// web-search.mjs records them, and gh-guard lets a role that reads web pages fetch only those and the docs, so a page
// cannot have it send what it read to an address of the page's choosing. One file per session in the temp folder,
// where such a role writes nothing. Pure.
import { join } from 'node:path';

// The record of session `session` under the folder `dir`, or null for a call that names no session.
export function searchFile(dir, session) {
  if (typeof session !== 'string' || session === '') return null;
  return join(dir, 'ao-web-search', `${session.replace(/[^\w-]/g, '_')}.txt`);
}

// The URLs in the response of a WebSearch, whatever its shape: every http or https address in it, without the
// punctuation that can close a sentence after one.
export function resultUrls(response) {
  const text = typeof response === 'string' ? response : JSON.stringify(response ?? '');
  const found = (text.match(/https?:\/\/[^\s"'<>\\`)\]}]+/g) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ''));
  return [...new Set(found)];
}
