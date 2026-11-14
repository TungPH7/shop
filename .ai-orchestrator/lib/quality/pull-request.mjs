// Checks of the PR artifacts (quality-gates spec sections 2.2 and 2.5): the title and description of a PR against
// templates/pull-request.md, and a review report (its head and its findings) against templates/review-report.md. Pure.
// A project's kit copy has no templates folder, so the sections, placeholders and severities are listed here; tests
// keep them equal to the templates.
import { createHash } from 'node:crypto';
import { checkPrTitle } from '../tracker/conventions.mjs';
import { lastDecision } from '../tracker/facts.mjs';

export const PR_SECTIONS = ['Jira', 'What Changed', 'How It Was Tested', 'Acceptance Criteria Coverage', 'Risks', 'Definition of Done'];
export const PLACEHOLDERS = ['<type(scope): subject>', '<KEY>', '<Given … When … Then …>', '<test file › test name>'];

// The level-2 sections of a Markdown text, without guidance comments: { name: content }.
function sections(markdown) {
  const text = markdown.replace(/<!--[\s\S]*?-->/g, '');
  const found = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^## (.+?)\s*$/);
    if (heading) {
      current = heading[1];
      found[current] = '';
    } else if (current) found[current] += `${line}\n`;
  }
  return { text, found };
}

export function checkPullRequest({ title, body }) {
  const problems = [...checkTitle(title), ...checkDescription(body)];
  return { ok: problems.length === 0, problems };
}

export function checkTitle(title) {
  const result = checkPrTitle(title ?? '');
  return result.ok ? [] : [`title: ${result.reason}`];
}

export function checkDescription(body) {
  const problems = [];
  const { text, found } = sections(body ?? '');
  for (const name of PR_SECTIONS) {
    if (!(name in found)) problems.push(`${name}: the section is missing`);
    else if (found[name].trim() === '') problems.push(`${name}: the section is empty`);
  }
  for (const placeholder of PLACEHOLDERS.filter((p) => text.includes(p))) problems.push(`placeholder: ${placeholder} is still in the description`);
  if ('Example' in found) problems.push('Example: delete the Example section of the template');
  return problems;
}

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
// Findings that block the merge (templates/review-report.md).
const BLOCKING = ['Critical', 'High'];
const FINDING_COLUMNS = ['severity', 'axis', 'where', 'finding', 'fix'];
const EARLIER_COLUMNS = ['severity', 'where', 'finding', 'status'];
// An earlier finding is Fixed alone or with a colon and how. "Fixed một phần" is not (Pilot 1, third review of ao-sample
// PR #13): any other Status keeps it open.
const FIXED = /^fixed\s*(:|$)/i;

