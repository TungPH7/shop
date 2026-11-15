// Which kit the hooks of agents load (review round 3 of shop PR #21, security): they take it from AO_KIT_DIR when set,
// else from .ai-orchestrator/ of the project. A clone at AO_KIT_DIR left behind the kit copy of the project runs an
// older gh-guard and jira-guard than the project was reviewed with. Pure, with read(path) the text of a file or null,
// and list(dir) the paths of the files under a folder, relative to it.

// The folders of the kit that decide what an agent may do and with which token: the modules the hooks load and import
// (lib), the scripts that start agents and give them tokens (ao-agent.mjs, ao-git-credential.mjs), the roster, the
// gates, the contract and the Jira mapping. Round 4 of the review: a list of 7 files missed the rest.
export const HOOK_FOLDERS = ['lib', 'scripts', 'agents', 'quality', 'contract', 'tracker'];

// The files of HOOK_FOLDERS in the kit copy at copyDir that differ in the kit at kitDir, or are missing there, with
// forward slashes. Files of the kit that the copy does not hold play no part in the project. [] when they agree, or when
// the two are the same folder.
export function hookKitDrift({ kitDir, copyDir, read, list }) {
  const base = (dir) => dir.replaceAll('\\', '/').replace(/\/+$/, '');
  if (base(kitDir).toLowerCase() === base(copyDir).toLowerCase()) return [];
  const files = HOOK_FOLDERS.flatMap((folder) => list(`${base(copyDir)}/${folder}`).map((path) => `${folder}/${path.replaceAll('\\', '/')}`)).sort();
  return files.filter((file) => read(`${base(kitDir)}/${file}`) !== read(`${base(copyDir)}/${file}`));
}

// The line ao-step prints when they differ, or null: the first three files and how many more.
export function hookKitNote(drift, kitDir) {
  if (drift.length === 0) return null;
  const named = drift.slice(0, 3).join(', ') + (drift.length > 3 ? ` and ${drift.length - 3} more` : '');
  return `Note: the hooks of agents load the kit in AO_KIT_DIR (${kitDir}), and ${drift.length} of its files differ from the kit copy of this project (${named}): bring that clone to the kit of the project (git pull), so agents run the gh-guard and jira-guard the project was reviewed with.`;
}
