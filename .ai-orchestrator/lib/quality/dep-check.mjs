// The pure parts of scripts/dep-check.mjs (C1 spec section 5): what it reads in the answers of the npm registry, Maven
// Central and OSV, and the line it adds to dependencies.approved of project.yaml.
import { parseDocument } from 'yaml';

// <name>@<version> of npm, the @ of a scope kept: zod@4.1.0, @nestjs/core@11.0.0. groupId:artifactId@version of Maven.
export function parseSpec(ecosystem, spec) {
  const at = String(spec ?? '').lastIndexOf('@');
  const name = at > 0 ? spec.slice(0, at) : spec;
  const version = at > 0 ? spec.slice(at + 1) : null;
  if (!name) throw new Error(`no library named in ${JSON.stringify(spec)}`);
  if (ecosystem === 'maven' && !/^[\w.-]+:[\w.-]+$/.test(name)) throw new Error(`a Maven library is groupId:artifactId, not ${name}`);
  if (ecosystem === 'npm' && !/^(@[\w.-]+\/)?[\w.-]+$/.test(name)) throw new Error(`${name} is not an npm package name`);
  if (version !== null && !/^[\w.+-]+$/.test(version)) throw new Error(`${version} is not one version: give an exact one, such as 4.1.0`);
  return { name, version };
}

// From the document the npm registry gives for a package: the version to check (the one asked, or the latest), and its
// license, publication time, maintainers, install scripts and provenance.
export function npmFacts(doc, version) {
  const chosen = version ?? doc?.['dist-tags']?.latest;
  const meta = doc?.versions?.[chosen];
  if (!meta) return { version: chosen, errors: [`version ${chosen} of the npm registry`] };
  const scripts = Object.keys(meta.scripts ?? {}).filter((name) => ['preinstall', 'install', 'postinstall'].includes(name));
  const license = typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? null);
  return {
    version: chosen,
    license,
    published: doc.time?.[chosen] ?? null,
    maintainers: Array.isArray(meta.maintainers ?? doc.maintainers) ? (meta.maintainers ?? doc.maintainers).length : null,
    installScripts: scripts,
    provenance: Boolean(meta.dist?.attestations?.provenance),
    errors: [],
  };
}

// The SPDX ids of the <license><name> of a pom.xml, for the names Maven projects write most; an unknown name is kept
// as it reads, so the license check names it.
const SPDX = [
  [/apache.*2/i, 'Apache-2.0'],
  [/\bmit\b/i, 'MIT'],
  [/eclipse public license.*2|\bepl.*2/i, 'EPL-2.0'],
  [/bsd.*3|new bsd|revised bsd/i, 'BSD-3-Clause'],
  [/bsd.*2|simplified bsd/i, 'BSD-2-Clause'],
  [/mozilla public license.*2|\bmpl.*2/i, 'MPL-2.0'],
  [/public domain|cc0/i, 'CC0-1.0'],
];
export function pomLicenses(text) {
  const names = [...String(text ?? '').matchAll(/<license>[\s\S]*?<name>\s*([^<]+?)\s*<\/name>[\s\S]*?<\/license>/g)].map(([, name]) => name);
  return names.map((name) => SPDX.find(([pattern]) => pattern.test(name))?.[1] ?? name);
}

// The parent of a pom.xml, where its license often is: { groupId, artifactId, version } or null.
export function pomParent(text) {
  const block = /<parent>([\s\S]*?)<\/parent>/.exec(String(text ?? ''))?.[1];
  if (!block) return null;
  const read = (tag) => new RegExp(`<${tag}>\\s*([^<\\s]+)\\s*</${tag}>`).exec(block)?.[1];
  const parent = { groupId: read('groupId'), artifactId: read('artifactId'), version: read('version') };
  return parent.groupId && parent.artifactId && parent.version ? parent : null;
}

// The ids of the vulnerabilities of an OSV answer to /v1/query.
export const osvIds = (answer) => (answer?.vulns ?? []).map(({ id }) => id).sort();

// project.yaml with the library added to dependencies.approved, its comments and layout kept. An entry of the same
// ecosystem and name is replaced. entry: { ecosystem, name, range, by, on }.
export function addApproved(text, entry) {
  const doc = parseDocument(text);
  const list = doc.getIn(['dependencies', 'approved'])?.toJSON?.() ?? [];
  const kept = list.filter(({ ecosystem, name }) => !(ecosystem === entry.ecosystem && name === entry.name));
  doc.setIn(['dependencies', 'approved'], doc.createNode([...kept, entry], { flow: false }));
  for (const item of doc.getIn(['dependencies', 'approved']).items) item.flow = true;
  // One entry a line, however long: no folding.
  return doc.toString({ lineWidth: 0 });
}

// The newest stable version of a maven-metadata.xml: the last of its versions that is no alpha, beta, milestone,
// release candidate or snapshot; null when it has none.
export function newestStable(metadata) {
  const versions = [...String(metadata ?? '').matchAll(/<version>\s*([^<\s]+)\s*<\/version>/g)].map(([, v]) => v);
  return versions.filter((v) => !/(alpha|beta|[.-]m\d|milestone|rc|\bcr|snapshot|\bea\b|preview)/i.test(v)).at(-1) ?? null;
}
