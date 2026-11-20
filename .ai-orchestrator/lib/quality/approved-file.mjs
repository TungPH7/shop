// The project's own settings of the quality gates, read from its .ai-orchestrator/project.yaml: the approved libraries
// for gh-guard (C1 spec section 5), and the paths it adds to a review tier for ao-step, merge-gate and audit.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { projectDependencies } from './dependencies.mjs';

const projectFile = (projectDir) => join(projectDir, '.ai-orchestrator', 'project.yaml');

// Whether the project has the file at all, without reading it: gh-guard asks on every call (review of shop PR #79).
export const hasProjectFile = (projectDir) => existsSync(projectFile(projectDir));

// The parsed project.yaml; null when the project has none, as the kit repo itself, or when it cannot be read.
export function readProjectYaml(projectDir) {
  if (!hasProjectFile(projectDir)) return null;
  try {
    return parse(readFileSync(projectFile(projectDir), 'utf8')) ?? null;
  } catch {
    return null;
  }
}

// The approved libraries. null when the project has no such file: then gh-guard checks no install. A file that cannot
// be read approves nothing.
export function readApproved(projectDir) {
  if (!hasProjectFile(projectDir)) return null;
  try {
    return projectDependencies(parse(readFileSync(projectFile(projectDir), 'utf8'))).approved;
  } catch {
    return [];
  }
}
