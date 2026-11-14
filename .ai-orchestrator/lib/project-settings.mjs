// The settings of a project that are not secret (AO_JIRA_SPACE, AO_APPROVERS, the slugs and ids of the GitHub Apps)
// live in the env block of its .claude/settings.json, where Claude Code hands them to the hooks. The scripts that run
// in CI read them here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The env block of the project's .claude/settings.json, or nothing.
export function projectSettings(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8')).env ?? {};
  } catch {
    return {};
  }
}

// An environment variable, else the project setting. A placeholder left from the kit, like <KEY>, counts as unset.
export function setting(name, settings, env = process.env) {
  const value = env[name] || settings[name];
  return value && !/^<.*>$/.test(value) ? value : undefined;
}

// The slugs and ids of the two GitHub Apps. A kit script run from a shell outside Claude Code, such as ao-pr.mjs from
// the main session, has none of them in its environment (project-scaffold part 3, spec 2.6).
export const APP_SETTINGS = ['AO_DEV_APP', 'AO_DEV_APP_ID', 'AO_REVIEW_APP', 'AO_REVIEW_APP_ID'];

// Those of APP_SETTINGS that are set, the environment first: an object to spread into the environment of a call.
export function appSettings(settings, env = process.env) {
  return Object.fromEntries(APP_SETTINGS.map((name) => [name, setting(name, settings, env)]).filter(([, value]) => value));
}
