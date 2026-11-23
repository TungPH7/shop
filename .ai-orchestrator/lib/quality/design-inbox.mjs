// The design inbox of an item (tasks/todo.md item 10): .ai/design-inbox/<KEY>/ holds what the main session took from a
// Claude artifact, a Design or a Design System, with inbox.yaml naming each source, its version, the hash of each file
// and the screens of a Design. ux reads it; it never opens a link itself. Pure: scripts/design-inbox.mjs reads and
// writes the files.
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { PROJECT_CODE, codeKind } from './screen-codes.mjs';

export const INBOX_FILE = 'inbox.yaml';
const ARTIFACT = 'https://claude\\.ai/(?:artifact/[A-Za-z0-9]{10,40}|code/artifact/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';
const ARTIFACT_LINK = new RegExp(`^${ARTIFACT}$`);
const BOARD_FILE = new RegExp(`^(${PROJECT_CODE})(?:-([a-z][a-z0-9-]*))?\\.dc\\.html$`);
const SAFE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
// Names Claude Code reads as instructions when an agent reads a file next to them (on Windows whatever their case,
// as tests/fixtures/design/claude.md showed): an artifact never brings one into the project.
const INSTRUCTION_NAME = /(^|\/)(claude(\.local)?\.md|agents\.md|\.claude|\.mcp\.json)(\/|$)/i;

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// The links of Claude artifacts in a text, such as the description of an Epic, each once, in order.
export function artifactLinks(text) {
  const found = String(text ?? '').match(new RegExp(`${ARTIFACT}(?![A-Za-z0-9/-])`, 'g')) ?? [];
  return [...new Set(found)];
}

// The id of an artifact, the folder of its files in the inbox: null for anything but the link of a Claude artifact, so
// a link never names a folder outside the inbox (review before kit PR of item 10: a URL ending in `..\..\.claude\rules`).
export const isArtifactLink = (url) => ARTIFACT_LINK.test(String(url ?? ''));
export const artifactId = (url) => (isArtifactLink(url) ? String(url).split('/').at(-1) : null);

// The links of Claude artifacts anywhere in the description of an item as Jira gives it: its text, and the URL of a
// smart link or of a link mark, which plain text leaves out.
export const descriptionLinks = (description) => artifactLinks(typeof description === 'string' ? description : JSON.stringify(description ?? ''));

// The files of an artifact the inbox keeps: the source of a Design (its canvas, artboards and the tokens it copied)
// or of a Design System (its tokens, README and record), never the code of the artifact type or a file Claude Code
// would read as instructions. path: the published path, such as project/canvas.json.
export function keptFile(path) {
  if (!SAFE_PATH.test(path) || path.split('/').includes('..') || INSTRUCTION_NAME.test(path)) return false;
  return /^project\/(canvas\.json|design-system\.json|tokens\.json|README\.md|[^/]+\.dc\.html|ds\/[^/]+\/tokens\.json|components\/[^/]+\/preview\.html)$/.test(path);
}

// 'design' for an artifact with a canvas, 'design-system' for one with design-system.json, else null.
export function sourceKind(paths) {
  if (paths.includes('project/canvas.json')) return 'design';
  if (paths.includes('project/design-system.json') || paths.includes('project/tokens.json')) return 'design-system';
  return null;
}

