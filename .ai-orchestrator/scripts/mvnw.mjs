// mvnw.mjs (project-scaffold part 3, spec 2.2): runs one script of a Java app with the app's Maven wrapper and the JDK
// its pom.xml asks for. The package.json of a Java app calls it, so pnpm -r, CI and /ao-preview run the app as a JS one.
// JAVA_HOME is set for the wrapper only; yours stays as it is. dev reads the app's .env and starts the services of its
// docker-compose.yml that run from an image, such as the database, first. The decisions are in lib/quality/maven.mjs.
//   node .ai-orchestrator/scripts/mvnw.mjs <app folder> lint|typecheck|test:coverage|build|dev
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { composeUpArgs, devEnv, findJdk, javaVersionOf, jdkMissing, mavenArgs, wrapperCommand } from '../lib/quality/maven.mjs';

function fail(message) {
  console.error(`mvnw: ${message}`);
  process.exit(1);
}

const [dir, script] = process.argv.slice(2);
if (!dir || !script) fail('usage: node mvnw.mjs <app folder> lint|typecheck|test:coverage|build|dev');
const app = resolve(dir);
let args;
try {
  args = mavenArgs(script);
} catch (error) {
  fail(error.message);
}
if (!existsSync(join(app, 'pom.xml'))) fail(`${app} has no pom.xml`);
const want = javaVersionOf(readFileSync(join(app, 'pom.xml'), 'utf8'));
if (!want) fail(`${join(app, 'pom.xml')} names no <java.version> or <maven.compiler.release>`);
const jdk = findJdk({ want, readFile: (file) => readFileSync(file, 'utf8'), listDir: (folder) => readdirSync(folder) });
if (!jdk) fail(jdkMissing(want));

let env = { ...process.env, JAVA_HOME: jdk.home };
if (script === 'dev') {
  const dotenv = join(app, '.env');
  env = devEnv(env, existsSync(dotenv) ? readFileSync(dotenv, 'utf8') : null);
  if (existsSync(join(app, 'docker-compose.yml'))) {
    let up;
    try {
      up = composeUpArgs(readFileSync(join(app, 'docker-compose.yml'), 'utf8'));
    } catch (error) {
      fail(error.message);
    }
    if (up) {
      const done = spawnSync('docker', up, { cwd: app, env, stdio: 'inherit' });
      if (done.status !== 0) fail(`docker ${up.join(' ')} failed: start Docker Desktop, then run the command again`);
    }
  }
}

const { file, args: wrapperArgs, cwd, windowsVerbatimArguments } = wrapperCommand(app, args);
const run = spawnSync(file, wrapperArgs, { cwd, env, stdio: 'inherit', windowsVerbatimArguments });
if (run.error) fail(run.error.message);
process.exit(run.status ?? 1);
