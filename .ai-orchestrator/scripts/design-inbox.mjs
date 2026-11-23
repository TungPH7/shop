// The design inbox of an item (tasks/todo.md item 10), for /ao-design in the main session. Run from the project root.
//
//   node .ai-orchestrator/scripts/design-inbox.mjs add <KEY> <folder> --url <artifact link> --version <v> [--title <t>]
//       takes the source files of a Claude artifact the Artifact tool saved in <folder>, outside the project
//       (project/canvas.json, project/*.dc.html, tokens, README), into .ai/design-inbox/<KEY>/<artifact id>/, and records
//       them in inbox.yaml
//   node .ai-orchestrator/scripts/design-inbox.mjs skip <KEY> --url <artifact link> --why <reason>
//       records a linked artifact that is no design, such as a memo, so /ao-spec does not wait for it
//   node .ai-orchestrator/scripts/design-inbox.mjs render <KEY>
//       draws each artboard of each Design with no script, at its width and at 390 px, into .ai/design-inbox/<KEY>/shots/;
//       a screenshot you put in .ai/design-inbox/<KEY>/, named <code>[-variant]-desktop.png or -mobile.png, is used instead
//   node .ai-orchestrator/scripts/design-inbox.mjs check <KEY> [--link <url>]...
//       prints the screens of the inbox and what is wrong with it; exits 1 when something is
//   node .ai-orchestrator/scripts/design-inbox.mjs codes [--prefix USR --area CART]
//       prints the registry of screen codes and the next free code of an area
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { INBOX_FILE, RENDER_POLICY, artifactId, shotPlan, inboxEntry, inboxProblems, isArtifactLink, keptFile, notDesignEntry, readInbox, readableArtboard, stripCanvas, withEntry, writeInbox } from '../lib/quality/design-inbox.mjs';
import { imageInfo } from '../lib/quality/design.mjs';
import { REGISTRY_FILE, codeKind, codeParts, nextCode, readRegistry } from '../lib/quality/screen-codes.mjs';

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
const fail = (message) => {
  console.error(`design-inbox: ${message}`);
  process.exit(1);
};
const inboxDir = (key) => {
  if (!KEY.test(key ?? '')) fail(`'${key ?? ''}' is not a Jira key such as SHOP-120`);
  return join(project, '.ai', 'design-inbox', key);
};
const inside = (parent, child) => resolve(child).toLowerCase().startsWith(resolve(parent).toLowerCase() + sep);
const readInboxOf = (dir) => (existsSync(join(dir, INBOX_FILE)) ? readInbox(readFileSync(join(dir, INBOX_FILE), 'utf8')) : null);
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
  const url = named.url?.[0];
  // Only the link of a Claude artifact names a folder: anything else could name one outside the inbox.
  if (!isArtifactLink(url)) fail(`'${url ?? ''}' is not the link of a Claude artifact, such as https://claude.ai/artifact/<id>`);
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
  for (const { path, bytes } of files) {
    mkdirSync(dirname(join(target, path)), { recursive: true });
    writeFileSync(join(target, path), bytes);
  }
  const inbox = withEntry(readInboxOf(dir) ?? { key, sources: [] }, entry);
  writeFileSync(join(dir, INBOX_FILE), writeInbox(inbox));
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
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, INBOX_FILE), writeInbox(withEntry(readInboxOf(dir) ?? { key, sources: [] }, notDesignEntry({ url, why }))));
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
function cli(args, cwd) {
  return new Promise((done) => {
    const child = spawn(NPX, [...NPX_ARGS, '-y', PLAYWRIGHT, '-s=ao-design', ...args], { cwd, shell: false });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('close', (code) => done({ code, out }));
    child.on('error', (error) => done({ code: 1, out: error.message }));
  });
}

