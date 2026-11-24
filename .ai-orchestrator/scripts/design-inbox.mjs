// The design inbox of an item (tasks/todo.md item 10), for /ao-design in the main session. Run from the project root.
//
//   node .ai-orchestrator/scripts/design-inbox.mjs add <KEY> <folder> --url <artifact link> --version <v> [--title <t>]
//       takes the source files of a Claude artifact the Artifact tool saved in <folder>, outside the project
//       (project/canvas.json, project/*.dc.html, tokens, README), into .ai/design-inbox/<KEY>/<artifact id>/, and records
//       them in inbox.yaml
//   node .ai-orchestrator/scripts/design-inbox.mjs skip <KEY> --url <artifact link> --why <reason>
//       records a linked artifact that is no design, such as a memo, so /ao-spec does not wait for it
//   node .ai-orchestrator/scripts/design-inbox.mjs render <KEY>
//       writes each artboard of each Design as a page with no script into .ai/design-inbox/<KEY>/render/<code>.html, the
//       page ux reads and commits as the prototype, and draws it at its width and at 390 px into
//       .ai/design-inbox/<KEY>/shots/; a screenshot you put in .ai/design-inbox/<KEY>/, named
//       <code>[-variant]-desktop.png or -mobile.png, is used instead
//   node .ai-orchestrator/scripts/design-inbox.mjs check <KEY> [--link <url>]...
//       prints the screens of the inbox and what is wrong with it; exits 1 when something is
//   node .ai-orchestrator/scripts/design-inbox.mjs codes [--prefix USR --area CART]
//       prints the registry of screen codes, the next free code of an area and what is wrong with the registry
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { INBOX_FILE, RENDER_POLICY, artifactId, cliConfig, cliEnv, shotPlan, inboxEntry, inboxProblems, isArtifactLink, keptFile, normalLink, notDesignEntry, readInbox, readableArtboard, sha256, stripCanvas, withEntry, writeInbox } from '../lib/quality/design-inbox.mjs';
import { imageInfo } from '../lib/quality/design.mjs';
import { REGISTRY_FILE, checkRegistry, codeKind, codeParts, nextCode, readRegistry } from '../lib/quality/screen-codes.mjs';

const PLAYWRIGHT = '@playwright/cli@0.1.22';
const MAX_SIDE = 2000;
const KEY = /^[A-Z][A-Z0-9]*-\d+$/;
const VARIANT = /^[a-z][a-z0-9-]*$/;
const project = process.cwd();
const [command, ...rest] = process.argv.slice(2);

const options = (args) => {
  const named = {};
  const plain = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) (named[args[i].slice(2)] ??= []).push(args[i + 1]), (i += 1);
    else plain.push(args[i]);
  }
  return { named, plain };
};
// A refusal: thrown, not an exit, so render still writes inbox.yaml and closes its browser (independent pass of item 12).
class Refused extends Error {}
const fail = (message) => {
  throw new Refused(message);
};
const inboxDir = (key) => {
  if (!KEY.test(key ?? '')) fail(`'${key ?? ''}' is not a Jira key such as SHOP-120`);
  return join(project, '.ai', 'design-inbox', key);
};
const inside = (parent, child) => resolve(child).toLowerCase().startsWith(resolve(parent).toLowerCase() + sep);

