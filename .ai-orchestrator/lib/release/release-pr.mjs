// The pure parts of the last step of /ao-ship vX.Y.0 (release-workflow spec 2.7): the result of the regression report,
// and CHANGELOG.md with the section of the release.

// The line "Result: PASS" or "Result: FAIL" that qa ends the Regression Result section with; null without one.
export function regressionResult(text) {
  return /^Result:\s*(PASS|FAIL)\b/m.exec(text ?? '')?.[1] ?? null;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `current`: CHANGELOG.md, or null when there is none. The section goes under its title, before the older releases. A
// changelog that has a heading of the release already, with or without the v, gets the new section in place of the
// old one, up to the next heading of a release: devops writes the notes again when the regression ran again (T21).
export function changelogWith(current, section, version) {
  const body = `${section.trim()}\n`;
  if (current === null) return `# Changelog\n\n${body}`;
  const heading = new RegExp(`^##\\s+\\[?v?${escape(version.replace(/^v/, ''))}\\]?(?=\\s|$)`, 'm');
  const at = current.search(heading);
  if (at >= 0) {
    const next = current.slice(at + 1).search(/^##\s+\[?v?\d+\.\d+/m);
    const end = next < 0 ? current.length : at + 1 + next;
    // The blank lines that closed the old section close the new one, so the same notes give the same file.
    const trailing = /\n*$/.exec(current.slice(at, end))[0] || '\n';
    return `${current.slice(0, at)}${body.trimEnd()}${trailing}${current.slice(end)}`;
  }
  const title = /^# .*\n(\n)?/.exec(current);
  if (!title || title.index !== 0) return `${body}\n${current}`;
  return `${current.slice(0, title[0].length)}${title[1] ? '' : '\n'}${body}\n${current.slice(title[0].length)}`;
}

// The PR of the release report (Pilot 3, spec 2.9): from a branch of its own, cut from the release branch, into it. The
// rulesets let no App push to release/* any more, and merge-gate merges this PR on its own terms, so the report needs no
// review and no approval of yours. `version` is vX.Y.Z.
export function notesPullRequest(version) {
  return {
    head: `release-notes/${version}`,
    title: `release notes: ${version}`,
    body: `The regression report and the changelog of ${version}, which /ao-ship wrote from the notes of qa and devops. merge-gate merges this PR once CI is green, since it changes only docs/releases/${version}.md and CHANGELOG.md (Pilot 3, spec 2.9).`,
  };
}

// Waits for a PR to be merged: read() gives the PR as GET /pulls/{n} does, again every `every` ms, until `limit` ms have
// passed. Returns 'merged', 'closed' when it was closed without a merge, or 'waiting' when the time ran out.
export async function waitForMerge(read, { every = 20_000, limit = 15 * 60_000, now = Date.now, wait = (ms) => new Promise((done) => setTimeout(done, ms)) } = {}) {
  const end = now() + limit;
  for (;;) {
    const pr = await read();
    if (pr.merged) return 'merged';
    if (pr.state === 'closed') return 'closed';
    if (now() + every > end) return 'waiting';
    await wait(every);
  }
}
