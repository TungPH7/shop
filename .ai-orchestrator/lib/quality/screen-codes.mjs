// Screen codes of a project (Phiên 35 · Lượt 84–85, tasks/todo.md item 10): <APP>-<AREA><NN>, such as USR-CART01, unique
// in the whole project, each listed in the registry docs/design-system/screens.md with its name, app and route. A
// design.md written before them keeps the codes of its Epic, S1, S2…; one file uses one kind. Pure: the callers read
// the files.

// A project code: a prefix of 3 capitals for the app, a hyphen, an area of 2 to 4 capitals, two digits. No hyphen
// before the digits, so a code never reads as a Jira key such as SHOP-95; capitals only, since Windows file names and
// Mermaid's keyword `end` care about case; no dot, which starts a block code (USR-CART01.4).
export const PROJECT_CODE = '[A-Z]{3}-[A-Z]{2,4}\\d{2}';
// The code of a screen in a design.md of one Epic, before project codes.
export const EPIC_CODE = 'S\\d+';
// Either kind, for patterns that look for a code in text: the project kind first, so S in USR is never taken alone.
export const ANY_CODE = `(?:${PROJECT_CODE}|${EPIC_CODE})`;

const PROJECT = new RegExp(`^${PROJECT_CODE}$`);
const EPIC = new RegExp(`^${EPIC_CODE}$`);
const PARTS = /^([A-Z]{3})-([A-Z]{2,4})(\d{2})$/;
export const REGISTRY_FILE = 'docs/design-system/screens.md';
const STATES = ['dùng', 'bỏ'];

// 'project', 'epic' or null.
export function codeKind(code) {
  if (PROJECT.test(code ?? '')) return 'project';
  if (EPIC.test(code ?? '')) return 'epic';
  return null;
}

// { prefix, area, number } of a project code, or null.
export function codeParts(code) {
  const found = PARTS.exec(code ?? '');
  return found ? { prefix: found[1], area: found[2], number: Number(found[3]) } : null;
}

const clean = (cell) => (cell ?? '').replace(/`/g, '').trim();

// The lines of a file with what an HTML comment or a fenced block holds blanked out, so a table there is no table.
function visible(lines) {
  let comment = false;
  let fence = null;
  return lines.map((raw) => {
    if (fence) {
      if (raw.trim().startsWith(fence)) fence = null;
      return '';
    }
    const opens = raw.match(/^\s*(`{3,}|~{3,})/);
    if (!comment && opens) {
      fence = opens[1];
      return '';
    }
    let line = raw;
    if (comment) {
      if (!line.includes('-->')) return '';
      line = line.slice(line.indexOf('-->') + 3);
      comment = false;
    }
    line = line.replace(/<!--.*?-->/g, '');
    if (line.includes('<!--')) {
      line = line.slice(0, line.indexOf('<!--'));
      comment = true;
    }
    return line;
  });
}

// The cells of a table row; "\|" is a bar inside a cell.
const cellsOf = (line) => line.trim().slice(1, -1).split(/(?<!\\)\|/).map((cell) => clean(cell.replace(/\\\|/g, '|')));