// The screens of a Design, from its canvas.json: one per artboard, its code from the file name (USR-CART01.dc.html, or
// USR-CART01-mobile.dc.html for a variant), its name from the title after "<code> · ". Problems say what to fix in
// Claude Design. { screens: [{ code, variant, name, file, width, height }], systems: [{ title, url }], problems }.
export function boardsOf(canvasText) {
  const problems = [];
  let canvas;
  try {
    canvas = JSON.parse(canvasText);
  } catch (cause) {
    return { screens: [], systems: [], problems: [`canvas.json does not parse: ${cause.message}`] };
  }
  const boards = canvas?.boards && typeof canvas.boards === 'object' && !Array.isArray(canvas.boards) ? canvas.boards : {};
  const order = Array.isArray(canvas?.order) ? canvas.order.filter((file) => typeof file === 'string' && Object.hasOwn(boards, file)) : [];
  const files = [...order, ...Object.keys(boards).filter((file) => !order.includes(file))];
  const screens = [];
  for (const file of files) {
    const board = boards[file] && typeof boards[file] === 'object' ? boards[file] : {};
    const base = file.split('/').at(-1);
    if (!SAFE_PATH.test(file) || file.split('/').includes('..')) {
      problems.push(`the artboard file '${file}' has a name the inbox does not take: letters, digits, dot, hyphen and underscore only`);
      continue;
    }
    const found = BOARD_FILE.exec(base);
    if (!found) {
      problems.push(`the artboard ${file} has no screen code in its file name: name it after its code, such as USR-CART01.dc.html, or USR-CART01-mobile.dc.html for a variant`);
      continue;
    }
    const [, code, variant = null] = found;
    const title = String(board.title ?? '');
    const prefix = `${code} · `;
    if (!title.startsWith(prefix) || title.length === prefix.length) problems.push(`the title of the artboard ${file} is "${title}": it starts with "${prefix}" and the name of the screen`);
    const size = (value) => (Number.isInteger(value) && value > 0 ? value : null);
    screens.push({ code, variant, name: title.startsWith(prefix) ? title.slice(prefix.length).trim() : title, file: `project/${file}`, width: size(board.w), height: size(board.h) });
  }
  const seen = new Map();
  for (const { code, variant, file } of screens) {
    const id = `${code}${variant ? `-${variant}` : ''}`;
    if (seen.has(id)) problems.push(`${id} is the code of two artboards, ${seen.get(id)} and ${file}`);
    seen.set(id, file);
  }
  const systems = (Array.isArray(canvas?.designSystems) ? canvas.designSystems : []).filter((s) => s && typeof s === 'object').map(({ title, artifact }) => ({ title: String(title ?? ''), url: String(artifact ?? '') }));
  return { screens, systems, problems };
}

