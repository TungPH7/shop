// dep-check (C1 spec section 5): checks one version of a library before it is installed, and when it passes, adds it to
// dependencies.approved of the project's .ai-orchestrator/project.yaml, with `by: dep-check`. Commit that line with the
// change that installs the library: the policy job and gh-guard read it.
//
//   node .ai-orchestrator/scripts/dep-check.mjs <npm|maven> <name>@<version>   zod@4.1.0, org.mapstruct:mapstruct@1.6.3
//
// Checks: known vulnerabilities (OSV), the license against dependencies.licenses of quality/gates.yaml, the age (at
// least 14 days), the downloads of last week and the maintainers (npm), the scripts it runs at install (npm), npm
// provenance. A check that cannot be read, such as a registry that does not answer, makes the verdict suspicious, never
// a pass. Exit 0 when it passes, 2 when it is suspicious: then nothing is written, and the dev agent asks security on
// the item with a comment "Cần security:" naming the library.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addApproved, newestStable, npmFacts, osvIds, parseSpec, pomLicenses, pomParent } from '../lib/quality/dep-check.mjs';
import { depVerdict, ECOSYSTEMS } from '../lib/quality/dependencies.mjs';
import { readGates } from '../lib/quality/gates.mjs';

const TIMEOUT = 15000;
const getJson = async (url, init = {}) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
};
const getText = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
};
const osv = (ecosystem, name, version) => getJson('https://api.osv.dev/v1/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version, package: { name, ecosystem: ecosystem === 'npm' ? 'npm' : 'Maven' } }) });

async function npmLibrary(name, version) {
  const doc = await getJson(`https://registry.npmjs.org/${name.replace('/', '%2f')}`);
  const facts = npmFacts(doc, version);
  if (facts.errors.length > 0) return facts;
  const errors = [];
  try {
    facts.downloads = (await getJson(`https://api.npmjs.org/downloads/point/last-week/${name}`)).downloads ?? null;
  } catch {
    errors.push('the downloads of last week');
  }
  try {
    facts.vulnerabilities = osvIds(await osv('npm', name, facts.version));
  } catch {
    errors.push('the vulnerabilities on OSV');
  }
  return { ...facts, errors };
}

async function mavenLibrary(name, version) {
  const [group, artifact] = name.split(':');
  const errors = [];
  const pomUrl = (g, a, v) => `https://repo1.maven.org/maven2/${g.replaceAll('.', '/')}/${a}/${v}/${a}-${v}.pom`;
  // repo1.maven.org itself, not the search of search.maven.org, which often does not answer.
  let chosen = version;
  if (!chosen) {
    try {
      chosen = newestStable(await getText(`https://repo1.maven.org/maven2/${group.replaceAll('.', '/')}/${artifact}/maven-metadata.xml`));
    } catch {
      chosen = null;
    }
    if (!chosen) return { version: null, errors: ['the latest version on Maven Central: give one'] };
  }
  const facts = { version: chosen, downloads: null, maintainers: null, installScripts: [], provenance: null };
  try {
    let pom = await getText(pomUrl(group, artifact, chosen));
    let licenses = pomLicenses(pom);
    // The license is often in a parent POM: up to two of them.
    for (let depth = 0; licenses.length === 0 && depth < 2; depth++) {
      const parent = pomParent(pom);
      if (!parent) break;
      pom = await getText(pomUrl(parent.groupId, parent.artifactId, parent.version));
      licenses = pomLicenses(pom);
    }
    facts.license = licenses.length > 0 ? licenses.join(' OR ') : null;
  } catch {
    errors.push('the POM on Maven Central');
  }
  // A file on Maven Central never changes once published, so the Last-Modified of its POM is the day it came out.
  try {
    const response = await fetch(pomUrl(group, artifact, chosen), { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT) });
    const modified = response.ok ? response.headers.get('last-modified') : null;
    facts.published = modified ? new Date(modified).toISOString() : null;
    if (!facts.published) errors.push('the publication date on Maven Central');
  } catch {
    errors.push('the publication date on Maven Central');
  }
  try {
    facts.vulnerabilities = osvIds(await osv('maven', name, chosen));
  } catch {
    errors.push('the vulnerabilities on OSV');
  }
  return { ...facts, errors };
}

async function main() {
  // --dry-run: the verdict only, nothing written, for the libraries a plan names before gate ②.
  const dryRun = process.argv.includes('--dry-run');
  const [ecosystem, spec] = process.argv.slice(2).filter((arg) => arg !== '--dry-run');
  if (!ECOSYSTEMS.includes(ecosystem) || !spec) {
    console.log('usage: node .ai-orchestrator/scripts/dep-check.mjs <npm|maven> <name>@<version> [--dry-run]');
    process.exit(1);
  }
  const { name, version } = parseSpec(ecosystem, spec);
  const kit = fileURLToPath(new URL('..', import.meta.url));
  const gates = readGates(join(kit, 'quality'));
  let facts;
  try {
    facts = ecosystem === 'npm' ? await npmLibrary(name, version) : await mavenLibrary(name, version);
  } catch (error) {
    facts = { version, errors: [error.message] };
  }
  const today = new Date().toISOString().slice(0, 10);
  const verdict = depVerdict(facts, { licenses: gates.dependencies.licenses, today });
  const label = `${name}@${facts.version ?? version ?? '?'} (${ecosystem})`;
  for (const note of verdict.notes) console.log(`note  ${note}`);
  if (!verdict.ok) {
    console.log(`SUSPICIOUS: ${label}`);
    for (const problem of verdict.problems) console.log(`  - ${problem}`);
    console.log('Nothing written. Ask security on the item: a comment "Cần security:" that names the library, its version and these lines.');
    process.exit(2);
  }
  if (dryRun) {
    console.log(`PASS: ${label}. Nothing written (--dry-run): the dev agent runs dep-check again when it installs it.`);
    return;
  }
  const file = join(process.cwd(), '.ai-orchestrator', 'project.yaml');
  if (!existsSync(file)) {
    console.log(`PASS: ${label}, but there is no .ai-orchestrator/project.yaml here to write it in: run this from the root of the project`);
    process.exit(1);
  }
  // npm takes a caret range of the version checked; Maven, the version itself.
  const range = ecosystem === 'npm' ? `^${facts.version}` : facts.version;
  writeFileSync(file, addApproved(readFileSync(file, 'utf8'), { ecosystem, name, range, by: 'dep-check', on: today }));
  console.log(`PASS: ${label}. Added to dependencies.approved of .ai-orchestrator/project.yaml, range ${range}: commit it with the change that installs it.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
