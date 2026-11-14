// What the code of an app still has to change to run with the kit (project-scaffold part 2, spec 2.3). ao-kit add says
// it and changes nothing: the changes go through a Task and a PR, like any other. read(path) gives the text of a file of
// the app, or null. Returns one line for each thing to change.
import { REQUIRED_SCRIPTS } from './project-config.mjs';

const firstOf = (read, names) => names.map((name) => [name, read(name)]).find(([, text]) => text != null) ?? [null, null];

// The variables a bundler writes into the build, so they hold the same value in all three environments.
const BUILD_TIME = { nextjs: /^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/gm, react: /^\s*(VITE_[A-Z0-9_]+)\s*=/gm };

// What a Spring Boot app still has to change (project-scaffold part 3, spec 2.1): its port, the variables it needs on
// the VPS, a Dockerfile made for one environment, and the coverage report CI reads.
function springBoot({ app, read, port }) {
  const lines = [];
  const [config, text] = firstOf(read, ['src/main/resources/application.yml', 'src/main/resources/application.yaml', 'src/main/resources/application.properties']);
  if (text && !/\$\{PORT[:}]/.test(text)) {
    const from = /port\s*[:=]\s*["']?\$\{([A-Z][A-Z0-9_]*)/.exec(text)?.[1];
    lines.push(`apps/${app}/${config} takes server.port from ${from ?? 'a fixed value'}, not PORT: write server.port: \${PORT:${port}}, so /ao-preview and the deployer choose the port`);
  }
  const bare = [...new Set([...(text ?? '').matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)].map((match) => match[1]))];
  if (bare.length > 0) lines.push(`apps/${app}/${config} reads ${bare.join(', ')} with no default: name them in env: of ${app} in deploy.yaml, and set them in /etc/ao/secrets/<project>/<environment>.env on the VPS`);

  // One instruction a line: a HEALTHCHECK often goes on over several lines that end with a backslash.
  const docker = (read('Dockerfile') ?? '').replace(/\\\r?\n/g, ' ');
  const exposed = [...docker.matchAll(/^\s*EXPOSE\s+(\d+)/gm)].map((match) => Number(match[1]));
  const health = /HEALTHCHECK[^\n]*localhost:(\d+)/.exec(docker)?.[1];
  if (exposed.some((value) => value !== port) || (health && Number(health) !== port)) {
    const parts = [exposed.length > 0 && `exposes ${exposed.join(', ')}`, health && `checks its health on ${health}`].filter(Boolean);
    lines.push(`apps/${app}/Dockerfile ${parts.join(' and ')}, but the app runs on ${port}: use the port of the app, which PORT sets`);
  }
  if (/^\s*ENV\s+SPRING_PROFILES_ACTIVE[=\s]/m.test(docker)) {
    lines.push(`apps/${app}/Dockerfile sets SPRING_PROFILES_ACTIVE for every environment, and the deployer runs one image in all three: name SPRING_PROFILES_ACTIVE in env: of deploy.yaml, so the secrets file of each environment chooses its profile`);
  }

  const pom = read('pom.xml') ?? '';
  if (!/jacoco-maven-plugin/.test(pom)) lines.push(`apps/${app}/pom.xml has no jacoco-maven-plugin: CI reads target/site/jacoco/jacoco.xml for the coverage of changed lines`);
  else if (/<formats>/.test(pom) && !/<format>\s*XML\s*<\/format>/i.test(pom)) lines.push(`apps/${app}/pom.xml asks JaCoCo for no XML report: CI reads target/site/jacoco/jacoco.xml`);
  return lines;
}

// .dockerignore has no comment after a pattern: the text after # becomes part of the pattern, and Docker 24 refuses a
// pattern with letters outside ASCII (T2, the user's Java template).
function dockerignore({ app, read }) {
  return (read('.dockerignore') ?? '').split('\n').flatMap((line, i) => (
    !line.trimStart().startsWith('#') && /\s#/.test(line)
      ? [`apps/${app}/.dockerignore line ${i + 1} holds a comment after a pattern, which .dockerignore reads as part of the pattern: put the comment on a line of its own`]
      : []));
}

export function appReport({ app, profile, read, port }) {
  const lines = [];
  const pkg = JSON.parse(read('package.json') ?? '{}');
  const scripts = pkg.scripts ?? {};
  const lacking = REQUIRED_SCRIPTS.filter((script) => !scripts[script]);
  if (lacking.length > 0) lines.push(`apps/${app}/package.json has no ${lacking.join(', ')} script: CI runs the four of every app`);

  // CI reads coverage/lcov.info of each JS app; Vitest writes it only when a reporter asks.
  const [vitest, vitestText] = firstOf(read, ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vite.config.ts']);
  if (profile !== 'spring-boot' && scripts['test:coverage'] && !/['"]lcov(only)?['"]/.test(vitestText ?? '')) {
    lines.push(`apps/${app}/${vitest ?? 'vitest.config.ts'} writes no lcov: add 'lcov' to coverage.reporter, so CI finds apps/${app}/coverage/lcov.info for the coverage of changed lines`);
  }

  if (profile === 'nextjs') {
    const [config, text] = firstOf(read, ['next.config.ts', 'next.config.mjs', 'next.config.js']);
    if (!/output\s*:\s*['"]standalone['"]/.test(text ?? '')) lines.push(`apps/${app}/${config ?? 'next.config.ts'} has no output: 'standalone', which apps/${app}/Dockerfile runs`);
    if (/(^|\s)(-p|--port)(\s|=)\d+/.test(scripts.dev ?? '')) lines.push(`the dev script of apps/${app} sets its own port: leave -p out, so next dev takes the port of PORT`);
  }
  if (profile === 'react') {
    const [config, text] = firstOf(read, ['vite.config.ts', 'vite.config.mts', 'vite.config.js']);
    if (!/process\.env(\.PORT|\[['"]PORT['"]\])|env\.PORT/.test(text ?? '')) lines.push(`apps/${app}/${config ?? 'vite.config.ts'} does not take its port from PORT: set server.port from process.env.PORT, so two copies of the app run side by side`);
    if (!/proxy/.test(text ?? '')) lines.push(`apps/${app}/${config ?? 'vite.config.ts'} has no proxy for /api: on the VPS, Caddy in the container sends /api/* to the app api, so let the dev server do the same and call /api on the app's own origin`);
  }

  if (profile === 'spring-boot') lines.push(...springBoot({ app, read, port }));
  lines.push(...dockerignore({ app, read }));

  const pattern = BUILD_TIME[profile];
  const example = read('.env.example');
  if (pattern && example) {
    const names = [...new Set([...example.matchAll(pattern)].map((match) => match[1]))];
    if (names.length > 0) {
      lines.push(`apps/${app}/.env.example names ${names.join(', ')}, which the build writes into the code. The deployer builds one image for each commit and runs it in all three environments, so each holds the same value everywhere: call the API on the relative path /api, read the public URL of the app when it runs from AO_PUBLIC_URL, and set any other value in apps/${app}/Dockerfile`);
    }
  }
  return lines;
}