// A page a browser renders with no script: the artboard of a Claude Design without its canvas runtime.
// - <head> is built, not copied: the CSP, the stylesheets of Google Fonts the helmet names (rebuilt from their parsed
//   URL), and the text of its <style> blocks.
// - In the body, every tag that runs, loads, frames or moves the page (script, iframe, object, embed, frame, base, form,
//   meta, link, style, template, portal, applet, noscript) has its "<" escaped, so it shows as text and is never a tag.
//   Nothing is deleted at that step: a deletion could join two halves into a new tag (review before kit PR of item 10:
//   `<me<meta http-equiv>ta http-equiv="refresh">` came back as a refresh, which left the page and its CSP).
// - The Content-Security-Policy, in the page and as a header of the local server, lets in only inline styles, Google
//   Fonts and images of the local server.
// dynamic: the artboard binds values or imports another ({{ }}, sc-if, sc-for, dc-import), which only the runtime draws,
// so its image comes from the human.
export const RENDER_POLICY = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; base-uri 'none'; form-action 'none'";
const FONT_SHEET = /https:\/\/fonts\.googleapis\.com\/css2?\?[A-Za-z0-9=:;,@&%+._~-]+/g;
// Inline <svg> icons stay: an SVG moves no page by itself, and a <script> inside one is escaped like any other.
const LIVE_TAG = /<(\/?)(?=(script|iframe|object|embed|frame|frameset|base|form|meta|link|style|template|portal|applet|noscript)\b)/gi;
const escapeLive = (part) => part.replace(LIVE_TAG, '&lt;$1');
const attribute = (value) => value.replace(/&amp;/g, '&').replace(/[<>"']/g, '');
export function stripCanvas(html) {
  const text = String(html ?? '');
  const lang = text.match(/<html[^>]*\blang="([A-Za-z-]{2,12})"/i)?.[1] ?? 'en';
  const inner = text.match(/<x-dc>([\s\S]*?)<\/x-dc>/i)?.[1];
  if (inner === undefined) return { html: null, dynamic: false, problem: 'the file has no <x-dc> element: it is not an artboard of Claude Design' };
  const helmet = inner.match(/<helmet>([\s\S]*?)<\/helmet>/i)?.[1] ?? '';
  const body = inner.replace(/<helmet>[\s\S]*?<\/helmet>/i, '');
  const dynamic = /\{\{|<sc-(if|for)\b|<dc-import\b/i.test(body);
  const sheets = [...new Set((helmet.replace(/&amp;/g, '&').match(FONT_SHEET) ?? []).map(attribute))];
  const styles = [...helmet.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(([, css]) => css.replace(/<\/?style/gi, ''));
  const cleanBody = escapeLive(body
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/(href|src|action|formaction|data)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"'));
  const head = [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${RENDER_POLICY}">`,
    ...sheets.map((href) => `<link rel="stylesheet" href="${href}">`),
    ...styles.map((css) => `<style>${css}</style>`),
  ].join('\n');
  return { html: `<!doctype html>\n<html lang="${lang}">\n<head>\n${head}\n</head>\n<body>\n${cleanBody}\n</body>\n</html>\n`, dynamic };
}

// Whether an artboard named in inbox.yaml may be read: its folder an artifact id, its file a kept artboard. inbox.yaml
// sits in .ai/, which agents write, so render reads only what add could have written (threat model of item 10).
export const readableArtboard = (dir, file) => /^[A-Za-z0-9-]{10,40}$/.test(dir ?? '') && /^project\/[^/]+\.dc\.html$/.test(file ?? '') && keptFile(file);

// The entry of inbox.yaml for one artifact. files: [{ path, bytes }] of the kept files.
export function inboxEntry({ url, version, title, files, now }) {
  const paths = files.map(({ path }) => path);
  const kind = sourceKind(paths);
  const entry = {
    kind: kind === 'design' ? 'claude-design' : kind === 'design-system' ? 'claude-design-system' : 'unknown',
    url,
    version: version ?? null,
    title: title ?? null,
    dir: artifactId(url),
    added: new Date(now ?? Date.now()).toISOString(),
    files: files.map(({ path, bytes }) => ({ path, sha256: sha256(bytes) })),
  };
  if (kind === 'design') {
    const canvas = files.find(({ path }) => path === 'project/canvas.json');
    const { screens, systems } = boardsOf(canvas.bytes.toString('utf8'));
    entry.screens = screens.map((screen) => ({ ...screen, shots: [] }));
    entry.design_systems = systems;
  }
  return entry;
}

// The entry of a link the human says is no design, such as a Claude Docs memo the Epic links for its context: /ao-spec
// stops for it no more (review before kit PR of item 10: any other artifact link blocked stage spec for good).
export const notDesignEntry = ({ url, why, now }) => ({ kind: 'not-design', url, why: String(why ?? '').trim() || null, added: new Date(now ?? Date.now()).toISOString() });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Reads inbox.yaml: { key, sources: [entry] }, or throws with what is wrong. An entry, or a screen of one, that is not
// a mapping is left out: the file sits in .ai/, which agents write.
export function readInbox(text) {
  const data = parse(String(text ?? '')) ?? {};
  if (!Array.isArray(data.sources)) throw new Error(`${INBOX_FILE} has no list sources`);
  const sources = data.sources.filter(isObject).map((source) => ({
    ...source,
    files: Array.isArray(source.files) ? source.files.filter(isObject) : [],
    ...(source.screens !== undefined && { screens: Array.isArray(source.screens) ? source.screens.filter(isObject).map((screen) => ({ ...screen, shots: Array.isArray(screen.shots) ? screen.shots.filter((shot) => typeof shot === 'string') : [] })) : [] }),
  }));
  return { key: data.key ?? null, sources };
}

export function writeInbox({ key, sources }) {
  return `# Written by node .ai-orchestrator/scripts/design-inbox.mjs (tasks/todo.md item 10); do not edit by hand.\n${stringify({ key, sources })}`;
}

// The inbox with the entry of a link replaced, or added at the end.
export function withEntry(inbox, entry) {
  const sources = inbox.sources.filter(({ url }) => url !== entry.url);
  return { ...inbox, sources: [...sources, entry] };
}

// What check prints: problems with the inbox of KEY. files: Map of path in the inbox folder → bytes; registry: the
// output of readRegistry, or null. Problems are sentences; an empty list means the inbox is ready for ux.
export function inboxProblems(inbox, { files, registry, links = [] }) {
  const problems = [];
  for (const link of links.filter((url) => !inbox.sources.some((source) => source?.url === url))) problems.push(`${link} is linked from the item but not in the inbox: /ao-design takes it`);
  for (const source of inbox.sources.filter(isObject)) {
    if (!ARTIFACT_LINK.test(source.url ?? '')) problems.push(`${source.url} is not the link of a Claude artifact`);
    if (source.kind === 'not-design') continue;
    if (!/^[A-Za-z0-9-]{10,40}$/.test(source.dir ?? '')) problems.push(`the folder of ${source.url} is not a name the inbox takes`);
    for (const { path, sha256: hash } of source.files ?? []) {
      const at = `${source.dir}/${path}`;
      if (!keptFile(path)) problems.push(`${at} is not a file the inbox keeps`);
      else if (!files.has(at)) problems.push(`${at} is missing`);
      else if (sha256(files.get(at)) !== hash) problems.push(`${at} changed after it was taken: take the artifact again with /ao-design`);
    }
    if (source.kind !== 'claude-design') continue;
    const canvas = files.get(`${source.dir}/project/canvas.json`);
    if (canvas) problems.push(...boardsOf(canvas.toString('utf8')).problems.map((problem) => `${source.title ?? source.url}: ${problem}`));
    for (const { code, variant, name, file, shots = [] } of (source.screens ?? []).filter(isObject)) {
      if (codeKind(code) !== 'project') continue;
      const known = registry?.screens.find((screen) => screen.code === code);
      if (known?.state === 'bỏ') problems.push(`${code} is retired in docs/design-system/screens.md: give ${file} a new code`);
      const id = `${code}${variant ? `-${variant}` : ''}`;
      if (shots.length === 0) problems.push(`${id} (${name}) has no image yet: put a screenshot of it in the inbox, named ${id}-desktop.png or ${id}-mobile.png, then run render again`);
    }
  }
  return problems;
}

// The images render takes of one screen: [{ size, width, height, file }]. A screen of its own width or wider is drawn at
// it, up to 2,000 px, and at 390 px, unless an artboard -mobile of the same code draws the phone (review before kit
// PR of item 10: both wrote shots/<code>-mobile.png); an artboard -mobile, or one 480 px wide or less, at 390 px only.
export const SHOT_SIZES = { mobile: { width: 390, height: 844 }, minWidth: 320, maxSide: 2000 };
export function shotPlan(screen, screens = [screen]) {
  const id = `${screen.code}${screen.variant ? `-${screen.variant}` : ''}`;
  const { mobile, minWidth, maxSide } = SHOT_SIZES;
  const width = Math.min(Math.max(Number.isInteger(screen.width) ? screen.width : 1440, minWidth), maxSide);
  const height = Math.min(Math.max(Number.isInteger(screen.height) ? screen.height : 900, 200), maxSide);
  if (screen.variant === 'mobile') return [{ size: 'mobile', ...mobile, file: `shots/${id}.png` }];
  if (width <= 480) return [{ size: 'mobile', ...mobile, file: `shots/${id}-mobile.png` }];
  const ownMobile = !screen.variant && screens.some((other) => other?.code === screen.code && other.variant === 'mobile');
  return [{ size: 'desktop', width, height, file: `shots/${id}-desktop.png` }, ...(ownMobile ? [] : [{ size: 'mobile', ...mobile, file: `shots/${id}-mobile.png` }])];
}
