// CI of a project with Java apps (project-scaffold part 3, spec 2.2): the Java versions that apps/*/pom.xml ask for,
// one a line, as the output `versions` of the step, for actions/setup-java. Without $GITHUB_OUTPUT it prints them.
//   node .ai-orchestrator/scripts/ci-java.mjs
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ciJavaVersions } from '../lib/quality/maven.mjs';

const poms = existsSync('apps') ? readdirSync('apps').map((app) => join('apps', app, 'pom.xml')).filter((path) => existsSync(path)) : [];
const result = ciJavaVersions(poms.map((path) => ({ path: path.replaceAll('\\', '/'), text: readFileSync(path, 'utf8') })));
if (result.error) {
  console.error(`::error::${result.error}`);
  process.exit(1);
}
const lines = result.versions.join('\n');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `versions<<AO_JAVA_VERSIONS\n${lines}\nAO_JAVA_VERSIONS\n`);
else process.stdout.write(`${lines}\n`);
console.error(`java: ${result.versions.join(', ') || 'none'}`);