// The inbox is in .ai/, which agents write: a folder on the way, or a file in it, could be a link, a symlink or a
// junction, to .claude/ or to a file of yours (security review of shop PR #98). So every folder from the project down
// is a real folder, a file is written only where nothing or a plain file was, and a file is read only when it is a
// plain file with no other name (a hard link has two).
const linkStat = (path) => {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};
const shown = (path) => relative(project, path).split(sep).join('/');
// Whether the folder is there; made when make is set.
function realFolder(dir, { make = true } = {}) {
  let at = project;
  for (const part of relative(project, dir).split(sep).filter(Boolean)) {
    at = join(at, part);
    const stat = linkStat(at);
    if (stat === null) {
      if (!make) return false;
      mkdirSync(at);
    } else if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`${shown(at)} is a link or not a folder: delete it, then run the command again`);
  }
  return true;
}
// Why a file may not be read or copied, or null for a plain file.
function linkProblem(file) {
  const stat = linkStat(file);
  if (stat === null) return 'is missing';
  return stat.isSymbolicLink() || !stat.isFile() || stat.nlink > 1 ? 'is a link to another file' : null;
}
function writeInside(file, bytes) {
  realFolder(dirname(file));
  const stat = linkStat(file);
  if (stat !== null && (stat.isSymbolicLink() || !stat.isFile())) fail(`${shown(file)} is a link or not a file: delete it, then run the command again`);
  // Removing a hard link leaves the other file as it was; "wx" writes no file another process put there meanwhile.
  if (stat !== null) rmSync(file);
  writeFileSync(file, bytes, { flag: 'wx' });
  // A folder made a link between the check and the write (independent pass of item 12): the file landed elsewhere, as
  // a new file, which "wx" made sure of, so it goes.
  const real = realpathSync.native(file);
  if (real.toLowerCase() !== join(realpathSync.native(project), relative(project, file)).toLowerCase()) {
    rmSync(file, { force: true });
    fail(`${shown(file)} was written through a link, ${real}: deleted it; delete the link, then run the command again`);
  }
}
// The bytes of a file of the inbox, or null when it is not there.
function readInside(file) {
  if (!realFolder(dirname(file), { make: false })) return null;
  const problem = linkProblem(file);
  if (problem === 'is missing') return null;
  if (problem) fail(`${shown(file)} ${problem}: delete it, then take the artifact again with add`);
  return readFileSync(file);
}
const readInboxOf = (dir) => {
  const bytes = readInside(join(dir, INBOX_FILE));
  return bytes === null ? null : readInbox(bytes.toString('utf8'));
};
const registry = () => (existsSync(join(project, REGISTRY_FILE)) ? readRegistry(readFileSync(join(project, REGISTRY_FILE), 'utf8')) : null);
const idOf = (screen) => `${screen.code}${screen.variant ? `-${screen.variant}` : ''}`;

// Every file under a folder, as a path with / relative to it.
function walk(root, dir = root) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name);
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? walk(root, at) : [relative(root, at).split(sep).join('/')];
  });
}

function linkOf(named) {
  const url = normalLink(named.url?.[0]);
  // Only the link of a Claude artifact names a folder: anything else could name one outside the inbox.
  if (!isArtifactLink(url)) fail(`'${named.url?.[0] ?? ''}' is not the link of a Claude artifact, such as https://claude.ai/artifact/<id>`);
  return url;
}

function add([key, folder, ...more]) {
  const dir = inboxDir(key);
  const { named } = options(more);
  const url = linkOf(named);
  if (!folder || !existsSync(folder)) fail(`the folder '${folder ?? ''}' does not exist`);
  // The folder the Artifact tool saved holds every file of the artifact, an instruction file among them perhaps: it
  // stays outside the project, where Claude Code never reads it.
  if (inside(project, folder) || resolve(folder).toLowerCase() === resolve(project).toLowerCase()) fail(`${folder} is inside the project: keep the folder of an artifact outside it, as the Artifact tool saves it, and add from there`);
  const target = join(dir, artifactId(url));
  if (!inside(dir, target)) fail(`the folder of ${url} would be outside .ai/design-inbox/${key}/`);
  const all = walk(resolve(folder));
  const kept = all.filter(keptFile);
  const left = all.filter((path) => !keptFile(path) && path.startsWith('project/'));
  const files = kept.map((path) => ({ path, bytes: readFileSync(join(folder, path)) }));
  const entry = inboxEntry({ url, version: named.version?.[0] ?? null, title: named.title?.[0] ?? null, files });
  if (entry.kind === 'unknown') fail(`${folder} holds no project/canvas.json and no project/tokens.json: it is not a Design or a Design System of Claude. When the item links it for another reason, record it with skip`);
  const inbox = withEntry(readInboxOf(dir) ?? { key, sources: [] }, entry);
  for (const { path, bytes } of files) writeInside(join(target, path), bytes);
  writeInside(join(dir, INBOX_FILE), writeInbox(inbox));
  console.log(`Added ${url} (${entry.kind}, version ${entry.version ?? 'unknown'}) to .ai/design-inbox/${key}/: ${files.length} file${files.length === 1 ? '' : 's'}`);
  if (left.length > 0) console.log(`Left out ${left.length} file${left.length === 1 ? '' : 's'} the inbox does not keep: ${left.join(', ')}`);
  for (const screen of entry.screens ?? []) console.log(`  ${idOf(screen)} · ${screen.name} (${screen.file})`);
}

