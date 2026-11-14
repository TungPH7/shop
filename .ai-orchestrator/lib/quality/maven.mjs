// Maven of a Java app (project-scaffold part 3, spec 2.2; plan, decision 4): the one place that knows which Maven run
// each script of a Java app makes, how the app's wrapper is started, and which JDK it needs. A Java app is a package of
// the pnpm workspace through its own package.json, whose scripts call scripts/mvnw.mjs; so CI, the root scripts and
// /ao-preview run it as they run a JS app.
//
// The wrapper runs with no shell line built from outside words. On Windows mvnw.cmd is a batch file, which only cmd.exe
// runs: the kit passes it the fixed arguments of MAVEN_SCRIPTS, checked word by word, and names the wrapper as .\mvnw.cmd
// in the app folder, since a Claude Code session sets NoDefaultCurrentDirectoryInExePath and cmd.exe then does not look
// in the current folder (T2). Elsewhere sh runs ./mvnw, which needs no executable bit.
import { posix, win32 } from 'node:path';
import { parseEnv } from 'node:util';
import { parse } from 'yaml';

// The Maven run of each script. typecheck and build skip Spotless and Checkstyle, which lint runs, so each script fails
// for one reason only.
const SKIP_LINT = ['-Dspotless.check.skip=true', '-Dcheckstyle.skip=true'];
export const MAVEN_SCRIPTS = {
  lint: ['validate'],
  typecheck: ['compile', ...SKIP_LINT],
  'test:coverage': ['verify'],
  build: ['package', '-DskipTests', ...SKIP_LINT],
  dev: ['spring-boot:run'],
};

// The arguments of one script: batch mode, no download progress, then its goals.
export function mavenArgs(script) {
  if (!Object.hasOwn(MAVEN_SCRIPTS, script)) throw new Error(`script ${JSON.stringify(script)} is not one of ${Object.keys(MAVEN_SCRIPTS).join(', ')}`);
  return ['-B', '-ntp', ...MAVEN_SCRIPTS[script]];
}

// A word cmd.exe reads as one word and nothing more: letters, digits and : . _ = -.
const PLAIN = /^[A-Za-z0-9:._=-]+$/;

// How to start the wrapper of the app in `cwd`: { file, args, cwd, windowsVerbatimArguments } for spawn.
export function wrapperCommand(cwd, args, { platform = process.platform, env = process.env } = {}) {
  for (const arg of args) if (!PLAIN.test(arg)) throw new Error(`${JSON.stringify(arg)} is not a plain Maven argument`);
  if (platform === 'win32') {
    // With /s, cmd.exe drops the outer quotes and runs the line between them as it is.
    return { file: env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `".\\mvnw.cmd ${args.join(' ')}"`], cwd, windowsVerbatimArguments: true };
  }
  return { file: 'sh', args: ['./mvnw', ...args], cwd };
}

// The Java version a pom.xml asks for: <java.version>, which Spring Boot reads, or <maven.compiler.release>; null when
// it names neither.
export function javaVersionOf(pomText) {
  const match = /<java\.version>\s*(\d+)\s*<\/java\.version>/.exec(pomText) ?? /<maven\.compiler\.release>\s*(\d+)\s*<\/maven\.compiler\.release>/.exec(pomText);
  return match ? Number(match[1]) : null;
}

// The Java versions CI installs for the apps/*/pom.xml of a repo, each once, low to high: { versions } or { error }.
// poms: [{ path, text }]. actions/setup-java installs them all and sets JAVA_HOME_<version>_X64 for each, which
// findJdk reads.
export function ciJavaVersions(poms) {
  const versions = new Set();
  for (const { path, text } of poms) {
    const version = javaVersionOf(text);
    if (!version) return { error: `${path} names no <java.version> or <maven.compiler.release>, so CI cannot tell which JDK to install` };
    versions.add(version);
  }
  return { versions: [...versions].sort((a, b) => a - b) };
}

// The major version in the release file of a JDK: JAVA_VERSION="21.0.10" gives 21, "1.8.0_402" gives 8. Reading the
// file runs nothing from the JDK.
export function jdkMajor(releaseText) {
  const version = /^JAVA_VERSION="([^"]+)"/m.exec(releaseText)?.[1];
  if (!version) return null;
  const [first, second] = version.split(/[._-]/).map(Number);
  return first === 1 ? second : first;
}

// Folders where JDK installers put one folder per JDK.
const INSTALL_DIRS = {
  win32: ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Amazon Corretto', 'C:\\Program Files\\Zulu'],
  linux: ['/usr/lib/jvm'],
  darwin: ['/Library/Java/JavaVirtualMachines'],
};

// The JDK of major version `want`, as { home, from }, or null. In order: JAVA_HOME; JAVA_HOME_<want> or
// JAVA_HOME_<want>_X64, as the GitHub runners name them; a JDK next to JAVA_HOME, such as C:\opt\jdk-21 next to
// C:\opt\jdk-17.0.10; the folders installers use. readFile(path) and listDir(dir) read the disk; both may throw.
export function findJdk({ want, env = process.env, platform = process.platform, readFile, listDir }) {
  const path = platform === 'win32' ? win32 : posix;
  const major = (home) => {
    try {
      return jdkMajor(readFile(path.join(home, 'release')));
    } catch {
      return null;
    }
  };
  const children = (dir) => {
    try {
      return listDir(dir).toSorted().toReversed().map((name) => path.join(dir, name));
    } catch {
      return [];
    }
  };
  const home = (dir) => (platform === 'darwin' && dir.endsWith('.jdk') ? path.join(dir, 'Contents', 'Home') : dir);

  if (env.JAVA_HOME && major(env.JAVA_HOME) === want) return { home: env.JAVA_HOME, from: 'JAVA_HOME' };
  for (const name of [`JAVA_HOME_${want}`, `JAVA_HOME_${want}_X64`, `JAVA_HOME_${want}_ARM64`]) {
    if (env[name] && major(env[name]) === want) return { home: env[name], from: name };
  }
  if (env.JAVA_HOME) {
    const next = children(path.dirname(env.JAVA_HOME)).find((dir) => major(dir) === want);
    if (next) return { home: next, from: 'next to JAVA_HOME' };
  }
  for (const dir of INSTALL_DIRS[platform] ?? []) {
    const found = children(dir).map(home).find((candidate) => major(candidate) === want);
    if (found) return { home: found, from: dir };
  }
  return null;
}

// The environment of `dev`: the variables of the app's .env, under those already set, so PORT from /ao-preview wins.
// The values are never printed.
export function devEnv(base, dotenvText) {
  return { ...(dotenvText ? parseEnv(dotenvText) : {}), ...base };
}

// Before dev, the services of the app's docker-compose.yml that run from an image, such as its database, started and
// waited for until their health checks pass. A service with build: is the app itself (the user's template has one on
// 8080), which Maven runs for dev, so it stays down (project-scaffold part 3, T21). null when nothing is left to start.
export function composeUpArgs(composeText) {
  let doc;
  try {
    doc = parse(composeText);
  } catch (error) {
    throw new Error(`the docker-compose.yml of the app cannot be read: ${error.message.split('\n')[0]}`);
  }
  const services = Object.entries(doc?.services ?? {}).filter(([, service]) => service && !service.build).map(([name]) => name);
  return services.length > 0 ? ['compose', 'up', '--detach', '--wait', ...services] : null;
}

// What to tell someone whose machine has no JDK of the version the pom asks for.
export const jdkMissing = (want) => `JDK ${want} was not found: install it, or set JAVA_HOME_${want} to its folder (the one that holds bin/ and release)`;
