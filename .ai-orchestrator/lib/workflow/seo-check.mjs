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
// environment (project.yaml). A problem names its line and, for a command, its program from the list above, never the
// words seo wrote: the reason of a STOP and the log of /ao-run reach the main session, which has Bash, before you read
// them (review of shop PR #80).
export function seoTextProblems(text, { hosts = [] } = {}) {
  const addresses = [];
  const commands = [];
  const allowed = new Set([...hosts, ...DOC_HOSTS].map((host) => String(host).toLowerCase()));
  const named = new Set();
  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const address of line.match(/https?:\/\/[^\s"'<>`)\]}]+/g) ?? []) {
      let host;
      try {
        host = new URL(address).hostname.toLowerCase();
      } catch {
        host = null;
      }
      const label = host ?? address;
      if ((host && allowed.has(host)) || named.has(label)) continue;
      named.add(label);
      addresses.push(host ? `an address outside the hosts of the apps with seo: true and schema.org, on line ${i + 1}` : `an address that cannot be read, on line ${i + 1}`);
    }
  });
  // The first word, cut at any space as COMMAND reads it (review of shop PR #81).
  const programOf = (words) => {
    const [first] = words.split(/\s/);
    return PROGRAMS.find((program) => program === first) ?? 'unknown';
  };
  let shell = false;
  lines.forEach((line, i) => {
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line);
    if (fence) {
      if (shell) shell = false;
      else if (SHELL_LANGUAGES.includes(fence[2].toLowerCase())) {
        shell = true;
        commands.push(`a shell block (${fence[2].toLowerCase()}) on line ${i + 1}`);
      }
      return;
    }
    if (shell) return;
    const start = line.replace(LINE_START, '');
    if (COMMAND.test(start)) commands.push(`a command (${programOf(start.trim())}) on line ${i + 1}`);
    for (const [, span] of line.matchAll(/`([^`]+)`/g)) if (COMMAND.test(span.trim())) commands.push(`a command (${programOf(span.trim())}) on line ${i + 1}`);
  });
  return [...new Set([...addresses, ...commands])];
}
