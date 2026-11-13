// The hosts of a project in /etc/ao/deployer.yaml (release-workflow spec 2.3, 2.11; project-scaffold part 2, spec 2.4).
// Two shapes:
// - one host for each environment, { development, staging, production }: the host of the one public app, whatever its
//   name, as the projects of the kit had before part 2;
// - one host for each environment of each public app, { <app>: { development, staging, production } }.
// The values tell the shapes apart, not the keys, since an app may be named staging. Hosts stay on the VPS, where you
// write them: a repository cannot point a host at its containers, so no project takes the host of another.
import { ENVIRONMENTS } from './targets.mjs';

// Whether the hosts are given app by app.
export const hostsByApp = (hosts) => Object.values(hosts ?? {}).some((value) => value !== null && typeof value === 'object');

// The host of a public app in an environment, or null. One host for each environment serves the one public app.
export function hostOf(hosts, env, app) {
  return (hostsByApp(hosts) ? hosts[app]?.[env] : hosts?.[env]) ?? null;
}

// Every host of a project: [{ app, env, host }], app null in the shape of one host for each environment.
export function hostList(hosts) {
  if (!hostsByApp(hosts)) return ENVIRONMENTS.filter((env) => hosts?.[env]).map((env) => ({ app: null, env, host: hosts[env] }));
  return Object.entries(hosts).flatMap(([app, byEnv]) => ENVIRONMENTS.filter((env) => byEnv?.[env]).map((env) => ({ app, env, host: byEnv[env] })));
}

// The public apps of a deploy.yaml, in its order.
export const publicApps = (deployConfig) => Object.entries(deployConfig.apps).filter(([, app]) => app.public).map(([name]) => name);

// The URL of each public app of deploy.yaml in an environment: { urls: { <app>: 'https://<host>' }, problem }. problem
// says why the deployer may not deploy: more than one public app with one host for each environment, or a public app
// with no host. Then urls is {}.
export function publicUrls(hosts, deployConfig, env) {
  const open = publicApps(deployConfig);
  if (!hostsByApp(hosts) && open.length > 1) {
    return { urls: {}, problem: `deploy.yaml has ${open.length} public apps (${open.join(', ')}), and /etc/ao/deployer.yaml names one host for each environment: give each public app its own hosts there (docs/vps-setup.md)` };
  }
  const missing = open.filter((app) => !hostOf(hosts, env, app));
  if (missing.length > 0) return { urls: {}, problem: `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} public in deploy.yaml but ${missing.length === 1 ? 'has' : 'have'} no ${env} host in /etc/ao/deployer.yaml` };
  return { urls: Object.fromEntries(open.map((app) => [app, `https://${hostOf(hosts, env, app)}`])), problem: null };
}
