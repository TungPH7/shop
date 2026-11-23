// Reads a design.md, the files in the design/ folder next to it and the registry of screen codes of its project, then
// checks them with lib/quality/design.mjs. Shared by scripts/check-design.mjs and the policy job (scripts/check-policy.mjs).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { checkDesign } from './design.mjs';
import { REGISTRY_FILE } from './screen-codes.mjs';

// The files of the design/ folder next to a design.md, as file name → bytes; none when the folder does not exist.
export function readDesignImages(file) {
  const dir = join(dirname(file), 'design');
  if (!existsSync(dir)) return new Map();
  const entries = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile());
  return new Map(entries.map(({ name }) => [name, readFileSync(join(dir, name))]));
}

// The registry of screen codes of the project of docs/specs/<KEY>/design.md: its text, null when the project has none,
// undefined for a design.md elsewhere, whose project is not known (tasks/todo.md item 10).
export function readScreenRegistry(file) {
  const specs = dirname(dirname(resolve(file)));
  if (basename(file) !== 'design.md' || basename(specs) !== 'specs' || basename(dirname(specs)) !== 'docs') return undefined;
  const path = join(dirname(dirname(specs)), REGISTRY_FILE);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export function checkDesignFile(file) {
  return checkDesign(readFileSync(file, 'utf8'), { images: readDesignImages(file), registry: readScreenRegistry(file) });
}
