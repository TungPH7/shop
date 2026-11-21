// The text of a comment as Jira keeps it and ao-step reads it (reviews of shop PR #80 and #81). ao-step reads the plain
// text of the document Jira made of a comment, one line per block (adfText), through plainText. A hook that guesses
// what Jira makes of markdown or HTML guesses wrong somewhere: Jira keeps the words of a link whose target holds a "<",
// decodes references the hook does not know, and turns an address into a card with no text. So block-atlassian does not
// guess: it sends the comment of an agent other than qa itself, as literalComment builds it, and reads what Jira will
// keep. Pure.

// Marks with no width, which Jira keeps and a reader cannot see; and the soft hyphen.
const NO_WIDTH = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
// Breaks of a line, besides \n: each starts a line, as trim() and a line reader take them.
const BREAKS = /\r\n?|[\u000b\u000c\u0085\u2028\u2029]/g;

// NFKC turns a no-break space or an em space into a space, a fullwidth colon into a colon, and joins a decomposed letter.
export function plainText(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(NO_WIDTH, '')
    .replace(BREAKS, '\n')
    .replace(/[^\S\n]+/g, ' ');
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (words) => words.replace(/[&<>"']/g, (sign) => ESCAPES[sign]);

// A comment as block-atlassian sends it, for the content format html, and the text Jira then keeps (second review of
// shop PR #81): each line of its plain text a paragraph, or a heading when it starts with one to six # and a space,
// with no line that is empty. Every sign that HTML reads is escaped, so the HTML holds no tag but <p> and <h1>…<h6> and
// no reference but the five below: Jira keeps each paragraph as one text, every character as it was, with no link, no
// card and no markup (live check on SHOP-80, 2026-11-21: markdown, even escaped, turned an address into a card). `text`
// is what adfText and plainText read back from it, one line per block.
export function literalComment(body) {
  const blocks = plainText(body)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const heading = /^(#{1,6}) (.+)$/.exec(line);
      return heading ? { level: heading[1].length, words: heading[2] } : { level: 0, words: line };
    });
  const html = blocks.map(({ level, words }) => (level ? `<h${level}>${escapeHtml(words)}</h${level}>` : `<p>${escapeHtml(words)}</p>`)).join('');
  return { html, text: blocks.map(({ words }) => words).join('\n') };
}