// A review report as merge-gate reads it: the role of its Role line, the rows of its Findings table, and those that
// block the merge. Text that is not a report has no role; a report merge-gate cannot read lists problems.
export function readReviewReport(body, roles) {
  const header = checkReviewHeader(body, roles);
  if (!header.ok) return { ok: false, problems: header.problems };
  const { text, found } = sections(body);
  if (!('Findings' in found)) return { ok: false, role: header.role, problems: ['the report needs a "## Findings" section'] };
  const findings = [];
  const problems = [];
  const read = (section, columns, name) => tableRows(section).flatMap((cells, index) => {
    const severity = SEVERITIES.find((s) => s.toLowerCase() === cells[0].replace(/[*_`]/g, '').trim().toLowerCase());
    if (severity) return [Object.fromEntries(columns.map((column, i) => [column, i === 0 ? severity : cells[i]]))];
    problems.push(`${name} ${index + 1}: severity '${cells[0]}' is not Critical, High, Medium or Low`);
    return [];
  });
  findings.push(...read(found.Findings, FINDING_COLUMNS, 'finding'));
  // A security review of the new part only says from which commit (dev-workflow spec 2.6). A full review judges anew and
  // clears what was open, so a Scope line a little off, or Earlier findings without one, is no full review: unreadable.
  // The Scope line counts only above the first section, under the Role line, where the template puts it.
  const head = text.split(/^## /m)[0];
  const since = head.match(/^Scope:\s*changes since\s+([0-9a-f]{7,40})\s*$/m)?.[1];
  if (!since && /^[^a-z0-9\n]*scope\b/im.test(head)) problems.push('Scope: the line must read "Scope: changes since <short SHA>"');
  if (!since && 'Earlier findings' in found) problems.push('Earlier findings: only a report of the new part has them, under its Scope line');
  // ... and lists the Critical and High findings left open before it, each Fixed or Open.
  const earlier = 'Earlier findings' in found ? read(found['Earlier findings'], EARLIER_COLUMNS, 'earlier finding') : [];
  const stillOpen = since ? earlier.filter(({ severity, status }) => BLOCKING.includes(severity) && !FIXED.test(status ?? '')) : [];
  const blocking = [...findings.filter(({ severity }) => BLOCKING.includes(severity)), ...stillOpen];
  return { ok: problems.length === 0, role: header.role, findings, blocking, problems, ...(since && { scope: { since } }), ...(earlier.length > 0 && { earlier }) };
}

// The rows of a Markdown table as cells, without its header and separator rows.
const tableRows = (section) => section.split('\n')
  .filter((line) => line.trim().startsWith('|'))
  .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
  .filter((cells) => cells[0].toLowerCase() !== 'severity' && !cells.every((cell) => /^:?-+:?$/.test(cell)));

// What makes a finding the same one from report to report: its Where and Finding, whatever their case, spaces and
// Markdown. The prompt of the next review gives them on one line, with / for | (lib/workflow/prompts.mjs).
const identity = ({ where, finding }) => `${where} ${finding}`.replace(/[*_`]/g, '').replaceAll('|', '/').replace(/\s+/g, ' ').trim().toLowerCase();

// The Critical and High findings open after each report of one role, oldest first (dev-workflow spec 2.6; Pilot 1,
// second and third review of ao-sample PR #13). A full report has its own. A report of the new part has its own, the
// earlier ones it lists as Open, and those of the report before it that no row of its names: an agent that leaves one
// out, or rewords it, does not clear it. An unreadable report clears nothing. reports: readReviewReport results.
export function openFindings(reports) {
  let open = [];
  return reports.map((report) => {
    if (!report.ok) return open;
    const listed = new Set((report.earlier ?? []).filter(({ severity }) => BLOCKING.includes(severity)).map(identity));
    open = [...report.blocking, ...(report.scope ? open.filter((finding) => !listed.has(identity(finding))) : [])];
    return open;
  });
}

export const openCounts = (reports) => openFindings(reports).map((open) => open.length);

// The id of a finding (Pilot 3, spec 2.9 part 5): 8 hex digits of the hash of its identity, so a finding keeps its id
// from report to report as long as openFindings takes it for the same one. You name a finding by it to accept it. It
// is a name, not a secret: whoever writes the reports could as well leave a finding out, and an acceptance holds only
// on the head you approved.
export const findingId = (finding) => createHash('sha256').update(identity(finding)).digest('hex').slice(0, 8);

// How long a risk may stay accepted: at most this many days after the approval that accepts it.
export const ACCEPT_MAX_DAYS = 90;
// A line that starts with "Accept risk", alone or as an item of a list.
const ACCEPT_START = /^\s*(?:[-*]\s+)?accept risk\b/i;
const ACCEPT_LINE = /^\s*(?:[-*]\s+)?accept risk:\s*(\S+)\s+until\s+(\S+?)\s*:(.*)$/i;
const FINDING_ID = /^[0-9a-f]{8}$/;

// A day written YYYY-MM-DD as a number of days, or NaN when it is not a real day, such as 2026-02-30.
function dayNumber(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? '')) return Number.NaN;
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== text ? Number.NaN : time / 86400000;
}

// The High findings you accept (Pilot 3, spec 2.9 part 5): the lines "Accept risk: <id> until <YYYY-MM-DD>: <why>" of
// your latest deciding review, when it approves the `head` commit. A push after it needs a new approval, and so a new
// acceptance. The last day must not be before `on`, the day it must hold (today for merge-gate and ao-step, the day of
// the merge for audit), nor more than ACCEPT_MAX_DAYS after the approval. Returns { accepted: Map(id → { until,
// reason, by }), problems }, problems saying why a line accepts nothing. Pure.
export function acceptedRisks(reviews, { approvers, head, on }) {
  if (Number.isNaN(dayNumber(on))) throw new Error(`acceptedRisks needs the day it must hold as YYYY-MM-DD, not ${on}`);
  const accepted = new Map();
  const problems = [];
  for (const login of approvers) {
    const last = lastDecision(reviews, login);
    if (last?.state !== 'APPROVED' || last.commit_id !== head) continue;
    const approvedOn = String(last.submitted_at ?? '').slice(0, 10);
    for (const text of (last.body ?? '').split(/\r?\n/).filter((line) => ACCEPT_START.test(line))) {
      const match = text.match(ACCEPT_LINE);
      if (!match) {
        problems.push(`"${text.trim()}" of ${login}: write it as "Accept risk: <id> until <YYYY-MM-DD>: <why>"`);
        continue;
      }
      const [, written, until, why] = match;
      const id = written.toLowerCase();
      const reason = why.trim();
      const day = dayNumber(until);
      let problem;
      if (!FINDING_ID.test(id)) problem = `${written} is not the id of a finding (8 hex digits)`;
      else if (Number.isNaN(day)) problem = `${until} is not a day (YYYY-MM-DD)`;
      else if (day < dayNumber(on)) problem = `until ${until}, before ${on}`;
      else if (Number.isNaN(dayNumber(approvedOn)) || day - dayNumber(approvedOn) > ACCEPT_MAX_DAYS) problem = `until ${until}, more than ${ACCEPT_MAX_DAYS} days after the approval of ${approvedOn || 'an unknown day'}`;
      else if (!reason) problem = 'it needs a reason after the colon';
      if (problem) problems.push(`Accept risk: ${written} of ${login}: ${problem}`);
      else accepted.set(id, { until, reason, by: login });
    }
  }
  return { accepted, problems };
}

// The open findings that still block: a High you accept no longer does; a Critical always does.
export const stillBlocking = (open, accepted) => open.filter((finding) => !(finding.severity === 'High' && accepted.has(findingId(finding))));

// The first heading and the Role line that tell merge-gate which role wrote a review report.
export function checkReviewHeader(body, roles) {
  const problems = [];
  const lines = (body ?? '').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (!/^# Review: .+\(\S+\)\s*$/.test(lines[0] ?? '')) problems.push('the report must start with "# Review: <PR title> (<KEY>)"');
  const role = lines.find((line) => /^Role:/.test(line))?.replace(/^Role:\s*/, '').trim();
  if (!roles.includes(role)) problems.push(`the report needs a line ${roles.map((r) => `"Role: ${r}"`).join(' or ')}`);
  return { ok: problems.length === 0, role: problems.length === 0 ? role : undefined, problems };
}
