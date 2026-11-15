// Which kit the hooks of agents load (review round 3 of shop PR #21, security): they take it from AO_KIT_DIR when set,
// else from .ai-orchestrator/ of the project. A clone at AO_KIT_DIR left behind the kit copy of the project runs an
// older gh-guard and jira-guard than the project was reviewed with. Pure, with read(path) the text of a file or null.

// The kit files the hooks load (kit/.claude/hooks/*.mjs).
export const HOOK_FILES = [
  'lib/agents/roster.mjs',
  'lib/contract.mjs',
  'lib/quality/commands.mjs',
  'lib/quality/gates.mjs',
  'lib/tracker/facts.mjs',
  'lib/tracker/guard.mjs',
  'lib/tracker/mapping.mjs',
];

// The hook files that differ between the kit at kitDir and the kit copy at copyDir. [] when they agree, or when the two
// are the same folder.
export function hookKitDrift({ kitDir, copyDir, read }) {
  const base = (dir) => dir.replaceAll('\\', '/').replace(/\/+$/, '');
  if (base(kitDir).toLowerCase() === base(copyDir).toLowerCase()) return [];
  return HOOK_FILES.filter((file) => read(`${base(kitDir)}/${file}`) !== read(`${base(copyDir)}/${file}`));
}

// The line ao-step prints when they differ, or null.
export function hookKitNote(drift, kitDir) {
  if (drift.length === 0) return null;
  return `Note: the hooks of agents load the kit in AO_KIT_DIR (${kitDir}), and ${drift.join(', ')} there differ from the kit copy of this project: bring that clone to the kit of the project (git pull), so agents run the gh-guard and jira-guard the project was reviewed with.`;
}
