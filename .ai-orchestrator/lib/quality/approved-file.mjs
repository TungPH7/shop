// The approved libraries of a project, read from its .ai-orchestrator/project.yaml for gh-guard (C1 spec section 5).
// null when the project has no such file, as the kit repo itself: then gh-guard checks no install. A file that cannot
// be read approves nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { projectDependencies } from './dependencies.mjs';

export function readApproved(projectDir) {
  const file = join(projectDir, '.ai-orchestrator', 'project.yaml');
  if (!existsSync(file)) return null;
  try {
    return projectDependencies(parse(readFileSync(file, 'utf8'))).approved;
  } catch {
    return [];
  }
}