async function shoot(page, width, height, file, cwd) {
  // An image of an earlier render never passes for this one.
  rmSync(join(cwd, file), { force: true });
  await cli(['resize', String(width), String(height)], cwd);
  const measured = Number((await cli(['eval', '() => document.documentElement.scrollHeight'], cwd)).out.match(/### Result\s+(\d+)/)?.[1]);
  const full = Number.isFinite(measured) && measured > 0 ? measured : height;
  await cli(['resize', String(width), String(Math.min(full, MAX_SIDE))], cwd);
  const shot = await cli(['screenshot', '--filename', file], cwd);
  if (!existsSync(join(cwd, file))) throw new Error(`no image for ${page}: ${shot.out.split('\n').slice(0, 3).join(' ')}`);
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
  mkdirSync(pages, { recursive: true });
  mkdirSync(join(dir, 'shots'), { recursive: true });
  const server = await serve(pages);
  const base = `http://127.0.0.1:${server.address().port}`;
  const report = [];
  try {
    for (const source of inbox.sources.filter(({ kind }) => kind === 'claude-design')) {
      const screens = source.screens ?? [];
      for (const screen of screens) {
        const id = idOf(screen);
        if (!readableArtboard(source.dir, screen.file) || codeKind(screen.code) !== 'project' || (screen.variant && !VARIANT.test(String(screen.variant)))) {
          report.push(`${id}: ${source.dir}/${screen.file} is not an artboard add wrote; inbox.yaml changed by hand? Take the artifact again with add`);
          continue;
        }
        const yours = yourShots(dir, id);
        if (yours.length > 0) {
          screen.shots = yours.map((name) => {
            copyFileSync(join(dir, name), join(dir, 'shots', name));
            report.push(`${id}: your screenshot ${describe(dir, `shots/${name}`)}`);
            return `shots/${name}`;
          });
          continue;
        }
        const { html, dynamic, problem } = stripCanvas(readFileSync(join(dir, source.dir, screen.file), 'utf8'));
        if (!html || dynamic) {
          screen.shots = [];
          report.push(`${id}: ${problem ?? 'it binds values or imports another artboard, which only Claude Design draws'}; put a screenshot of it in .ai/design-inbox/${key}/ named ${id}-desktop.png or ${id}-mobile.png, then run render again`);
          continue;
        }
        writeFileSync(join(pages, `${id}.html`), html);
        screen.shots = [];
        try {
          await cli(['open', `${base}/${id}.html`], dir);
          for (const { size, width: w, height: h, file } of shotPlan(screen, screens)) {
            const { cut, full } = await shoot(id, w, h, file, dir);
            screen.shots.push(file);
            report.push(`${id} ${size}: ${describe(dir, file)}${cut ? `; the page is ${full} px tall, cut at ${MAX_SIDE} px: put the rest in slices if ux needs it` : ''}`);
          }
        } catch (error) {
          report.push(`${id}: ${error.message}`);
        } finally {
          await cli(['close'], dir);
        }
      }
    }
  } finally {
    server.close();
    writeFileSync(join(dir, INBOX_FILE), writeInbox(inbox));
  }
  console.log([`Rendered the Designs of .ai/design-inbox/${key}/ with no script:`, ...report.map((line) => `  ${line}`)].join('\n'));
}

function check([key, ...more]) {
  const dir = inboxDir(key);
  const inbox = readInboxOf(dir);
  const links = options(more).named.link ?? [];
  if (!inbox) {
    console.log(`.ai/design-inbox/${key}/${INBOX_FILE}: none yet${links.length > 0 ? `; to take: ${links.join(', ')}` : ''}`);
    if (links.length > 0) process.exitCode = 1;
    return;
  }
  const files = new Map(walk(dir).map((path) => [path, readFileSync(join(dir, path))]));
  const lines = [`.ai/design-inbox/${key}/${INBOX_FILE}:`];
  for (const source of inbox.sources) {
    if (source.kind === 'not-design') {
      lines.push(`- no design: ${source.url} (${source.why ?? ''})`);
      continue;
    }
    lines.push(`- ${source.kind} ${source.url} version ${source.version ?? 'unknown'}: ${source.title ?? ''}`);
    for (const screen of source.screens ?? []) lines.push(`  - ${idOf(screen)} · ${screen.name}: ${screen.file}; images ${screen.shots?.length ? screen.shots.join(', ') : 'none'}`);
  }
  const problems = inboxProblems(inbox, { files, registry: registry(), links });
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
  console.log(lines.join('\n'));
}

const commands = { add, skip, render, check, codes };
if (!commands[command]) fail('usage: design-inbox.mjs add|skip|render|check|codes …');
await commands[command](rest);