function skip([key, ...more]) {
  const dir = inboxDir(key);
  const { named } = options(more);
  const url = linkOf(named);
  const why = named.why?.[0];
  if (!why) fail('say why the link is no design: --why <reason>');
  writeInside(join(dir, INBOX_FILE), writeInbox(withEntry(readInboxOf(dir) ?? { key, sources: [] }, notDesignEntry({ url, why }))));
  console.log(`Recorded ${url} as no design of ${key}: ${why}`);
}

// Serves only the render folder, on 127.0.0.1, with the CSP of the pages also as a header, while the browser draws.
function serve(root) {
  const server = createServer((req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '');
      const path = resolve(root, name);
      if (!inside(root, path) || !existsSync(path)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': path.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream', 'content-security-policy': RENDER_POLICY }).end(readFileSync(path));
    } catch {
      res.writeHead(400).end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

// npx with no shell, so no argument is read by one (an `eval` with `=>` once wrote a file named after the expression):
// the npx of the npm next to node, as on Windows, where a .cmd needs a shell; else npx on the PATH.
const NPX_CLI = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
const [NPX, NPX_ARGS] = existsSync(NPX_CLI) ? [process.execPath, [NPX_CLI]] : ['npx', []];
function cli(args, browser) {
  return new Promise((done) => {
    // --prefix: npm looks for packages in the work folder only, never in a folder above it, where a package.json with
    // workspaces could name it (independent pass of item 12), and not among global packages.
    const child = spawn(NPX, [...NPX_ARGS, `--prefix=${browser.work}`, '-y', PLAYWRIGHT, '-s=ao-design', ...args], { cwd: browser.work, env: browser.env, shell: false });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('close', (code) => done({ code, out }));
    child.on('error', (error) => done({ code: 1, out: error.message }));
  });
}

// The browser of a render: a folder of its own under the temp folder of your account, never in the project, where the
// CLI runs, finds no node_modules or config an agent put there, and writes its files; the pages it draws are served
// from there (security review of shop PR #98: npx ran in the inbox, which agents write).
async function startBrowser() {
  const work = mkdtempSync(join(tmpdir(), 'ao-design-'));
  // The project of npm, with no node_modules, so npx runs the CLI of its own cache.
  writeFileSync(join(work, 'package.json'), '{ "private": true }\n');
  mkdirSync(join(work, 'pages'));
  mkdirSync(join(work, 'shots'));
  const server = await serve(join(work, 'pages'));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = join(work, 'cli.config.json');
  writeFileSync(config, JSON.stringify(cliConfig({ base, work }), null, 2));
  return { work, server, base, config, env: cliEnv(process.env, work) };
}

// The page the browser shows, as an eval of the CLI prints it.
async function shownPage(browser) {
  const result = (await cli(['eval', '() => location.href'], browser)).out.match(/### Result\s+("[^"\n]*")/)?.[1];
  return result ? JSON.parse(result) : null;
}

async function shoot(page, width, height, file, browser) {
  // An image of an earlier render never passes for this one.
  rmSync(file, { force: true });
  await cli(['resize', String(width), String(height)], browser);
  const measured = Number((await cli(['eval', '() => document.documentElement.scrollHeight'], browser)).out.match(/### Result\s+(\d+)/)?.[1]);
  const full = Number.isFinite(measured) && measured > 0 ? measured : height;
  await cli(['resize', String(width), String(Math.min(full, MAX_SIDE))], browser);
  const shot = await cli(['screenshot', '--filename', file], browser);
  // The image is of the page served, or none is kept: a page that moved elsewhere drew something else (security review
  // of shop PR #98).
  const shown = await shownPage(browser);
  if (shown !== page) {
    rmSync(file, { force: true });
    throw new Error(`the browser left ${page} for ${shown ?? 'a page it did not name'}, so no image of it is kept`);
  }
  if (!existsSync(file)) throw new Error(`no image for ${page}: ${shot.out.split('\n').slice(0, 3).join(' ')}`);
  return { cut: full > MAX_SIDE, full };
}

// The screenshots you put in the inbox for a screen: <id>-desktop and <id>-mobile, PNG or JPG; <id> alone for a variant.
function yourShots(dir, id) {
  return readdirSync(dir).filter((name) => new RegExp(`^${id}(-desktop|-mobile)?\\.(png|jpe?g)$`).test(name));
}

const describe = (dir, file) => {
  const info = imageInfo(readFileSync(join(dir, file)));
  return `${file}, ${info.width}×${info.height} px, ${Math.round(info.size / 1024)} KB${info.size > 1024 * 1024 ? '; over 1 MB: check-design refuses it' : ''}${Math.max(info.width ?? 0, info.height ?? 0) > MAX_SIDE ? `; over ${MAX_SIDE} px: check-design refuses it` : ''}`;
};

async function render([key]) {
  const dir = inboxDir(key);
  const inbox = readInboxOf(dir);
  if (!inbox) fail(`.ai/design-inbox/${key}/${INBOX_FILE} does not exist: add an artifact first`);
  const pages = join(dir, 'render');
  realFolder(pages);
  realFolder(join(dir, 'shots'));
  const report = [];
  const needShot = (id) => `put a screenshot of it in .ai/design-inbox/${key}/ named ${id}-desktop.png or ${id}-mobile.png, then run render again`;
  // Started for the first artboard to draw: a render of your screenshots only opens no browser.
  let browser = null;
  try {
    for (const source of inbox.sources.filter(({ kind }) => kind === 'claude-design')) {
      const screens = source.screens ?? [];
      const hashes = new Map((source.files ?? []).map(({ path, sha256: hash }) => [path, hash]));
      for (const screen of screens) {
        const id = idOf(screen);
        if (!readableArtboard(source.dir, screen.file) || codeKind(screen.code) !== 'project' || (screen.variant && !VARIANT.test(String(screen.variant)))) {
          report.push(`${id}: ${source.dir}/${screen.file} is not an artboard add wrote; inbox.yaml changed by hand? Take the artifact again with add`);
          continue;
        }
        screen.shots = [];
        const yours = yourShots(dir, id);
        if (yours.length > 0) {
          for (const name of yours) {
            // A link could be any file of yours, which ux would commit as an image.
            const problem = linkProblem(join(dir, name));
            if (problem) {
              report.push(`${id}: ${name} ${problem}: put the image itself in .ai/design-inbox/${key}/`);
              continue;
            }
            writeInside(join(dir, 'shots', name), readFileSync(join(dir, name)));
            screen.shots.push(`shots/${name}`);
            report.push(`${id}: your screenshot ${describe(dir, `shots/${name}`)}`);
          }
          continue;
        }
        // The artboard as add took it: inbox.yaml records its hash. One that is a link stops its screen only.
        let board;
        try {
          board = readInside(join(dir, source.dir, screen.file));
        } catch (error) {
          if (!(error instanceof Refused)) throw error;
          report.push(`${id}: ${error.message}`);
          continue;
        }
        if (board === null || sha256(board) !== hashes.get(screen.file)) {
          report.push(`${id}: ${source.dir}/${screen.file} changed after it was taken, or is missing: take the artifact again with add`);
          continue;
        }
        const { html, dynamic, problem } = stripCanvas(board.toString('utf8'));
        if (!html) {
          report.push(`${id}: ${problem}; ${needShot(id)}`);
          continue;
        }
        // The page with no script is what ux reads and commits as the prototype, a dynamic one too.
        writeInside(join(pages, `${id}.html`), html);
        if (dynamic) {
          report.push(`${id}: it binds values or imports another artboard, which only Claude Design draws; ${needShot(id)}`);
          continue;
        }
        browser ??= await startBrowser();
        const page = `${browser.base}/${id}.html`;
        writeFileSync(join(browser.work, 'pages', `${id}.html`), html);
        try {
          await cli(['open', page, `--config=${browser.config}`], browser);
          for (const { size, width: w, height: h, file } of shotPlan(screen, screens)) {
            const { cut, full } = await shoot(page, w, h, join(browser.work, file), browser);
            writeInside(join(dir, file), readFileSync(join(browser.work, file)));
            screen.shots.push(file);
            report.push(`${id} ${size}: ${describe(dir, file)}${cut ? `; the page is ${full} px tall, cut at ${MAX_SIDE} px: put the rest in slices if ux needs it` : ''}`);
          }
        } catch (error) {
          report.push(`${id}: ${error.message}`);
        } finally {
          await cli(['close'], browser);
        }
      }
    }
  } finally {
    // inbox.yaml first: a temp folder the CLI still holds must not cost the record of the images.
    try {
      writeInside(join(dir, INBOX_FILE), writeInbox(inbox));
    } finally {
      if (browser) {
        browser.server.close();
        try {
          rmSync(browser.work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch {
          report.push(`the temp folder ${browser.work} is still in use: delete it later`);
        }
      }
    }
  }
  console.log([`Rendered the Designs of .ai/design-inbox/${key}/ with no script:`, ...report.map((line) => `  ${line}`)].join('\n'));
}

function check([key, ...more]) {
  const dir = inboxDir(key);
  const inbox = readInboxOf(dir);
  const links = (options(more).named.link ?? []).map(normalLink);
  if (!inbox) {
    console.log(`.ai/design-inbox/${key}/${INBOX_FILE}: none yet${links.length > 0 ? `; to take: ${links.join(', ')}` : ''}`);
    if (links.length > 0) process.exitCode = 1;
    return;
  }
  // Plain files only: a hard link could be any file of yours, and its text must not reach a parse error (independent
  // pass of item 12).
  const linked = walk(dir).filter((path) => linkProblem(join(dir, path)) !== null);
  const files = new Map(walk(dir).filter((path) => !linked.includes(path)).map((path) => [path, readFileSync(join(dir, path))]));
  const lines = [`.ai/design-inbox/${key}/${INBOX_FILE}:`];
  for (const source of inbox.sources) {
    if (source.kind === 'not-design') {
      lines.push(`- no design: ${source.url} (${source.why ?? ''})`);
      continue;
    }
    lines.push(`- ${source.kind} ${source.url} version ${source.version ?? 'unknown'}: ${source.title ?? ''}`);
    for (const screen of source.screens ?? []) lines.push(`  - ${idOf(screen)} · ${screen.name}: ${screen.file}; images ${screen.shots?.length ? screen.shots.join(', ') : 'none'}`);
  }
  const problems = [...linked.map((path) => `${path} is a link to another file: delete it, then take the artifact again with add`), ...inboxProblems(inbox, { files, registry: registry(), links })];
  lines.push(problems.length === 0 ? 'Inbox OK' : `Problems:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  console.log(lines.join('\n'));
  if (problems.length > 0) process.exitCode = 1;
}

function codes(args) {
  const { named } = options(args);
  const [prefix, area] = [named.prefix?.[0], named.area?.[0]];
  if (('prefix' in named || 'area' in named) && !(/^[A-Z]{3}$/.test(prefix ?? '') && /^[A-Z]{2,4}$/.test(area ?? ''))) fail('--prefix takes 3 capitals and --area 2 to 4 capitals, such as --prefix USR --area CART');
  const read = registry();
  if (!read) return console.log(`${REGISTRY_FILE} does not exist yet: ux writes it with the first project screen code, and you approve it at gate ①`);
  const lines = [`${REGISTRY_FILE}: ${read.screens.length} screen${read.screens.length === 1 ? '' : 's'}`];
  lines.push(`Apps: ${read.apps.map(({ prefix: p, app }) => `${p} ${app}`).join(', ') || 'none'}`);
  lines.push(`Areas: ${read.areas.map(({ area: a, meaning }) => `${a} ${meaning}`).join(', ') || 'none'}`);
  const pairs = new Set(read.screens.map(({ code }) => codeParts(code)).filter(Boolean).map((parts) => `${parts.prefix} ${parts.area}`));
  if (prefix && area) pairs.add(`${prefix} ${area}`);
  for (const pair of [...pairs].sort()) {
    const [p, a] = pair.split(' ');
    lines.push(`Next ${p}-${a}: ${nextCode(read, p, a) ?? 'none, the area is full'}`);
  }
  // The one place, with the policy job of a PR that changes it, that lists what is wrong with the registry: check-design
  // says only how many (review of shop PR #98).
  const problems = checkRegistry(read);
  if (problems.length > 0) {
    lines.push('Problems:', ...problems.map(({ rule, line, message }) => `  - ${REGISTRY_FILE}:${line} ${rule} ${message}`));
    process.exitCode = 1;
  }
  console.log(lines.join('\n'));
}

const commands = { add, skip, render, check, codes };
try {
  if (!commands[command]) fail('usage: design-inbox.mjs add|skip|render|check|codes …');
  await commands[command](rest);
} catch (error) {
  if (!(error instanceof Refused)) throw error;
  console.error(`design-inbox: ${error.message}`);
  process.exitCode = 1;
}
