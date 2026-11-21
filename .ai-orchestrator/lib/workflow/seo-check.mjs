// A check that needs no model, for what seo writes (second review of shop PR #79): seo reads web pages, which can carry
// orders, and the section ## SEO of a SPEC and its comment on an item outside an Epic reach the dev agents, who build
// them word for word. The check names what has no place there: an address outside the hosts of the apps with seo: true
// and schema.org, and a command. ao-step shows what it finds where you read seo's text: at gate ①, and where /ao-build
// waits for your seo-ok. Pure.

// The hosts structured data and the SEO of the apps name besides their own.
const DOC_HOSTS = ['schema.org', 'www.schema.org'];
const SHELL_LANGUAGES = ['bash', 'sh', 'shell', 'zsh', 'console', 'terminal', 'powershell', 'pwsh', 'ps1', 'ps', 'cmd', 'bat', 'batch'];
// Programs that run something, as the first word of a line or of a code span. Lower case, as a shell takes them; the
// copy of a page does not start a line so.
const PROGRAMS = [
  'npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'bun', 'bunx', 'corepack', 'node', 'deno',
  'curl', 'wget', 'git', 'gh', 'ssh', 'scp', 'nc', 'ncat',
  'bash', 'sh', 'zsh', 'cmd', 'powershell', 'pwsh', 'iwr', 'irm', 'Invoke-WebRequest', 'Invoke-RestMethod', 'Start-Process',
  'mvn', 'mvnw', './mvnw', 'gradle', './gradlew', 'docker',
  'rm', 'cp', 'mv', 'chmod', 'chown', 'sudo', 'echo', 'eval', 'source', 'export', 'base64', 'certutil',
  'python', 'python3', 'pip', 'pip3',
];
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMMAND = new RegExp(`^(?:${PROGRAMS.map(escape).join('|')})(?:\\s|$)`);
const LINE_START = /^\s*(?:[-*+]\s+|\d+\.\s+)?(?:\$|>|PS>)?\s*/;

// The section ## SEO of a SPEC, up to the next heading of its level or above, or ''.
export function seoSection(spec) {
  const text = String(spec ?? '');
  const start = text.search(/^##\s+SEO\s*$/m);
  if (start < 0) return '';
  const rest = text.slice(start);
  const body = rest.indexOf('\n') + 1;
  if (body === 0) return rest;
  const next = rest.slice(body).search(/^#{1,2}\s/m);
  return next < 0 ? rest : rest.slice(0, body + next).replace(/\n+$/, '\n');
}

// What has no place in seo's text: [problem], [] when nothing. hosts: those of the apps with seo: true, in every
// environment (project.yaml).
export function seoTextProblems(text, { hosts = [] } = {}) {
  const problems = [];
  const allowed = new Set([...hosts, ...DOC_HOSTS].map((host) => String(host).toLowerCase()));
  const named = new Set();
  for (const address of String(text ?? '').match(/https?:\/\/[^\s"'<>`)\]}]+/g) ?? []) {
    let host;
    try {
      host = new URL(address).hostname.toLowerCase();
    } catch {
      host = null;
    }
    const label = host ?? address;
    if ((host && allowed.has(host)) || named.has(label)) continue;
    named.add(label);
    problems.push(host ? `an address on ${host}, which is no host of an app with seo: true nor schema.org` : `an address that cannot be read: ${address}`);
  }
  let shell = false;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line);
    if (fence) {
      if (shell) shell = false;
      else if (SHELL_LANGUAGES.includes(fence[2].toLowerCase())) {
        shell = true;
        problems.push(`a shell block (${fence[1]}${fence[2]})`);
      }
      continue;
    }
    if (shell) continue;
    const start = line.replace(LINE_START, '');
    if (COMMAND.test(start)) problems.push(`a command: ${start.trim()}`);
    for (const [, span] of line.matchAll(/`([^`]+)`/g)) if (COMMAND.test(span.trim())) problems.push(`a command: ${span.trim()}`);
  }
  return [...new Set(problems)];
}
