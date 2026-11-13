// /etc/ao/deployer.yaml (release-workflow spec 2.3, 2.11): what the deployer on the VPS deploys. Rules: V1 the schema
// deployer.schema.json next to this file; V2 no two projects share a name or a repository, and no host is used twice,
// in either shape of hosts (hosts.mjs; project-scaffold part 2, spec 2.4).
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { schemaErrors } from '../rules/schema.mjs';
import { hostList } from './hosts.mjs';

const FILE = 'deployer.yaml';
const schema = JSON.parse(readFileSync(new URL('./deployer.schema.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv({ allErrors: true }).compile(schema);

// Returns every rule violation as { rule, path, message }; schema errors come alone. The if of hosts adds only "must
// match then", next to the errors of its branch, so it is left out.
export function validateDeployerConfig(config) {
  if (!validateSchema(config)) return schemaErrors(config, validateSchema.errors.filter(({ keyword }) => keyword !== 'if'), 'V1', FILE);
  const errors = [];
  const seen = { name: new Map(), repo: new Map(), host: new Map() };
  const once = (kind, value, path) => {
    if (seen[kind].has(value)) errors.push({ rule: 'V2', path, message: `${value} is also at ${seen[kind].get(value)} (${FILE})` });
    else seen[kind].set(value, path);
  };
  config.projects.forEach((project, i) => {
    once('name', project.name, `projects[${i}].name`);
    once('repo', project.repo, `projects[${i}].repo`);
    for (const { app, env, host } of hostList(project.hosts)) once('host', host, `projects[${i}].hosts.${app ? `${app}.` : ''}${env}`);
  });
  return errors;
}
