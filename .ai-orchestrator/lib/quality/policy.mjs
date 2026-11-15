// The conventions and dependency steps of the policy job (quality-gates spec section 2.4). Pure: scripts/check-policy.mjs
// reads git, the PR event and npm audit.
import { checkBranch, checkPrTitle, parseBranch } from '../tracker/conventions.mjs';
import { checkCommitMessage } from './git-hooks.mjs';
import { LEVELS } from './suppressions.mjs';

const BACK_MERGE_BASE = /^(develop|release\/v\d+\.\d+\.\d+)$/;
const TAG = 'v<major>.<minor>.<patch>';

// The PRs of a release (release-workflow spec 2.7): release/vX.Y.Z into main, which ao-step opens as "release: vX.Y.Z",
// and the merge of main back into develop or a release branch, which merge-gate opens as "Merge main into <base> after
// <tag>". Their commits passed the gates of their own PRs, and audit checks the bot's report commit, so only the title
// is checked. null for any other PR.
function releaseFlowProblems({ branch, base, title }) {
  const release = parseBranch(branch);
  if (release?.kind === 'release' && base === 'main') {
    const expected = `release: v${release.version}`;
    return title === expected ? [] : [`title "${title}": the PR of ${branch} into main is titled "${expected}"`];
  }
  if (branch === 'main' && BACK_MERGE_BASE.test(base)) {
    const ok = new RegExp(`^Merge main into ${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} after v\\d+\\.\\d+\\.\\d+$`).test(title);
    return ok ? [] : [`title "${title}": the merge back of main into ${base} is titled "Merge main into ${base} after ${TAG}"`];
  }
  // The release report of /ao-ship (Pilot 3, spec 2.9): release-notes/vX.Y.Z into release/vX.Y.Z, which merge-gate merges
  // when it changes only the report and the changelog of that version.
  const notes = branch.match(/^release-notes\/v(\d+\.\d+\.\d+)$/)?.[1];
  if (notes && base === `release/v${notes}`) {
    const expected = `release notes: v${notes}`;
    return title === expected ? [] : [`title "${title}": the PR of ${branch} into ${base} is titled "${expected}"`];
  }
  return null;
}

// commits: [{ sha, parents, subject }] of the PR. Merge commits are left out: git writes them when a branch is updated.
export function checkConventions({ branch, base, commits, title }) {
  const release = releaseFlowProblems({ branch, base, title });
  if (release) return release;
  const problems = [];
  const branchCheck = checkBranch(branch, { base });
  if (!branchCheck.ok) problems.push(`branch ${branch}: ${branchCheck.reason}`);
  for (const { sha, parents, subject } of commits.filter((c) => c.parents < 2)) {
    const result = checkCommitMessage(subject);
    if (!result.ok) problems.push(`commit ${sha} "${subject}": ${result.reason}`);
  }
  const titleCheck = checkPrTitle(title);
  if (!titleCheck.ok) problems.push(`title "${title}": ${titleCheck.reason}`);
  return problems;
}

// The design.md files the policy job checks (agent-roster spec 2.8): each docs/specs/<EPIC-KEY>/design.md the PR adds or
// changes, and the one next to a design/ folder where the PR adds, changes or deletes an image, when it still exists.
// changes: [{ status, path }] from `git diff --name-status --no-renames`; exists tells whether a path is in the PR head.
export function designFilesToCheck(changes, exists) {
  const files = new Set();
  for (const { status, path } of changes) {
    if (/^docs\/specs\/[^/]+\/design\.md$/.test(path) && status !== 'D') files.add(path);
    const folder = path.match(/^(docs\/specs\/[^/]+)\/design\/.+$/)?.[1];
    if (folder && exists(`${folder}/design.md`)) files.add(`${folder}/design.md`);
  }
  return [...files];
}

// The level of a CVSS base score, as npm audit names levels. An advisory OSV has no score for yet counts as high, so it
// fails until someone reads it and adds an exception.
const levelOf = (score) => (Number.isNaN(score) ? 'high' : score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'moderate' : 'low');

// report: the JSON of `osv-scanner scan source --format json` on the pom.xml of a Java app (project-scaffold part 3,
// spec 2.3). Each group of advisories counts once per package, at its highest score. An exception names the GHSA id or
// any alias of the group, such as its CVE.
export function osvProblems(report, { audit_level: level, exceptions }, today) {
  const problems = [];
  for (const { package: pkg, groups = [], vulnerabilities = [] } of (report.results ?? []).flatMap((result) => result.packages ?? [])) {
    for (const group of groups) {
      const score = group.max_severity === '' || group.max_severity == null ? Number.NaN : Number(group.max_severity);
      const severity = levelOf(score);
      if (LEVELS.indexOf(severity) < LEVELS.indexOf(level)) continue;
      const names = [...group.ids, ...(group.aliases ?? [])];
      const exception = exceptions.find(({ advisory }) => names.includes(advisory));
      if (exception && exception.expires >= today) continue;
      const summary = vulnerabilities.find(({ id }) => id === group.ids[0])?.summary ?? 'no summary';
      const scored = Number.isNaN(score) ? `${severity}, not scored` : `${severity} ${group.max_severity}`;
      problems.push(`${pkg.name}@${pkg.version} ${scored}: ${summary} (${group.ids.join(', ')})${exception ? `; its exception expired on ${exception.expires}` : ''}`);
    }
  }
  return problems;
}

// report: the JSON of `npm audit --json`, or of `pnpm audit --json` (project-scaffold part 2, spec 2.1). Each advisory
// counts once, however many packages pull it in. npm lists advisories under the packages they touch, and packages that
// are only vulnerable through another one name it instead of an advisory; pnpm lists them by id under `advisories`.
export function auditProblems(report, { audit_level: level, exceptions }, today) {
  const advisories = new Map();
  if (report.advisories) {
    for (const { module_name: name, severity, title, url } of Object.values(report.advisories)) advisories.set(url, { name, severity, title, url });
  }
  for (const { via = [] } of Object.values(report.vulnerabilities ?? {})) {
    for (const item of via.filter((v) => typeof v === 'object')) advisories.set(item.url, item);
  }
  const problems = [];
  for (const { name, severity, title, url } of advisories.values()) {
    if (LEVELS.indexOf(severity) < LEVELS.indexOf(level)) continue;
    const id = url.split('/').at(-1);
    const exception = exceptions.find(({ advisory }) => advisory === id);
    if (exception && exception.expires >= today) continue;
    problems.push(`${name} ${severity}: ${title} (${id})${exception ? `; its exception expired on ${exception.expires}` : ''}`);
  }
  return problems;
}
