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

// The control characters but the line breaks and the tab: C0, DEL and C1 (U+0085 is a break above). The HTML reader of
// Jira drops U+0000, so a word the hook read with it was another word for ao-step (third review of shop PR #81).
const CONTROLS = /[\u0000-\u0008\u000e-\u001f\u007f-\u0084\u0086-\u009f]/g;
const clean = (text) => text.replace(BREAKS, '\n').replace(CONTROLS, '').replace(NO_WIDTH, '');

// The text in normal form `form`, with no mark of no width, no control character and one kind of line break, and any
// run of spaces as one space. Each step can make work for another: a mark of no width taken out after NFKC leaves a
// letter and its accents side by side, which NFKC would join, and the hook read "Cần sa:" where ao-step read
// "Cần sa:" (third review of shop PR #81, High 08bc0732). So the steps run again until the text stays the same, and the
// result reads as itself.
function settle(text, form) {
  let current = String(text ?? '');
  for (let pass = 0; pass < 8; pass++) {
    const next = clean(clean(current).normalize(form)).replace(/[^\S\n]+/g, ' ');
    if (next === current) return next;
    current = next;
  }
  return current;
}

// The text ao-step reads. NFKC turns a no-break space or an em space into a space, a fullwidth colon into a colon, and
// joins a decomposed letter. plainText(plainText(x)) is plainText(x).
export const plainText = (text) => settle(text, 'NFKC');

// The words of an agent as the hook sends them: in NFC, with no mark of no width and no control character. NFKC would
// change them, ™ into TM and 42½ into 421⁄2 (third review of shop PR #81, Medium 4); the hook checks their plainText,
// which is what ao-step reads from what Jira keeps.
export const sentText = (text) => settle(text, 'NFC');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (words) => words.replace(/[&<>"']/g, (sign) => ESCAPES[sign]);

// A comment as block-atlassian sends it, for the content format html, and the text Jira then keeps (second review of
// shop PR #81): each line of its plain text a paragraph, or a heading when it starts with one to six # and a space,
// with no line that is empty. Every sign that HTML reads is escaped, so the HTML holds no tag but <p> and <h1>…<h6> and
// no reference but the five below: Jira keeps each paragraph as one text, every character as it was, with no link, no
// card and no markup (live check on SHOP-80, 2026-11-21: markdown, even escaped, turned an address into a card). `text`
// is what adfText and plainText read back from it, one line per block.
export function literalComment(body) {
  const blocks = sentText(body)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const heading = /^(#{1,6}) (.+)$/.exec(line);
      return heading ? { level: heading[1].length, words: heading[2] } : { level: 0, words: line };
    });
  const html = blocks.map(({ level, words }) => (level ? `<h${level}>${escapeHtml(words)}</h${level}>` : `<p>${escapeHtml(words)}</p>`)).join('');
  // What ao-step reads back: the plainText of each block, as adfText gives one line per block.
  return { html, text: blocks.map(({ words }) => plainText(words).trim()).join('\n') };
}
