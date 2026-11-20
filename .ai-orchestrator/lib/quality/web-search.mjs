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

// The pages a WebSearch gave: the url of each result, from the response of Claude Code (2.1.329: { query, results,
// durationSeconds, searchCount }, where results holds { tool_use_id, content: [{ title, url }] } and text). Not the
// query, which the role typed, nor the text, which a page can write: either let it fetch an address of its choosing,
// with the data in it (second review of shop PR #79). An http or https URL with no user, password or white space, so
// it writes one line of the record. Any other shape gives none.
export function resultUrls(response) {
  const results = response && typeof response === 'object' && !Array.isArray(response) ? response.results : undefined;
  if (!Array.isArray(results)) return [];
  const urls = results
    .flatMap((result) => (result && typeof result === 'object' && Array.isArray(result.content) ? result.content : []))
    .map((entry) => entry?.url)
    .filter((url) => typeof url === 'string' && /^https?:\/\/\S+$/i.test(url) && webAddress(url));
  return [...new Set(urls)];
}

const webAddress = (text) => {
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};
