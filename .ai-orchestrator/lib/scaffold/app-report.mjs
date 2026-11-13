// What the code of an app still has to change to run with the kit (project-scaffold part 2, spec 2.3). ao-kit add says
// it and changes nothing: the changes go through a Task and a PR, like any other. read(path) gives the text of a file of
// the app, or null. Returns one line for each thing to change.
import { REQUIRED_SCRIPTS } from './project-config.mjs';

const firstOf = (read, names) => names.map((name) => [name, read(name)]).find(([, text]) => text != null) ?? [null, null];

// The variables a bundler writes into the build, so they hold the same value in all three environments.
const BUILD_TIME = { nextjs: /^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/gm, react: /^\s*(VITE_[A-Z0-9_]+)\s*=/gm };

export function appReport({ app, profile, read }) {
  const lines = [];
  const pkg = JSON.parse(read('package.json') ?? '{}');
  const scripts = pkg.scripts ?? {};
  const lacking = REQUIRED_SCRIPTS.filter((script) => !scripts[script]);
  if (lacking.length > 0) lines.push(`apps/${app}/package.json has no ${lacking.join(', ')} script: CI runs the four of every app`);

  // CI reads coverage/lcov.info of each app; Vitest writes it only when a reporter asks.
  const [vitest, vitestText] = firstOf(read, ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vite.config.ts']);
  if (scripts['test:coverage'] && !/['"]lcov(only)?['"]/.test(vitestText ?? '')) {
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
