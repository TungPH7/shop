// ao-step commits for seo, which has no git (C1 spec 6.2, 6.6): after each run of seo on a branch, at /ao-spec or
// /ao-request, the change it left, when every path it changed is under docs/specs/. Pure: scripts/ao-step.mjs runs git.

const BASES = ['develop', 'main'];

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
// path is outside docs/specs/, or the branch is a base branch, where nothing is committed; else { paths, message } to
// commit.
export function seoChange({ status, branch, key }) {
  const paths = changedPaths(status);
  if (paths.length === 0) return null;
  const outside = paths.filter((path) => !path.startsWith('docs/specs/'));
  if (outside.length > 0) return { stop: `seo changed ${outside.join(', ')}, outside docs/specs/: ao-step committed nothing. Look at the change on ${branch}, keep or drop it yourself, then run the command again` };
  if (!branch || BASES.includes(branch) || branch.startsWith('release/')) return { stop: `seo changed ${paths.join(', ')} on ${branch || 'a detached HEAD'}, a base branch: ao-step committed nothing. Move the change to the branch of ${key}, or drop it` };
  return { paths, message: `docs(spec): SEO of the SPEC, by seo (${key})` };
}
