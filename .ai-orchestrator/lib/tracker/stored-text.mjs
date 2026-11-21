// The text of a comment as Jira keeps it and ao-step reads it (review of shop PR #80). The hooks of block-atlassian read
// what an agent sends: markdown, HTML or a document of Jira. ao-step reads the plain text of the document Jira made of
// it. A hook that reads the markdown as it is lets through what the reader still sees: a space that is not a space,
// bold, an escape, a quote. Both sides read through plainText, and the hook first drops the markup. Dropping more than
// Jira does is fine here: the hook then refuses more, never less. Pure.

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

// The named references the hooks decode: the signs of markdown, the spaces and the marks with no width. A reference not
// here is left as it is, and the hooks fail closed on it (review of shop PR #81): Jira may decode every reference of
// HTML5, some with no ";" too, so one this table does not know could hide a word.
const SPACE = ' ';
const ENTITIES = {
  nbsp: SPACE, ensp: SPACE, emsp: SPACE, emsp13: SPACE, emsp14: SPACE, numsp: SPACE, puncsp: SPACE, thinsp: SPACE, hairsp: SPACE, mediumspace: SPACE, thickspace: SPACE, tab: SPACE, newline: '\n',
  zerowidthspace: '', zwj: '', zwnj: '', shy: '', nobreak: '', wj: '', negativemediumspace: '', negativethickspace: '', negativethinspace: '', negativeverythinspace: '', invisibletimes: '', invisiblecomma: '', it: '', ic: '',
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', semi: ';', num: '#', ast: '*', midast: '*', lowbar: '_', grave: '`', bsol: '\\', verbar: '|', vert: '|', lsqb: '[', rsqb: ']', lbrack: '[', rbrack: ']', lpar: '(', rpar: ')', lcub: '{', rcub: '}', lbrace: '{', rbrace: '}', plus: '+', excl: '!', quest: '?', period: '.', comma: ',', dollar: '$', percnt: '%', sol: '/', equals: '=', hat: '^', tilde: '~',
};
// A reference: numeric with or without ";", as HTML reads it, or a name.
const REFERENCE = /&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*)(;?)/g;
const entity = (whole, name, semi) => {
  if (name[0] === '#') {
    const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  }
  const known = ENTITIES[name.toLowerCase()];
  if (known !== undefined) return known;
  // With no ";", HTML reads the longest name it knows at the start, as &nbspreport is a space and "report".
  if (!semi) {
    for (let end = name.length - 1; end >= 2; end -= 1) {
      const start = ENTITIES[name.slice(0, end).toLowerCase()];
      if (start !== undefined) return `${start}${name.slice(end)}`;
    }
  }
  return whole;
};
// A reference left after decoding, such as &acirc; or the &T of AT&T, or null: the hooks fail closed on it.
const LEFT = /&(?:#[0-9A-Za-z]*|[A-Za-z][A-Za-z0-9]*);?/;
export const undecodedReference = (text) => LEFT.exec(String(text ?? ''))?.[0] ?? null;
// The text with each reference left read as `by`: a space, or nothing.
export const withReferencesAs = (text, by) => String(text ?? '').replace(new RegExp(LEFT.source, 'g'), by);
// The tags of HTML that start a block: each starts a line, as Jira keeps them.
const BLOCK_TAG = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|blockquote|pre|table|thead|tbody|tr|td|th|hr|section|article|header|footer)\b[^>]*>/gi;
// What starts a line of markdown and is gone from the text Jira keeps: a quote, a heading, a list, a cell of a table.
const LINE_MARKS = /^(?:[ >#|+-]|\d+[.)](?=\s))+/;

// The text of markdown or HTML once Jira has kept it, for the hooks.
export function markupText(text) {
  const decoded = String(text ?? '')
    .replace(BLOCK_TAG, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(REFERENCE, entity);
  const plain = plainText(decoded)
    // A link keeps its words: [Cần](url) is Cần.
    .replace(/\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
    // An escape keeps the sign: Cần ba\: is Cần ba:.
    .replace(/\\([^\s\\])/g, '$1')
    // A macro of Jira's wiki markup keeps none of its words: {color:red}Cần{color} is Cần.
    .replace(/\{[^{}\n]*\}/g, '')
    // Bold, italic, strike, underline and code marks, of markdown and of the wiki markup.
    .replace(/[*_~`+^]/g, '');
  return plain
    .split('\n')
    .map((line) => line.replace(LINE_MARKS, '').trim())
    .join('\n');
}
