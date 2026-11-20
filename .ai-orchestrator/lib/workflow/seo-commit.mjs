// ao-step commits for seo, which has no git (C1 spec 6.2, 6.6): after each run of seo on a branch, at /ao-spec or
// /ao-request, the change it left, when every path it changed is the SPEC of an Epic. Pure: scripts/ao-step.mjs runs git.

const BASES = ['develop', 'main'];

// The one file seo writes in the repo: the SPEC of an Epic, whose section ## SEO is its. seo reads web pages, which can
// carry orders, so anything else, such as a CLAUDE.md next to the SPEC that the dev agents would load as instructions,
// is never committed for it (review of shop PR #79). The case is git's, as the file is in the repo.
const SPEC = /^docs\/specs\/([^/]+)\/spec\.md$/;

// The paths of `git status --porcelain=v1 -z --untracked-files=all`: each entry is "XY path", and a rename or a copy
// is followed by the path it came from, which counts as changed too.
export function changedPaths(status) {
  const entries = String(status ?? '').split('\0');
  const paths = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    if (/^[RC]/.test(entry)) {
      i += 1;
      if (entries[i]) paths.push(entries[i]);
    }
  }
  return [...new Set(paths)];
}

// What ao-step does with the change of a seo run on `branch`, for item `key`: null when it left none; { stop } when a
// path is no SPEC, or the branch is a base branch, where nothing is committed; else { paths, message } to commit.
// docsEpic: the Epic whose docs branch `branch` is, or null. Its docs PR merges without review once you approved the
// SPEC at the gate, so there seo changes only the SPEC of that Epic; on the branch of a Story, the SPEC of its Epic goes
// into a PR that is reviewed.
export function seoChange({ status, branch, key, docsEpic = null }) {
  const paths = changedPaths(status);
  if (paths.length === 0) return null;
  const again = `Look at the change on ${branch || 'the checkout'}, keep or drop it yourself, then run the command again`;
  const odd = paths.filter((path) => !SPEC.test(path));
  if (odd.length > 0) return { stop: `seo changed ${odd.join(', ')}, which is no SPEC (docs/specs/<EPIC>/spec.md): ao-step committed nothing. ${again}` };
  const other = docsEpic ? paths.filter((path) => SPEC.exec(path)[1] !== docsEpic) : [];
  if (other.length > 0) return { stop: `seo changed ${other.join(', ')}, which is not the SPEC of ${docsEpic} on its docs branch: ao-step committed nothing. ${again}` };
  if (!branch || BASES.includes(branch) || branch.startsWith('release/')) return { stop: `seo changed ${paths.join(', ')} on ${branch || 'a detached HEAD'}, a base branch: ao-step committed nothing. Move the change to the branch of ${key}, or drop it` };
  return { paths, message: `docs(spec): SEO of the SPEC, by seo (${key})` };
}
