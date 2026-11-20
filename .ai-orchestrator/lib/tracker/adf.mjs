// A Markdown text as an Atlassian Document Format body, for a comment the kit writes with the CI token, such as the QA
// report the main session writes for an item of level light (C1 spec section 2). Kept simple: a heading line is a
// heading, a table line stays a paragraph with its pipes, every other line a paragraph; blank lines and HTML comments
// go. adfText (lib/tracker/facts.mjs) reads it back one line per block, so qaReportResult reads its Result. Pure.

export function markdownToAdf(text) {
  const content = String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !/^\|?\s*:?-{3,}/.test(line.trim()))
    .map((line) => {
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) return { type: 'heading', attrs: { level: heading[1].length }, content: [{ type: 'text', text: heading[2] }] };
      return { type: 'paragraph', content: [{ type: 'text', text: line }] };
    });
  return { type: 'doc', version: 1, content };
}