// The rows of the first table under the heading `## <title>`: { header, rows: [{ cells, line }] }, or null.
function tableUnder(lines, title) {
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${title.toLowerCase()}`);
  if (start < 0) return null;
  const rows = [];
  let header = null;
  for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i += 1) {
    const line = lines[i];
    if (!/^\|.*\|\s*$/.test(line)) {
      if (header && rows.length > 0 && line.trim() !== '') break;
      continue;
    }
    const cells = cellsOf(line);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (!header) header = { cells: cells.map((cell) => cell.toLowerCase()), line: i + 1 };
    else rows.push({ cells, line: i + 1 });
  }
  return header ? { header, rows } : null;
}

const COLUMNS = {
  apps: ['prefix', 'app'],
  areas: ['area', 'meaning'],
  screens: ['code', 'name', 'app', 'route', 'epic', 'state'],
};

// Reads the registry: { apps: [{ prefix, app, line }], areas: [{ area, meaning, line }], screens: [{ code, name, app,
// route, epic, state, line }], errors }. Errors are { rule, line, message }, line 1-based in the registry.
export function readRegistry(text) {
  const lines = visible(String(text ?? '').replace(/\r\n?/g, '\n').split('\n'));
  const errors = [];
  const error = (rule, line, message) => errors.push({ rule, line, message });
  const read = (title, key) => {
    const table = tableUnder(lines, title);
    const wanted = COLUMNS[key];
    if (!table) {
      error('R1', 1, `the registry has no table under "## ${title}" with the columns ${wanted.join(', ')}`);
      return [];
    }
    const at = wanted.map((name) => table.header.cells.indexOf(name));
    if (at.some((index) => index < 0)) {
      error('R1', table.header.line, `the table "${title}" needs the columns ${wanted.join(', ')}`);
      return [];
    }
    return table.rows.map(({ cells, line }) => ({ ...Object.fromEntries(wanted.map((name, i) => [name, cells[at[i]] ?? ''])), line }));
  };
  const apps = read('Apps', 'apps');
  const areas = read('Areas', 'areas');
  const screens = read('Screens', 'screens');
  return { apps, areas, screens, errors };
}

// Every rule of the registry: R1 its tables, R2 the prefixes, R3 the areas, R4 the codes, R5 a code twice, R6 a code
// whose prefix or area is not declared, or whose app is not its prefix's, R7 the state.
export function checkRegistry(registry) {
  const errors = [...registry.errors];
  const error = (rule, line, message) => errors.push({ rule, line, message });
  const prefixes = new Map();
  for (const { prefix, app, line } of registry.apps) {
    if (!/^[A-Z]{3}$/.test(prefix)) error('R2', line, `the prefix '${prefix}' must be 3 capitals, such as USR`);
    else if (prefixes.has(prefix)) error('R2', line, `the prefix ${prefix} is listed twice`);
    if (!app) error('R2', line, `the prefix ${prefix} names no app`);
    else if ([...prefixes.values()].includes(app)) error('R2', line, `the app ${app} has two prefixes`);
    prefixes.set(prefix, app);
  }
  const areas = new Set();
  for (const { area, line } of registry.areas) {
    if (!/^[A-Z]{2,4}$/.test(area)) error('R3', line, `the area '${area}' must be 2 to 4 capitals, such as CART`);
    else if (areas.has(area)) error('R3', line, `the area ${area} is listed twice`);
    areas.add(area);
  }
  const seen = new Set();
  for (const { code, app, state, line } of registry.screens) {
    const parts = codeParts(code);
    if (!parts) {
      error('R4', line, `'${code}' is not a screen code such as USR-CART01: a prefix of 3 capitals, a hyphen, an area of 2 to 4 capitals and two digits`);
      continue;
    }
    if (seen.has(code)) error('R5', line, `${code} is listed twice: a code names one screen only`);
    seen.add(code);
    if (!prefixes.has(parts.prefix)) error('R6', line, `the prefix ${parts.prefix} of ${code} is not in the table Apps`);
    else if (prefixes.get(parts.prefix) !== app) error('R6', line, `${code} is a screen of ${prefixes.get(parts.prefix)} by its prefix, but its App is '${app}'`);
    if (!areas.has(parts.area)) error('R6', line, `the area ${parts.area} of ${code} is not in the table Areas`);
    if (!STATES.includes(state)) error('R7', line, `the State of ${code} is '${state}': write ${STATES.join(' or ')}`);
  }
  return errors.sort((a, b) => a.line - b.line);
}

// The next free code of a prefix and an area: one past the highest number given, retired ones included, since a
// number is never given twice. Null when the area is full (99).
export function nextCode(registry, prefix, area) {
  const used = registry.screens.map(({ code }) => codeParts(code)).filter((parts) => parts?.prefix === prefix && parts.area === area);
  const next = Math.max(0, ...used.map(({ number }) => number)) + 1;
  return next > 99 ? null : `${prefix}-${area}${String(next).padStart(2, '0')}`;
}
